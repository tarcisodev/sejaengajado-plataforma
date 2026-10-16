# ADR-003 — Pipeline autônoma (PR CI + revisor em sombra)

Status: aceito (etapas 1–2 em implementação). Deploy com aprovação manual permanece no `deploy.yml` (fora deste ADR).

## 1. Contexto

Queremos PR obrigatório em `master`, CI completo no runner VPS (sem secrets de produção) e um revisor automático que comenta — sem merge — até a etapa de promoção.

## 2. Decisão

1. **pr-ci** em todo `pull_request` → `master`: lint, unit, int, build, e2e fluxo feliz (compose de dev), migration-guard, gitleaks, orçamento de bundle.
2. **Trilhos de risco** (`baixo` / `medio` / `alto`) via `.github/risk-paths.yml` + `scripts/ci/risk-tier.ts`.
3. **agent-review** (modo sombra): após pr-ci, monta contexto, chama o LLM com a rubrica §4, posta comentário fixo + labels; **não** aprova nem faz merge.
4. Teto mensal de tokens (`MONTHLY_TOKEN_CAP`); secret `REVIEW_LLM_API_KEY`. Identidade futura: GitHub App `se-reviewer` (`APP_ID` + `APP_PRIVATE_KEY`); enquanto isso, `GITHUB_TOKEN` só para comentar.

## 3. Trilhos

| Trilho | Exemplos |
|---|---|
| baixo | `web/**` (exceto auth), `docs/**`, `**/*.spec.ts`, `**/e2e/**` |
| medio | `api/src/**` (exceto alto), seeds, templates |
| alto | auth/guards/MFA, `prisma/migrations/`, RLS, cobrança (Asaas/webhook/fatura/multa), `infra/`, `stack*.yml`, `.github/**` |

O script devolve o **maior** trilho tocado no diff do PR.

## 4. Rubrica do revisor (modo sombra)

O modelo recebe: diff, issue `Closes #N`, resultados do CI, trilho. Deve responder **somente** JSON válido:

```json
{
  "score": "alto|medio|baixo",
  "summary": "1–3 frases em pt-BR",
  "gates": [
    { "id": "ci_green", "pass": true, "note": "…" },
    { "id": "tests_match_acceptance", "pass": true, "note": "…" },
    { "id": "no_secrets", "pass": true, "note": "…" },
    { "id": "expand_only_migrations", "pass": true, "note": "…" },
    { "id": "scope_fits_issue", "pass": true, "note": "…" },
    { "id": "auth_money_untouched_or_justified", "pass": true, "note": "…" }
  ],
  "criteria_vs_tests": [
    { "criterion": "…", "evidence": "arquivo ou spec", "covered": true }
  ],
  "requests": ["pedido acionável 1", "…"],
  "risk_tier_agree": true,
  "tokens_in": 0,
  "tokens_out": 0
}
```

### Como pontuar

- **baixo**: todos os gates `pass`, poucos/zero `requests`, trilho baixo/médio, mudanças óbvias e cobertas.
- **medio**: gates ok mas há `requests` menores, ou cobertura parcial, ou trilho médio com superfície ampla.
- **alto**: algum gate falha, ou trilho alto sem justificativa/testes, ou risco de auth/dinheiro/migração, ou CI vermelho.

Gates falhos ⇒ score não pode ser `baixo`. Trilho `alto` sem acordo explícito nos pedidos ⇒ score `alto` ou `medio` com request claro.

## 5. Comentário no PR

Comentário marcado com `<!-- se-reviewer:shadow -->` (criar ou atualizar). Inclui score, trilho, gates, tabela critério×teste, pedidos, tokens do PR e acumulado do mês.

## 6. Fora de escopo (etapas 1–2)

- Merge/approve automático
- `issue-triage.yml` (etapa 4)
- Alterar job `deploy` / environment `production`
- Push direto em `master`

## 7. Consequências

Branch protection em `master`: PR obrigatório, checks do pr-ci required, 1 aprovação humana, histórico linear, sem push direto. Trilho alto: humano faz merge.
