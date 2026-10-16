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
| AW7 | DONE | 6c4db08 | 2026-10-16 |
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
#7 — Páginas jurídicas públicas + aceite (208e23d, Closes #7).

## Proximo
BR1 — Brand pack (aplicar assets já em web/public).

## Bloqueios / perguntas para o Tarciso
_(nenhum dos #1–#6)_

## Decisoes assumidas (recomendacao padrao)
- P2/P2a → JWT HS256; P10 → pg-boss; P12 → 404 tenants; P27 → impersonacao read-only
- Marca → opcao C; BR1 aplicar pack (já em web/public)
- FF3: LU1 reduzido a 1 tema (generico); demais nichos no LU1+
- #4 → deploy teste OK (só push; aprovação manual no environment production)
- #1 → SMTP Resend (`se_smtp_url_v1`)
- #2 → secrets + Cloudflare/Traefik OK
- #5 → precos-v1.md §4 (placa 10000, kit 15000)
- #6 → juridico publicar agora; advogado depois (não bloqueia). Artefato: `producao/juridico-final.tgz`
- #3 → VPS 8G/2vCPU OK para piloto
