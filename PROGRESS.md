# PROGRESS — Seja Engajado

| Bloco | Status | Commit | Data |
|---|---|---|---|
| IK0 | DONE | d4dc2cc | 2026-10-16 |
| AW2 | DONE | 8b30e2e | 2026-10-16 |
| FF1 | DONE | a36aa8a | 2026-10-16 |
| FF2 | DONE | 3451581 | 2026-10-16 |
| FF3 | DONE | 5c46b3e | 2026-10-16 |
| FF4 | DONE | 0e4d9d5 | 2026-10-16 |
| FF5 | DONE | f34f461 | 2026-10-16 |
| M1 | DONE | 4df0f08 | 2026-10-16 |
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
M1 — seed:demo (precos DEMO), docs/marco-1.md, Playwright happy-path (skip sem E2E_HAPPY_PATH=1), e2e sandbox verde (ALS admin no chargePronto).

## Proximo
**PARE — aguardando OK do Tarciso para o primeiro deploy de teste** (#4). Depois: AW7 → BR1 → … (reordenar pela triagem).

## Bloqueios / perguntas para o Tarciso
- **#4 OK deploy teste pos-M1** ← bloqueia o loop aqui
- #5 P6 valores reais
- #6 P25 textos juridicos
- #1 P16 SMTP
- #2 secrets prod + Cloudflare/Traefik
- #3 P21 RAM/KVM

## Decisoes assumidas (recomendacao padrao)
- P2/P2a → JWT HS256; P10 → pg-boss; P12 → 404 tenants; P27 → impersonacao read-only
- Marca → opcao C; BR1 pendente de aplicar pack
- FF3: LU1 reduzido a 1 tema (generico); demais nichos no LU1+
