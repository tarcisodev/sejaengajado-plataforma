# Observabilidade (PRODUCAO-06 B7)

## Sentry

- API (`@sentry/nestjs`) + web SSR (`@sentry/node`) + browser (`@sentry/angular`)
- `release` = SHA (`SENTRY_RELEASE` / `IMAGE_TAG` no stack)
- DSN só via `SENTRY_DSN_FILE` → secret `se_sentry_dsn_v1` (browser lê `/se-public-config.json` servido pelo SSR)
- `sendDefaultPii: false` + scrub de e-mail, IP, tokens/headers

## Health

| Endpoint | Função |
| --- | --- |
| `GET /api/health` | Liveness (Swarm healthcheck do container) |
| `GET /api/health/ready` | DB (`SELECT 1`) + R2 `HeadBucket` (Traefik LB) |
| `GET /healthz` | Liveness do SSR |

## Healthchecks.io

| Check | Fonte |
| --- | --- |
| `se-pg-backup-daily` | `infra/backup/pg-backup.sh` (`se_hc_backup_url_v1`) |
| `se-restore-monthly` | `restore-test.yml` (`HC_RESTORE_URL`) |
| `se-jobs` | `JobsService.heartbeat` (`se_hc_jobs_url_v1`) |
| `vps-host` | `infra/scripts/host-check.sh` (`HC_HOST_URL` / `*_FILE`) |

Cron host (VPS, não no Swarm):

```bash
# /etc/cron.d/se-host-check
*/5 * * * * root HC_HOST_URL_FILE=/root/se-hc-host-url infra/scripts/host-check.sh
```

## UptimeRobot (externo)

Monitores sugeridos (keyword `ok` onde couber) + alerta de certificado ≤14 dias:

- `https://sejaengajado.com.br`
- `https://app.sejaengajado.com.br`
- `https://app.sejaengajado.com.br/api/health/ready`
- `https://teste.sejaengajado.com.br`

## Traefik

- Middleware `se-headers` (HSTS 1y + subdomains, nosniff, frameDeny, referrer)
- `se-ratelimit` nos routers públicos; `se-ratelimit-strict` em `/api/webhooks` e rotas de auth
- Log level INFO no serviço Traefik do host (fora deste repo)
