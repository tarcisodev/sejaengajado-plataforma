# Checklist de produção (API) — PRODUCAO-02 + PRODUCAO-05 (B1–B7)

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
- [x] **Webhooks Asaas** (PRODUCAO-05 B3): `POST /api/webhooks/asaas` com `asaas-access-token` via `timingSafeEqual` (`ASAAS_WEBHOOK_TOKEN_FILE`); `WebhookEvent` unique; 200 rápido + fila com retries/backoff; reconsulta no gateway antes de mudar estado; máquina de estados; chargeback/estorno via `LedgerService` + fatura OVERDUE; RL por IP-hash + body ≤32kb sanitizado; job de recuperação (lock) para PROCESSING stuck >5 min / FAILED retryable + alerta ao esgotar.
- [x] **Fatura/inadimplência revendedor** (PRODUCAO-05 B4): job mensal idempotente `(resellerId, period)` + `Idempotency-Key`; foto PUBLISHED/READ_ONLY + mensalidade + placas; overdue → DELINQUENT; grace → elegível migração; faixas 7/8/16/60 do cliente direto ficam no JobsService (B14).
- [x] **Cobrança cliente direto** (PRODUCAO-05 B5): Pronto / Pro / renovação / multa via `PaymentGateway`; centavos; ledger só no webhook confirmado; A↔B (site fora da PLATAFORMA → 404).

- [x] **Checkout/faturas no front** (PRODUCAO-05 B6): `POST /api/billing/checkout/pronto`, `GET /api/billing/payments/:id` (polling), `GET /api/reseller/invoices`; web `/conta/checkout` + `/faturas`; centavos só da API; cartão = link Asaas hospedado; JWT via supabase-js interceptor.
- [x] **E2E sandbox** (PRODUCAO-05 B7): `api/test/e2e/mvp.sandbox.spec.ts` (só com `ASAAS_SANDBOX=1`) + `docs/e2e-sandbox.md`; chave via `ASAAS_API_KEY_FILE` local.

## Pendências (PRODUCAO-06)

- [ ] Dockerfiles api/web/backup + stack Swarm (PRODUCAO-06 B1–B2).
- [ ] Inventário de secrets + CI/CD GHCR (PRODUCAO-06 B3–B4).
- [ ] Wildcard produção + backup R2 `se-backup` + restore testado (PRODUCAO-06 B5–B6).
- [ ] Sentry (release=SHA), Uptime/Healthchecks, Traefik HSTS/rate-limit (PRODUCAO-06 B7).
- [ ] Go-live checklist + valores reais PlatformConfig/atacado (⏳P6) (PRODUCAO-06 B8).

