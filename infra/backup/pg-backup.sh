#!/bin/sh
# Daily dump of banco `sejaengajado` (Supabase Postgres) → age → rclone r2:se-backups.
# Role de backup: só leitura + BYPASSRLS (nunca a role da app). Valores só via *_FILE.
set -eu

DB_URL_FILE="${BACKUP_DATABASE_URL_FILE:-/run/secrets/se_backup_database_url}"
AGE_PUB_FILE="${BACKUP_AGE_PUBKEY_FILE:-/run/secrets/se_backup_age_pubkey}"
RCLONE_CONF="${RCLONE_CONFIG:-/run/secrets/se_rclone_conf}"
HC_FILE="${HC_BACKUP_URL_FILE:-/run/secrets/se_hc_backup_url}"
REMOTE="${BACKUP_RCLONE_REMOTE:-r2:se-backups}"
MIN_BYTES="${BACKUP_MIN_BYTES:-1024}"

DB_URL="$(tr -d '\r\n' < "$DB_URL_FILE")"
AGE_PUB="$(tr -d '\r\n' < "$AGE_PUB_FILE")"
export RCLONE_CONFIG="$RCLONE_CONF"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
day="$(date -u +%Y-%m-%d)"
object="${REMOTE}/daily/${day}/sejaengajado-${stamp}.dump.age"

HC_URL=""
if [ -f "$HC_FILE" ]; then
  HC_URL="$(tr -d '\r\n' < "$HC_FILE")"
  curl -fsS "${HC_URL}/start" >/dev/null || true
fi

tmp="/tmp/sejaengajado-${stamp}.dump"
trap 'rm -f "$tmp" "$tmp.age"' EXIT

pg_dump -Fc --dbname="$DB_URL" -f "$tmp"
size="$(wc -c < "$tmp" | tr -d ' ')"
if [ "$size" -lt "$MIN_BYTES" ]; then
  echo "backup too small: ${size} bytes" >&2
  [ -n "$HC_URL" ] && curl -fsS "${HC_URL}/fail" >/dev/null || true
  exit 1
fi

age -r "$AGE_PUB" -o "$tmp.age" "$tmp"
rclone copyto "$tmp.age" "$object"

# Retenção simples (rclone delete older) — detalhe fino no B6.
rclone delete "${REMOTE}/daily" --min-age 8d 2>/dev/null || true

[ -n "$HC_URL" ] && curl -fsS "$HC_URL" >/dev/null || true
echo "ok ${object} (${size} bytes)"
