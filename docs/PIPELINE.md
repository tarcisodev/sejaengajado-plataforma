# Pipeline de PR — Seja Engajado

Referência: [ADR-003](./ADR-003-pipeline-autonoma.md). Deploy de produção continua em `.github/workflows/deploy.yml` com aprovação manual no environment `production` — **este documento não altera isso**.

## Fluxo

```
branch → PR → master
   │
   ├─ pr-ci (self-hosted VPS)
   │    lint · test · test:int · build · bundle-budget
   │    e2e fluxo-feliz (compose de dev) · migration-guard · gitleaks · risk-tier
   │
   └─ agent-review (workflow_run, modo sombra)
        comenta score/gates · labels score:* + trilho:*
        NÃO aprova · NÃO faz merge
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

## O que muda ao sair do modo sombra (etapas futuras)

- Possível approve do GitHub App em trilho baixo com score baixo e CI verde.
- Ainda assim: trilho alto e environment `production` ficam com humano.
- `issue-triage.yml` (etapa 4) não faz parte desta entrega.

## Jobs required (branch protection)

Sugestão para `master`:

- `lint`
- `test`
- `test-int` (nome do job: `test-int`)
- `build`
- `e2e`
- `migration-guard`
- `gitleaks`
- (opcional) `pr-ci-ok` como agregador

Mais: 1 aprovação, linear history, dismiss stale reviews, block direct push.
