# PROGRESS — Seja Engajado

| Bloco | Status | Commit | Data |
|---|---|---|---|
| AW2 | DONE (local; push pendente) | 8b30e2e | 2026-10-16 |
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
AW2 — HttpApi + sessão: `Idempotency-Key` no checkout; interceptor 401 com `refreshSession` compartilhado + retry; toasts 403/404; specs `HttpTestingController` (Bearer, idempotência, erros); DI Mock/Http por `environment.apiUrl` (já existia). DoD web: lint, test (87), build, format:check verdes. API JWT/`/auth/me` + `auth.int-spec` já cobertos. Stash local: `stash@{0}` WIP AW6 (admin B2).

## Próximo
AW3 — Revendedor: clientes e sites (criar e publicar). **Só após autorização de push** (ou confirmação de que o deploy não roda sozinho).

## Bloqueios / perguntas para o Tarciso
- **Push × deploy:** `.github/workflows/deploy.yml` dispara em `push` para `master`/`main` e o job `deploy` roda no runner self-hosted (`environment: production`: build GHCR + migrate + `docker stack deploy`). Posso dar `git push origin master` dos commits do loop, ou só commit local até você autorizar / desligar o deploy automático?
- **BR1:** escolha de marca A, B ou C ainda pendente.

## Decisões assumidas (recomendação padrão)
- P2/P2a → JWT HS256 com secret (já no código); sem JWKS.
- P10 → pg-boss (já no código)
- P12 → 404 entre tenants
- P27 → impersonação somente leitura com audit
