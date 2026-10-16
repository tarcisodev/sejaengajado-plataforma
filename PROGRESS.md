# PROGRESS — Seja Engajado

| Bloco | Status | Commit | Data |
|---|---|---|---|
| IK0 | DONE | — | 2026-10-16 |
| AW2 | DONE | 8b30e2e | 2026-10-16 |
| FF1 | TODO | — | — |
| FF2 | TODO | — | — |
| FF3 | TODO | — | — |
| FF4 | TODO | — | — |
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
IK0 — Kit de issues: templates `.github/ISSUE_TEMPLATE/`, `TRIAGEM.md`, `AGENTS.md`, `labels.ps1` (labels criadas via gh). Issues bloqueadas #1–#6 (P16, P20/P22, P21, deploy M1, P6, P25). Marca C decidida → BR1 desbloqueado.

AW6 (já em master local): admin revendedores/atacado/placas + ApiPort (`379005c`).

## Proximo
FF1 — Admin cria revendedor → convite → revendedor entra por OTP (+MFA). Origem 04-B2.

## Bloqueios / perguntas para o Tarciso
- #5 P6 valores reais (placeholders DEMO até lá)
- #6 P25 textos jurídicos (bloqueia go-live)
- #1 P16 SMTP
- #2 secrets prod + Cloudflare/Traefik
- #3 P21 RAM/KVM
- #4 OK deploy teste pós-M1
- Push ok; deploy só com aprovação manual no environment production

## Decisoes assumidas (recomendacao padrao)
- P2/P2a → JWT HS256 com secret (já no código); sem JWKS
- P10 → pg-boss (já no código)
- P12 → 404 entre tenants
- P27 → impersonação somente leitura com audit
- Marca → opção C (S com faísca); BR1 usa pack em `web/public` + `brand/cursor-prompt-logo.md`
