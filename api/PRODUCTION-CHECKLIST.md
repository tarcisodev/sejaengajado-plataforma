# Checklist de produção (API) — PRODUCAO-02 + PRODUCAO-05 (B1–B2)

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
- [x] OpenAPI em `/api/docs` e `/api/docs-json` — **desligado em produção** (`ENABLE_DOCS` default `false`; `shouldEnableDocs` força off quando `NODE_ENV=production`).
- [x] Dockerfile multi-stage não-root + entrypoint `DATABASE_URL_FILE` (e demais `*_FILE`).
- [x] Cobertura unitária ≥ 90% unificada (Jest `coverageThreshold.global`) em auth (context/guards), ledger, stock, sales, jobs (penalty/overdue-days) e tenant.context — `npm run test:cov`.
- [x] **Storage R2 (documentado):** `S3_ENDPOINT` (placeholder, sem account id no example), `S3_REGION=auto`, `S3_BUCKET=se-uploads`, `S3_BACKUP_BUCKET=se-backup`, `S3_ACCESS_KEY_FILE=/run/secrets/se_s3_access_key_v1`, `S3_SECRET_KEY_FILE=/run/secrets/se_s3_secret_key_v1`.
- [x] **PaymentGateway port + FakeGateway** (PRODUCAO-05 B1); lint de fronteira `lint:payments-boundary` (domínio não importa `adapters/asaas`).
- [x] **Adapter Asaas sandbox** (PRODUCAO-05 B2): `ASAAS_BASE_URL`, chave só via `ASAAS_API_KEY_FILE`, Idempotency-Key nas cobranças/assinaturas/refund, retries só em GET/idempotentes, logs sem payload sensível; testes nock + contrato.

## Pendências (PRODUCAO-05 restante / PRODUCAO-06)

- [ ] Webhook Asaas: token, unique, fila, retries, reconsulta (PRODUCAO-05 B3).
- [ ] Fatura/inadimplência revendedor + cobrança cliente direto (PRODUCAO-05 B4–B5).
- [ ] Checkout/faturas no web + e2e sandbox (PRODUCAO-05 B6–B7).
- [ ] Sentry com release = SHA (PRODUCAO-06).
- [ ] Rate limit Traefik + HSTS no edge (PRODUCAO-06).
- [ ] Backups/restore no bucket `se-backup` (PRODUCAO-06).
- [ ] Valores reais de `PlatformConfig` e atacado (⏳P6, admin antes do go-live).
