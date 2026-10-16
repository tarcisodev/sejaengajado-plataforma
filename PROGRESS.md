# PROGRESS — Seja Engajado

| Bloco | Status | Commit | Data |
|---|---|---|---|
| AW2 | DONE | 8b30e2e | 2026-10-16 |
| AW3 | DONE | 100de96 | 2026-10-16 |
| AW4 | DONE | — | 2026-10-16 |
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
AW4 — Revendedor: registrar venda. Preço/custo congelados em R$ (API em centavos); `Idempotency-Key` estável com botão desabilitado em voo (duplo clique = 1 chamada); mock idempotente; specs AW4. Stash `stash@{0}` AW6 intacto.

## Próximo
AW5 — Revendedor: financeiro e estoque de placas.

## Bloqueios / perguntas para o Tarciso
- **BR1:** escolha de marca A, B ou C ainda pendente.
- Push × deploy: decidido — push ok; deploy exige aprovação manual do Tarciso.

## Decisões assumidas (recomendação padrão)
- P2/P2a → JWT HS256 com secret (já no código); sem JWKS.
- P10 → pg-boss (já no código)
- P12 → 404 entre tenants
- P27 → impersonação somente leitura com audit
- AW4 cupom: API `POST /reseller/sales` só aceita `items[]` (sem cupom); formulário cobre produto/placa + preço.
