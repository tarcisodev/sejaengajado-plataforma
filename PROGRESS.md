# PROGRESS — Seja Engajado

| Bloco | Status | Commit | Data |
|---|---|---|---|
| IK0 | DONE | d4dc2cc | 2026-10-16 |
| AW2 | DONE | 8b30e2e | 2026-10-16 |
| FF1 | DONE | a36aa8a | 2026-10-16 |
| FF2 | DONE | 3451581 | 2026-10-16 |
| FF3 | DONE | 5c46b3e | 2026-10-16 |
| FF4 | DONE | 0e4d9d5 | 2026-10-16 |
| FF5 | TODO | — | — |
| M1 | TODO | — | — |
| AW6 | DONE | 379005c | 2026-10-16 |
| AW7 | TODO | — | — |
| BR1 | TODO | — | — |
| LU2 | TODO | — | — |
| LU3 | TODO | — | — |
| LU1+ | TODO | — | — |
| LU5 | TODO | — | — |
| LU6 | TODO | — | — |
| SEO1 | TODO | — | — |
| UI7 | TODO | — | — |
| DOC1 | TODO | — | — |
| HX | TODO | — | — |

## Ultimo bloco
FF4 — Placa: OUT ASSIGN na API (Pronto + isolamento 404); painel no revendedor com link /avaliar, QR SVG/PNG, URL NFC, baixa estoque; SSR /avaliar → API; test:int ASSIGN + redirect ja existente.

## Proximo
FF5 — Financeiro do revendedor (vendas, lucro, a pagar, ledger).

## Bloqueios / perguntas para o Tarciso
- #5 P6 valores reais
- #6 P25 textos juridicos
- #1 P16 SMTP
- #2 secrets prod + Cloudflare/Traefik
- #3 P21 RAM/KVM
- #4 OK deploy teste pos-M1

## Decisoes assumidas (recomendacao padrao)
- P2/P2a → JWT HS256; P10 → pg-boss; P12 → 404 tenants; P27 → impersonacao read-only
- Marca → opcao C; BR1 pendente de aplicar pack
- FF3: LU1 reduzido a 1 tema (generico); demais nichos no LU1+
