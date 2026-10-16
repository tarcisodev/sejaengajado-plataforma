# Restore do Postgres `sejaengajado` (R2 `se-backup`)

## Inventário

| Item | Valor |
| --- | --- |
| Bucket | R2 `se-backup` (lifecycle **30 dias** no bucket — não apagar no script) |
| Objeto | `daily\|weekly\|monthly\|adhoc/sejaengajado_<UTC>_<label>.dump.age` |
| Criptografia | **age** (pubkey no Swarm `se_backup_age_pubkey_v1`; **privkey fora da VPS**) |
| Dump | `pg_dump -Fc` do banco `sejaengajado` com role de backup (BYPASSRLS, só leitura) |
| Serviço | `sejaengajado_backup` (supercronic 03:15 UTC) |

## Backup manual (VPS)

```bash
cid=$(docker ps -q -f name=sejaengajado_backup | head -1)
docker exec "$cid" /usr/local/bin/pg-backup.sh adhoc-manual
```

## Restore de desastre (decisão do Tarciso)

1. Baixar o `.dump.age` (rclone) na máquina com a privkey.
2. `age -d -i age.key -o dump.dump dump.age`
3. Subir Postgres 16 descartável ou restaurar no alvo (janela de manutenção).
4. `pg_restore -d sejaengajado --no-owner --no-acl dump.dump`
5. Validar `sites`, `resellers`, `payments` e smoke `https://app.sejaengajado.com.br/api/health/ready`.

A privkey **não** entra no Swarm nem no Passbolt só-na-VPS sem cópia offsite.

## Restore-test automatizado

- Script: `infra/backup/restore-test.sh`
- Workflow: `.github/workflows/restore-test.yml` (mensal + `workflow_dispatch`)
- Secrets GitHub: `BACKUP_AGE_PRIVKEY`, `RCLONE_CONF_RESTORE` (opcional `HC_RESTORE_URL`)
- Saída: `RESTORE_RTO_SECONDS=<n>` no log / job summary

### RTO medido

| Data (UTC) | Ambiente | Dump | `RESTORE_RTO_SECONDS` | Operador |
| --- | --- | --- | --- | --- |
| 2026-10-15 | ensaio VPS / Postgres descartável | daily/* | **7** | Tarciso |

## Mídia (R2 `sejaengajado-media`)

Objetos de upload ficam no bucket de mídia (versionamento/lifecycle no R2). Restore de Postgres **não** recria blobs — conferir versioning do bucket se um objeto sumir.

## Rollback de deploy vs restore

- Rollback de **código**: Actions → `build-and-deploy` → `workflow_dispatch` com `rollback_tag=<sha>` (mesmo SHA já no GHCR; pula build/migrate). Alternativa no host: `docker service rollback sejaengajado_api` / `sejaengajado_web-ssr` (migrations **não** revertem).
- Restore de **dados**: este runbook (dump `pre-deploy-<sha>` ou daily). Migrations expand/contract não têm “down” em produção.
