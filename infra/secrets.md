# Inventário de secrets (só nomes — nunca valores)

Swarm single-node. Secrets no Docker (`/run/secrets`, raft cifrado) + cópia no **Passbolt** e fora da VPS.

Auth dedicado (`auth.sejaengajado.com.br`, stack `se-auth`): secrets `se_auth_*_v1`.  
Os mounts internos do stack `sejaengajado` continuam `se_supabase_jwt_secret` / `se_supabase_service_role_key` (código/`*_FILE`), mas apontam para os nomes externos `se_auth_*_v1`.

## Auth (`se-auth` + app)

| Nome Docker | Uso |
| --- | --- |
| `se_auth_jwt_secret_v1` | JWT HS256 (= `GOTRUE_JWT_SECRET`) → stack `se-auth` + mount interno `se_supabase_jwt_secret` → `SUPABASE_JWT_SECRET_FILE` |
| `se_auth_db_url_v1` | Postgres URL da role `se_auth` (schema `auth`) → `GOTRUE_DB_DATABASE_URL` no GoTrue |
| `se_auth_service_role_key_v1` | Admin Auth API → mount interno `se_supabase_service_role_key` → `SUPABASE_SERVICE_ROLE_KEY_FILE` |
| `se_auth_anon_key_v1` | Anon key pública (Passbolt / env deploy `SUPABASE_ANON_KEY` no `web-ssr`) | Não montar no browser via secret Swarm |

### Aposentados (não criar / não usar em deploy novo)

| Nome antigo | Substituto |
| --- | --- |
| `se_supabase_jwt_secret_v1` | `se_auth_jwt_secret_v1` |
| `se_supabase_service_role_key_v1` | `se_auth_service_role_key_v1` |

Após o cutover, `docker secret rm` dos nomes aposentados quando nenhum stack os referenciar.

## Já existentes na VPS (outros)

| Nome Docker | Uso |
| --- | --- |
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
| `se_database_url_v1` | Prisma app (`se_app`, sem BYPASSRLS) → `DATABASE_URL_FILE` | Host Postgres na `TarcisoDevNet` |
| `se_admin_database_url_v1` | Prisma admin (`se_admin`, BYPASSRLS) → `ADMIN_DATABASE_URL_FILE` | BYPASSRLS via bootstrap superuser |
| `se_backup_database_url_v1` | `pg_dump` role só leitura + `BYPASSRLS` | Nunca a role da app; bootstrap em `db-bootstrap-roles.md` |
| `se_auth_jwt_secret_v1` | Ver tabela Auth | Compartilhado GoTrue ↔ API |
| `se_auth_db_url_v1` | Ver tabela Auth | Só stack `se-auth` |
| `se_auth_service_role_key_v1` | Ver tabela Auth | API Nest |
| `se_auth_anon_key_v1` | Ver tabela Auth | Env/Passbolt; browser via `/se-public-config.json` |
| `se_smtp_url_v1` | Avisos/jobs + GoTrue SMTP → `SMTP_URL_FILE` / parse no `se-auth` | |
| `se_asaas_api_key_v1` | Asaas (produção no go-live) → `ASAAS_API_KEY_FILE` | Sandbox só local via arquivo |
| `se_asaas_webhook_token_v1` | Header `asaas-access-token` → `ASAAS_WEBHOOK_TOKEN_FILE` | |
| `se_backup_age_pubkey_v1` | age recipient do dump | Privkey só fora da VPS / GitHub restore |
| `se_rclone_conf_v1` | rclone → R2 `se-backup` (lifecycle 30d no bucket) | |
| `se_hc_backup_url_v1` | Healthchecks ping backup diário | |
| `se_hc_jobs_url_v1` | Healthchecks ping jobs Nest | |
| `se_sentry_dsn_v1` | Sentry API + web SSR/browser → `SENTRY_DSN_FILE` | Mesmo secret montado em `api` e `web-ssr` |
| `se_hc_host_url_v1` | (host, não Swarm) URL ping `vps-host` → `HC_HOST_URL_FILE` no cron | Só no host; ver `infra/scripts/host-check.sh` |

### GitHub Secrets (só restore-test / CI — nunca no Swarm)

| Nome | Uso |
| --- | --- |
| `BACKUP_AGE_PRIVKEY` | Decriptar dump no restore-test mensal (hosted) |
| `RCLONE_CONF_RESTORE` | rclone read-only para baixar do R2 `se-backup` |
| `HC_RESTORE_URL` | (opcional) ping Healthchecks do restore-test |

Deploy (`.github/workflows/deploy.yml`) usa **apenas** `secrets.GITHUB_TOKEN` para login GHCR.  
`SUPABASE_ANON_KEY` (se usado) vem de **GitHub Environment variable** / Passbolt (`se_auth_anon_key_v1`), não de Docker secret no workflow.

## Rotação `_vN`

1. Criar `*_v2` com o novo valor (`docker secret create …_v2`).
2. Atualizar `infra/stack.yml` / `infra/auth/se-auth.yml` (`name: …_v2`) e `docker stack deploy` (sem downtime se o serviço aceitar o novo mount).
3. Após validar, `docker secret rm …_v1`.
4. Atualizar Passbolt + cópia offsite.
5. Nunca reutilizar o mesmo nome com valor diferente (Docker secrets são imutáveis).
6. `se_auth_jwt_secret` e as JWT keys (anon/service_role) precisam rotacionar **juntos** (mesmo material no GoTrue e na API).

## O que NÃO é secret

- `SUPABASE_URL` (`https://auth.sejaengajado.com.br`), `ASAAS_BASE_URL` (env deploy; default sandbox), `S3_ENDPOINT` (env deploy com account id R2), `S3_BUCKET`, `S3_BACKUP_BUCKET`, `S3_REGION`, `ENABLE_DOCS` — não são Docker secrets.
- Certresolver Traefik: **`cfdns`** (DNS Cloudflare, wildcard/produção). **`letsencryptresolver`** = HTTP challenge (outros stacks; não usar neste).
- Roles BYPASSRLS: passo único `infra/runbooks/db-bootstrap-roles.md` (não nas migrations).
