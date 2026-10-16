# PROGRESS — Seja Engajado

| Bloco | Status | Commit | Data |
|---|---|---|---|
| AW2 | DONE | 8b30e2e | 2026-10-16 |
| AW3 | DONE | 100de96 | 2026-10-16 |
| AW4 | DONE | 0b7c375 | 2026-10-16 |
| AW5 | DONE | 722da00 | 2026-10-16 |
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

## Ultimo bloco
AW5 — Financeiro e estoque: `/revenda/estoque` (PlaqueStock + movimentos IN/brinde), ApiPort plaques com Idempotency-Key; extrato e faturas existentes; margem no dashboard. Specs stock/ledger/http. Stash AW6 intacto.

## Proximo
AW6 — Admin conectado a API (revendedores, atacado, configs, impersonacao P27).

## Bloqueios / perguntas para o Tarciso
- **BR1:** escolha de marca A, B ou C ainda pendente.
- Push x deploy: decidido — push ok; deploy exige aprovacao manual do Tarciso.

## Decisoes assumidas (recomendacao padrao)
- P2/P2a → JWT HS256 com secret (ja no codigo); sem JWKS.
- P10 → pg-boss (ja no codigo)
- P12 → 404 entre tenants
- P27 → impersonacao somente leitura com audit
