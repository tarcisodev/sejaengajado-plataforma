#!/bin/sh
# Dump do banco `sejaengajado` (Postgres do Supabase) → age → rclone r2:se-backup.
# Role de backup: só leitura + BYPASSRLS (nunca se_app). Valores só via *_FILE.
# Retenção: lifecycle 30 dias já configurado no bucket R2 — sem delete no script.
set -eu

LABEL="${1:-daily}"
DB_URL_FILE="${BACKUP_DATABASE_URL_FILE:-/run/secrets/se_backup_database_url}"
AGE_PUB_FILE="${BACKUP_AGE_PUBKEY_FILE:-/run/secrets/se_backup_age_pubkey}"
RCLONE_CONF="${RCLONE_CONFIG:-/run/secrets/se_rclone_conf}"
HC_FILE="${HC_BACKUP_URL_FILE:-/run/secrets/se_hc_backup_url}"
REMOTE="${BACKUP_RCLONE_REMOTE:-r2:se-backup}"
MIN_BYTES="${BACKUP_MIN_BYTES:-1024}"

DB_URL="$(tr -d '\r\n' < "$DB_URL_FILE")"
AGE_PUB="$(tr -d '\r\n' < "$AGE_PUB_FILE")"
export RCLONE_CONFIG="$RCLONE_CONF"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dow="$(date -u +%u)"
dom="$(date -u +%d)"
prefix=daily
[ "$dow" = "7" ] && prefix=weekly
[ "$dom" = "01" ] && prefix=monthly
[ "$LABEL" != "daily" ] && prefix=adhoc

object="${REMOTE}/${prefix}/sejaengajado_${stamp}_${LABEL}.dump.age"

HC_URL=""
if [ -f "$HC_FILE" ]; then
  HC_URL="$(tr -d '\r\n' < "$HC_FILE")"
  curl -fsS -m 10 --retry 3 "${HC_URL}/start" >/dev/null || true
fi

tmp="/tmp/sejaengajado-${stamp}.dump"
trap 'rm -f "$tmp" "$tmp.age"' EXIT HUP INT TERM
if [ -n "$HC_URL" ]; then
  trap 'curl -fsS -m 10 --retry 3 "${HC_URL}/fail" >/dev/null || true; rm -f "$tmp" "$tmp.age"' ERR
fi

# -Fc custom format; stream → age → rclone (sem gravar plaintext no disco por muito tempo)
pg_dump -Fc -Z 6 --dbname="$DB_URL" -f "$tmp"
size="$(wc -c < "$tmp" | tr -d ' ')"
if [ "$size" -lt "$MIN_BYTES" ]; then
  echo "backup too small: ${size} bytes" >&2
  exit 1
fi

age -r "$AGE_PUB" -o "$tmp.age" "$tmp"
rclone copyto "$tmp.age" "$object" --s3-no-check-bucket

remote_size="$(rclone size "$object" --json 2>/dev/null | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p' || echo 0)"
if [ "${remote_size:-0}" -lt "$MIN_BYTES" ]; then
  echo "remote dump suspeito: ${remote_size} bytes" >&2
  exit 1
fi

if [ -n "$HC_URL" ]; then
  curl -fsS -m 10 --retry 3 "$HC_URL" >/dev/null || true
fi
echo "ok ${object} local=${size}B remote=${remote_size}B"
