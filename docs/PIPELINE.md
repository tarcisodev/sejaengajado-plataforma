# Pipeline de PR — Seja Engajado

Referência: [ADR-003](./ADR-003-pipeline-autonoma.md) e [PROMPT-PIPELINE](./PROMPT-PIPELINE.md).
Deploy de produção continua em `.github/workflows/deploy.yml` com aprovação manual no environment `production` — **só na VPS self-hosted**.

## Fluxo

```
branch → PR → master
   │
   ├─ pr-ci (ubuntu-latest, alvo < 5 min)
   │    paths-filter (docs-only → só pr-ci-ok; web-only → sem test-int)
   │    quick-api / quick-web (lint+typecheck+unit, 1× npm ci + cache nm)
   │    test-int (só se api/**) · build (artifacts) · docker-build (só Dockerfile/pkg/src)
   │    e2e @smoke (baixa api-dist/web-dist; Postgres service; Playwright cache)
   │    suíte completa: e2e-full.yml (push master / nightly)
   │
   └─ agent-review (workflow_run, modo sombra)
        comenta score/gates · labels score:* + trilho:*
        NÃO aprova · NÃO faz merge

master (push, paths-ignore md/docs)
   └─ build-and-deploy
        build/push GHCR (ubuntu-latest) → deploy (self-hosted VPS) + approval
```

Todo trabalho novo entra por **branch + PR**. Não há push direto em `master` (branch protection).

## Trilhos de risco

Definidos em `.github/risk-paths.yml`, calculados por `scripts/ci/risk-tier.mjs` no diff do PR.

| Trilho | Exemplos | Merge |
|---|---|---|
| baixo | docs, e2e, web (exceto auth), specs | após CI + 1 aprovação |
| medio | api/src (exceto alto), seeds | idem |
| alto | auth/MFA, migrations, RLS, cobrança, infra, `.github` | só humano (Tarciso); agent não mergeia |

## Rubrica do revisor

Ver ADR-003 §4. O comentário fixo no PR (marcador `<!-- se-reviewer:shadow -->`) traz:

- **Score** `alto` / `medio` / `baixo`
- **Gates** (CI, testes×aceite, segredos, migrations expand-only, escopo, auth/dinheiro)
- Tabela **critério × teste**
- **Pedidos** acionáveis
- **Tokens** do PR e acumulado do mês (`MONTHLY_TOKEN_CAP`)

Se o teto mensal for atingido, o LLM é pulado e o comentário avisa (fallback heurístico).

## Como ler o comentário

1. Se algum gate estiver ❌, trate antes de pedir review humano.
2. Score `baixo` + trilho baixo/médio + CI verde ⇒ candidato leve.
3. Score `alto` ou trilho `alto` ⇒ revisão humana obrigatória; não espere merge automático (não existe nestas etapas).
4. Atualizações do mesmo PR **substituem** o comentário (não spam).

## Jobs required (branch protection)

Sugestão para `master` (após merge do PR A da PROMPT-PIPELINE):

- `pr-ci-ok` (agregador — required)
- opcional: `lint`, `test`, `test-int`, `build`, `docker-build`, `e2e`, `migration-guard`, `gitleaks`

Mais: 1 aprovação, linear history, dismiss stale reviews, block direct push / force push, require up-to-date.

## Deploy

- `paths-ignore`: `**.md`, `docs/**`, `PROGRESS.md`, `.github/ISSUE_TEMPLATE/**`
- Rollback automático só se `DEPLOYED=1` (stack deploy já rodou); confere tag; sem `|| true`
- `workflow_dispatch.rollback_tag` faz checkout do SHA de destino
- VPS self-hosted: **somente** o job `deploy`
