# Inventário de secrets (só nomes — nunca valores)

Swarm single-node. Secrets no Docker (`/run/secrets`, raft cifrado) + cópia no **Passbolt** e fora da VPS.

## Já existentes na VPS

| Nome Docker | Uso |
| --- | --- |
| `se_supabase_jwt_secret_v1` | JWT HS256 (= `GOTRUE_JWT_SECRET` do Supabase, P2a) → `SUPABASE_JWT_SECRET_FILE` |
| `se_s3_access_key_v1` | R2 access key → `S3_ACCESS_KEY_FILE` |
| `se_s3_secret_key_v1` | R2 secret key → `S3_SECRET_KEY_FILE` |

## A criar (quando for deployar — não agora)

Criação sem rastro no shell history:

```bash
read -rs V && printf '%s' "$V" | docker secret create <nome> - && unset V
```

| Nome | Uso | Notas |
| --- | --- | --- |
| `cf_dns_api_token_v1` | Traefik `cfdns` (DNS challenge Cloudflare) | Zone DNS Edit + Zone Read; só no stack Traefik |
| `se_database_url_v1` | Prisma app (`se_app`, sem BYPASSRLS) → `DATABASE_URL_FILE` | Banco `sejaengajado` no Postgres do Supabase |
| `se_admin_database_url_v1` | Prisma admin (`se_admin`, BYPASSRLS) → `ADMIN_DATABASE_URL_FILE` | Só caminhos ADMIN / SYSTEM |
| `se_backup_database_url_v1` | `pg_dump` role só leitura + `BYPASSRLS` | Nunca a role da app |
| `se_supabase_service_role_key_v1` | Admin Auth API → `SUPABASE_SERVICE_ROLE_KEY_FILE` | |
| `se_smtp_url_v1` | Avisos/jobs e-mail → `SMTP_URL_FILE` | |
| `se_asaas_api_key_v1` | Asaas (produção no go-live) → `ASAAS_API_KEY_FILE` | Sandbox só local via arquivo |
| `se_asaas_webhook_token_v1` | Header `asaas-access-token` → `ASAAS_WEBHOOK_TOKEN_FILE` | |
| `se_backup_age_pubkey_v1` | age recipient do dump | Privkey só fora da VPS / GitHub restore |
| `se_rclone_conf_v1` | rclone → R2 `se-backups` | |
| `se_hc_backup_url_v1` | Healthchecks ping backup diário | |
| `se_hc_jobs_url_v1` | Healthchecks ping jobs Nest | |
| `se_sentry_dsn_v1` | Sentry API/SSR → `SENTRY_DSN_FILE` | |

### GitHub Secrets (só restore-test, runner hosted)

| Nome | Uso |
| --- | --- |
| `BACKUP_AGE_PRIVKEY` | Decriptar dump no restore-test mensal |
| `RCLONE_CONF_RESTORE` | rclone read-only para baixar do R2 |

## Rotação `_vN`

1. Criar `*_v2` com o novo valor (`docker secret create …_v2`).
2. Atualizar `infra/stack.yml` (`name: …_v2`) e `docker stack deploy` (sem downtime se o serviço aceitar o novo mount).
3. Após validar, `docker secret rm …_v1`.
4. Atualizar Passbolt + cópia offsite.
5. Nunca reutilizar o mesmo nome com valor diferente (Docker secrets são imutáveis).

## O que NÃO é secret

- `SUPABASE_URL`, `ASAAS_BASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_BACKUP_BUCKET`, `S3_REGION`, `ENABLE_DOCS` — env públicas no `stack.yml`.
- Certresolver Traefik: **`cfdns`** (DNS Cloudflare, wildcard/produção). **`letsencryptresolver`** = HTTP challenge (outros stacks; não usar neste).
