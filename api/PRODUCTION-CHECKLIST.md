# Checklist de produção (API) — PRODUCAO-02 B16

Base: `producao/contrib-nucleo.md` (Bloco 17), com `/health/ready` e mesma origem (sem CORS).

## Feito neste repositório (API)

- [x] Config validada (zod); segredos via `*_FILE` / Docker secrets; `.env.example` completo.
- [x] `npm run migrate:deploy` (= `prisma migrate deploy`) manual; sem `db push` no fluxo.
- [x] Usuário de app sem `BYPASSRLS`; RLS + client ADMIN separado (testes int).
- [x] `/api/health` e `/api/health/ready` (prontidão com probe de DB).
- [x] Logs pino JSON com redact; helmet; rate limit Nest (`ThrottlerGuard`); body limit 100kb; sem CORS.
- [x] Auth Supabase JWT; ADMIN + `aal2`; role/reseller do DB.
- [x] Matriz RBAC + A↔B + RLS nos testes de integração (CI).
- [x] `LedgerEntry` / `PlaqueMovement` / `AuditLog` append-only (triggers + testes).
- [x] Estoque com advisory lock + teste de concorrência.
- [x] Jobs idempotentes com lock + heartbeat (`HC_JOBS_URL` / `se_hc_jobs_url`).
- [x] Dinheiro em centavos `Int` + `npm run lint:money` (bloqueia `parseFloat`/`Decimal`).
- [x] OpenAPI em `/api/docs` e `/api/docs-json` (erros com `fields`, paginação, Idempotency-Key).
- [x] Dockerfile multi-stage não-root + entrypoint `DATABASE_URL_FILE` (e demais `*_FILE`).

## Pendências (fora do escopo B16 / outros prompts)

- [ ] Webhook Asaas: token, unique, fila, retries, reconsulta (PRODUCAO-05).
- [ ] Sentry com release = SHA (PRODUCAO-06).
- [ ] Rate limit Traefik + HSTS no edge (PRODUCAO-06).
- [ ] Backups/restore (PRODUCAO-06).
- [ ] Valores reais de `PlatformConfig` e atacado (⏳P6, admin antes do go-live).
- [ ] Cobertura unitária ≥ 90% em sales/ledger/stock/jobs/tenant (hoje a suíte int cobre os caminhos críticos; `npm run test:cov` reporta o buraco unitário — ampliar testes unitários ou unificar coverage unit+int).
