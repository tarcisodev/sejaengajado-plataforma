# PROGRESS — Seja Engajado

| Bloco | Status | Commit | Data |
|---|---|---|---|
| AW2 | DONE | 8b30e2e | 2026-10-16 |
| AW3 | DONE | 100de96 | 2026-10-16 |
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
AW3 — Revendedor: clientes e sites (criar e publicar). Wizard de sites; banner DELINQUENT via `AuthMe.resellerStatus` (JWT guard + `/auth/me`); ApiPort patch/unpublish; harness `se_admin` BYPASSRLS. DoD api+web verdes. Stash local preservado: `stash@{0}` WIP AW6 (admin B2).

## Próximo
AW4 — próximo bloco do loop (ver plano B2).

## Bloqueios / perguntas para o Tarciso
- **BR1:** escolha de marca A, B ou C ainda pendente.
- Push × deploy: decidido — push ok; deploy exige aprovação manual do Tarciso.

## Decisões assumidas (recomendação padrão)
- P2/P2a → JWT HS256 com secret (já no código); sem JWKS.
- P10 → pg-boss (já no código)
- P12 → 404 entre tenants
- P27 → impersonação somente leitura com audit
