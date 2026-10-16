#!/usr/bin/env node
/**
 * Revisor em modo sombra (ADR-003 §4).
 * Monta contexto, chama LLM (se REVIEW_LLM_API_KEY), valida JSON, escreve review.json.
 * Não aprova nem faz merge.
 *
 * Env:
 *   REVIEW_LLM_API_KEY, REVIEW_LLM_BASE (default OpenAI-compatible), REVIEW_LLM_MODEL
 *   MONTHLY_TOKEN_CAP (0 = sem teto), TOKEN_USAGE_PATH (acumulado do mês)
 *   DIFF_PATH, CI_SUMMARY_PATH, RISK_TIER, ISSUE_BODY, PR_TITLE
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MARKER = '<!-- se-reviewer:shadow -->';

const reviewSchemaShape = {
  score: ['alto', 'medio', 'baixo'],
  gatesRequired: [
    'ci_green',
    'tests_match_acceptance',
    'no_secrets',
    'expand_only_migrations',
    'scope_fits_issue',
    'auth_money_untouched_or_justified',
  ],
};

function read(path, fallback = '') {
  if (!path || !existsSync(path)) return fallback;
  return readFileSync(path, 'utf8');
}

function validateReview(raw) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error('JSON inválido do modelo');
  }
  if (!reviewSchemaShape.score.includes(data.score)) {
    throw new Error(`score inválido: ${data.score}`);
  }
  if (!Array.isArray(data.gates) || data.gates.length < 3) {
    throw new Error('gates ausentes');
  }
  for (const id of reviewSchemaShape.gatesRequired) {
    if (!data.gates.some((g) => g.id === id)) {
      throw new Error(`gate faltando: ${id}`);
    }
  }
  if (!Array.isArray(data.criteria_vs_tests)) data.criteria_vs_tests = [];
  if (!Array.isArray(data.requests)) data.requests = [];
  data.tokens_in = Number(data.tokens_in || 0);
  data.tokens_out = Number(data.tokens_out || 0);
  data.summary = String(data.summary || '');
  return data;
}

function heuristicReview({ diff, ciSummary, riskTier, issueBody, prTitle }) {
  const ciGreen = /fail|failure|error/i.test(ciSummary) === false || /conclusion.: .success/i.test(ciSummary);
  const hasMigration = /prisma\/migrations\//.test(diff);
  const hasAuth = /\/auth\/|aal2|mfa|supabase/i.test(diff);
  const hasMoney = /asaas|webhook|ledger|fatura|multa|centavos/i.test(diff);
  const gates = [
    { id: 'ci_green', pass: ciGreen, note: ciGreen ? 'CI aparentemente verde' : 'CI com falha no resumo' },
    {
      id: 'tests_match_acceptance',
      pass: /\.spec\.|\.int-spec\.|e2e\//.test(diff) || riskTier === 'baixo',
      note: 'Heurística: presença de testes no diff ou trilho baixo',
    },
    { id: 'no_secrets', pass: !/\.env$|BEGIN (RSA |OPENSSH )?PRIVATE|sk_live|api[_-]?key\s*=/i.test(diff), note: 'Scan textual do diff' },
    {
      id: 'expand_only_migrations',
      pass: !hasMigration || !/\bDROP\b|\bRENAME\b/i.test(diff),
      note: hasMigration ? 'Diff toca migrations — confira migration-guard' : 'Sem migrations',
    },
    {
      id: 'scope_fits_issue',
      pass: Boolean(issueBody || prTitle),
      note: issueBody ? 'Issue vinculada presente' : 'Sem corpo de issue — revise escopo manualmente',
    },
    {
      id: 'auth_money_untouched_or_justified',
      pass: !(hasAuth || hasMoney) || riskTier === 'alto',
      note: hasAuth || hasMoney ? 'Toca auth/dinheiro — trilho alto esperado' : 'OK',
    },
  ];
  const failed = gates.filter((g) => !g.pass);
  let score = 'baixo';
  if (riskTier === 'alto' || failed.length) score = failed.length ? 'alto' : 'medio';
  else if (riskTier === 'medio' || gates.some((g) => !g.pass)) score = 'medio';
  return {
    score,
    summary: 'Revisão heurística (LLM indisponível ou teto de tokens). Confira gates e pedidos.',
    gates,
    criteria_vs_tests: [{ criterion: 'Diff revisado heuristicamente', evidence: 'agent-review.mjs', covered: true }],
    requests: failed.map((g) => `Resolver gate ${g.id}: ${g.note}`),
    risk_tier_agree: true,
    tokens_in: 0,
    tokens_out: 0,
    mode: 'heuristic',
  };
}

async function callLlm(prompt) {
  const key = process.env.REVIEW_LLM_API_KEY || '';
  if (!key) return null;
  const base = (process.env.REVIEW_LLM_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.REVIEW_LLM_MODEL || 'gpt-4o-mini';
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Você é o revisor se-reviewer (ADR-003 §4). Responda SOMENTE JSON válido conforme o schema. Texto em pt-BR. Não aprove nem faça merge.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM HTTP ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '{}';
  const review = validateReview(text);
  review.tokens_in = data.usage?.prompt_tokens || 0;
  review.tokens_out = data.usage?.completion_tokens || 0;
  review.mode = 'llm';
  review.model = model;
  return review;
}

function loadTokenUsage(path) {
  if (!path || !existsSync(path)) return { month: monthKey(), total: 0, byPr: {} };
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { month: monthKey(), total: 0, byPr: {} };
  }
}

function monthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function saveTokenUsage(path, usage) {
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(usage, null, 2));
}

function renderComment(review, meta) {
  const gateRows = review.gates
    .map((g) => `| \`${g.id}\` | ${g.pass ? '✅' : '❌'} | ${escapeMd(g.note || '')} |`)
    .join('\n');
  const critRows = (review.criteria_vs_tests || [])
    .map(
      (c) =>
        `| ${escapeMd(c.criterion)} | ${escapeMd(c.evidence || '')} | ${c.covered ? 'sim' : 'não'} |`,
    )
    .join('\n');
  const reqs = (review.requests || []).length
    ? review.requests.map((r) => `- ${escapeMd(r)}`).join('\n')
    : '_Nenhum pedido._';
  return `${MARKER}
## Revisor automático (modo sombra)

**Score:** \`${review.score}\` · **Trilho:** \`${meta.riskTier}\` · **Modo:** \`${review.mode || '?'}\`

${escapeMd(review.summary)}

### Gates
| Gate | Pass | Nota |
|---|---|---|
${gateRows}

### Critério × teste
| Critério | Evidência | Coberto |
|---|---|---|
${critRows || '| — | — | — |'}

### Pedidos
${reqs}

### Tokens
- Este PR: in=${review.tokens_in} out=${review.tokens_out}
- Mês (${meta.month}): ${meta.monthTotal}${meta.capped ? ' · **TETO ATINGIDO — LLM pulado**' : ''}

_Não aprova nem faz merge. ADR-003 etapas 1–2._
`;
}

function escapeMd(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

async function main() {
  const outDir = process.env.REVIEW_OUT_DIR || 'artifacts/review';
  mkdirSync(outDir, { recursive: true });
  const diff = read(process.env.DIFF_PATH, '').slice(0, 120_000);
  const ciSummary = read(process.env.CI_SUMMARY_PATH, '');
  const riskTier = process.env.RISK_TIER || 'medio';
  const issueBody = read(process.env.ISSUE_BODY_PATH, process.env.ISSUE_BODY || '');
  const prTitle = process.env.PR_TITLE || '';
  const prNumber = process.env.PR_NUMBER || '0';
  const tokenPath = process.env.TOKEN_USAGE_PATH || join(outDir, 'token-usage.json');
  const cap = Number(process.env.MONTHLY_TOKEN_CAP || 0);

  let usage = loadTokenUsage(tokenPath);
  if (usage.month !== monthKey()) usage = { month: monthKey(), total: 0, byPr: {} };

  let review;
  let capped = false;
  if (cap > 0 && usage.total >= cap) {
    capped = true;
    review = heuristicReview({ diff, ciSummary, riskTier, issueBody, prTitle });
    review.summary = `Teto mensal de tokens (${cap}) atingido. ${review.summary}`;
    review.mode = 'cap_skip';
  } else {
    const prompt = [
      '# Contexto PR',
      `Título: ${prTitle}`,
      `Trilho: ${riskTier}`,
      '## Issue',
      issueBody.slice(0, 8000),
      '## CI',
      ciSummary.slice(0, 8000),
      '## Diff',
      diff,
      '## Rubrica',
      read(join('docs', 'ADR-003-pipeline-autonoma.md')).slice(0, 6000),
    ].join('\n\n');
    try {
      review = (await callLlm(prompt)) || heuristicReview({ diff, ciSummary, riskTier, issueBody, prTitle });
    } catch (err) {
      console.error('LLM falhou, fallback heurístico:', err.message);
      review = heuristicReview({ diff, ciSummary, riskTier, issueBody, prTitle });
      review.requests.push(`LLM erro: ${err.message}`);
    }
  }

  const used = (review.tokens_in || 0) + (review.tokens_out || 0);
  usage.total += used;
  usage.byPr[prNumber] = (usage.byPr[prNumber] || 0) + used;
  saveTokenUsage(tokenPath, usage);

  const comment = renderComment(review, {
    riskTier,
    month: usage.month,
    monthTotal: usage.total,
    capped,
  });

  writeFileSync(join(outDir, 'review.json'), JSON.stringify(review, null, 2));
  writeFileSync(join(outDir, 'comment.md'), comment);
  writeFileSync(join(outDir, 'marker.txt'), MARKER);
  console.log(JSON.stringify({ score: review.score, mode: review.mode, tokens: used, monthTotal: usage.total }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
