# PROGRESS — Seja Engajado

| Bloco | Status | Commit | Data |
|---|---|---|---|
| AW2 | EM ANDAMENTO | — | 2026-10-16 |
| AW3 | TODO | — | — |
| AW4 | TODO | — | — |
| AW5 | TODO | — | — |
| AW6 | TODO | — | — |
| AW7 | TODO | — | — |
| UI7 | TODO | — | — |
| SSR1 | TODO | — | — |
| LU1 | TODO | — | — |
| LU2 | TODO | — | — |
| LU3 | TODO | — | — |
| LU4 | TODO | — | — |
| LU5 | TODO | — | — |
| LU6 | TODO | — | — |
| SEO1 | TODO | — | — |
| BR1 | BLOQUEADO | — | — |
| DOC1 | TODO | — | — |
| HX | TODO | — | — |

## Último bloco
— (PROGRESS criado; AW2 em andamento)

## Próximo
AW2 — HttpApiService + sessão na API (lacunas: specs HttpTestingController, Idempotency-Key nos POSTs de dinheiro, DoD verde).

## Bloqueios / perguntas para o Tarciso
- **Push × deploy:** `.github/workflows/deploy.yml` dispara em `push` para `master`/`main` e o job `deploy` roda no runner self-hosted com `environment: production` (build GHCR + migrate + `docker stack deploy`). Posso fazer push de commits do loop, ou só commit local até você autorizar / desligar o deploy automático?
- **BR1:** escolha de marca A, B ou C ainda pendente.

## Decisões assumidas (recomendação padrão)
- P2/P2a → JWT HS256 com secret (já no código); sem JWKS.
- P10 → pg-boss (já no código)
- P12 → 404 entre tenants
- P27 → impersonação somente leitura com audit
