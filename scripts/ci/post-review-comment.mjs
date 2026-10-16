#!/usr/bin/env node
/**
 * Cria ou atualiza o comentário fixo do revisor (marker <!-- se-reviewer:shadow -->).
 * Aplica labels score:* e trilho:*.
 * Auth: GITHUB_TOKEN (default) ou token de App já exportado em GH_TOKEN.
 */
import { readFileSync } from 'node:fs';

const marker = '<!-- se-reviewer:shadow -->';
const repo = process.env.GITHUB_REPOSITORY;
const pr = process.env.PR_NUMBER;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const commentPath = process.env.COMMENT_PATH || 'artifacts/review/comment.md';
const reviewPath = process.env.REVIEW_PATH || 'artifacts/review/review.json';
const riskTier = process.env.RISK_TIER || 'medio';

if (!repo || !pr || !token) {
  console.error('GITHUB_REPOSITORY, PR_NUMBER e GITHUB_TOKEN/GH_TOKEN são obrigatórios');
  process.exit(1);
}

const [owner, name] = repo.split('/');
const body = readFileSync(commentPath, 'utf8');
const review = JSON.parse(readFileSync(reviewPath, 'utf8'));

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub ${res.status} ${path}: ${t.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const comments = await gh(`/repos/${owner}/${name}/issues/${pr}/comments?per_page=100`);
const existing = (comments || []).find((c) => String(c.body || '').includes(marker));

if (existing) {
  await gh(`/repos/${owner}/${name}/issues/comments/${existing.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ body }),
  });
  console.log(`updated comment ${existing.id}`);
} else {
  const created = await gh(`/repos/${owner}/${name}/issues/${pr}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  console.log(`created comment ${created.id}`);
}

const scoreLabel = `score:${review.score}`;
const tierLabel = `trilho:${riskTier}`;
const drop = ['score:alto', 'score:medio', 'score:baixo', 'trilho:alto', 'trilho:medio', 'trilho:baixo'];

const issue = await gh(`/repos/${owner}/${name}/issues/${pr}`);
const current = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
const next = current.filter((l) => !drop.includes(l));
if (!next.includes(scoreLabel)) next.push(scoreLabel);
if (!next.includes(tierLabel)) next.push(tierLabel);

for (const label of [scoreLabel, tierLabel]) {
  try {
    await gh(`/repos/${owner}/${name}/labels/${encodeURIComponent(label)}`);
  } catch {
    const color = label.startsWith('score:alto') || label.startsWith('trilho:alto') ? 'B60205' : label.includes('medio') ? 'FBCA04' : '0E8A16';
    await gh(`/repos/${owner}/${name}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name: label, color, description: 'ADR-003 revisor sombra' }),
    }).catch(() => undefined);
  }
}

await gh(`/repos/${owner}/${name}/issues/${pr}`, {
  method: 'PATCH',
  body: JSON.stringify({ labels: next }),
});
console.log(`labels -> ${next.filter((l) => l.startsWith('score:') || l.startsWith('trilho:')).join(', ')}`);
