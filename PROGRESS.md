# PROGRESS — Seja Engajado

| Bloco | Status | Commit | Data |
|---|---|---|---|
| AW2 | DONE | 8b30e2e | 2026-10-16 |
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
AW2 — HttpApi + sessão: `Idempotency-Key` no checkout; interceptor 401 com `refreshSession` compartilhado + retry; toasts 403/404; specs `HttpTestingController` (Bearer, idempotência, erros). Push `origin master` autorizado (deploy só com aprovação manual no environment production). Stash local preservado: `stash@{0}` WIP AW6 (admin B2).

## Próximo
AW3 — Revendedor: clientes e sites (criar e publicar).

## Bloqueios / perguntas para o Tarciso
- **BR1:** escolha de marca A, B ou C ainda pendente.
- Push × deploy: decidido — push ok; deploy exige aprovação manual do Tarciso.

## Decisões assumidas (recomendação padrão)
- P2/P2a → JWT HS256 com secret (já no código); sem JWKS.
- P10 → pg-boss (já no código)
- P12 → 404 entre tenants
- P27 → impersonação somente leitura com audit
