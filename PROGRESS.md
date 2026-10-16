# PROGRESS â€” Seja Engajado

| Bloco | Status | Commit | Data |
|---|---|---|---|
| AW2 | DONE | 8b30e2e | 2026-10-16 |
| AW3 | DONE | 100de96 | 2026-10-16 |
| AW4 | DONE | â€” | 2026-10-16 |
| AW5 | TODO | â€” | â€” |
| AW6 | TODO | â€” | â€” |
| AW7 | TODO | â€” | â€” |
| UI7 | TODO | â€” | â€” |
| SSR1 | TODO | â€” | â€” |
| LU1 | TODO | â€” | â€” |
| LU2 | TODO | â€” | â€” |
| LU3 | TODO | â€” | â€” |
| LU4 | TODO | â€” | â€” |
| LU5 | TODO | â€” | â€” |
| LU6 | TODO | â€” | â€” |
| SEO1 | TODO | â€” | â€” |
| BR1 | BLOQUEADO | â€” | â€” |
| DOC1 | TODO | â€” | â€” |
| HX | TODO | â€” | â€” |

## Ãšltimo bloco
AW4 â€” Revendedor: registrar venda. PreÃ§o/custo congelados em R$ (API em centavos); `Idempotency-Key` estÃ¡vel com botÃ£o desabilitado em voo (duplo clique = 1 chamada); mock idempotente; specs AW4. Stash `stash@{0}` AW6 intacto.

## PrÃ³ximo
AW5 â€” Revendedor: financeiro e estoque de placas.

## Bloqueios / perguntas para o Tarciso
- **BR1:** escolha de marca A, B ou C ainda pendente.
- Push Ã— deploy: decidido â€” push ok; deploy exige aprovaÃ§Ã£o manual do Tarciso.

## DecisÃµes assumidas (recomendaÃ§Ã£o padrÃ£o)
- P2/P2a â†’ JWT HS256 com secret (jÃ¡ no cÃ³digo); sem JWKS.
- P10 â†’ pg-boss (jÃ¡ no cÃ³digo)
- P12 â†’ 404 entre tenants
- P27 â†’ impersonaÃ§Ã£o somente leitura com audit
- AW4 cupom: API `POST /reseller/sales` sÃ³ aceita `items[]` (sem cupom); formulÃ¡rio cobre produto/placa + preÃ§o.

