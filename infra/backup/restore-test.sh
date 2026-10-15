#!/usr/bin/env bash
# Restore test em Postgres descartável. Chave privada age NUNCA no VPS —
# rode no GitHub-hosted (restore-test.yml) ou na máquina do Tarciso.
# Registra duração (RTO) em stdout e em RESTORE_RTO_SECONDS.
set -euo pipefail

REMOTE="${BACKUP_RCLONE_REMOTE:-r2:se-backup}"
PREFIX="${BACKUP_RESTORE_PREFIX:-daily}"
AGE_PRIV="${BACKUP_AGE_PRIVKEY_FILE:-${BACKUP_AGE_PRIVKEY:-}}"
RCLONE_CONF="${RCLONE_CONFIG:-}"
HC_URL="${HC_RESTORE_URL:-}"
CONTAINER="${RESTORE_CONTAINER_NAME:-se-restore-test}"
PGIMAGE="${RESTORE_PG_IMAGE:-postgres:16-alpine}"
WORKDIR="${RESTORE_WORKDIR:-/tmp/se-restore-$$}"

if [ -z "$AGE_PRIV" ] || [ ! -f "$AGE_PRIV" ]; then
  echo "BACKUP_AGE_PRIVKEY_FILE (ou path) obrigatório — chave privada fora da VPS" >&2
  exit 1
fi
if [ -n "$RCLONE_CONF" ]; then
  export RCLONE_CONFIG="$RCLONE_CONF"
fi

mkdir -p "$WORKDIR"
dump_age="$WORKDIR/latest.dump.age"
dump_plain="$WORKDIR/latest.dump"
start_ts="$(date +%s)"

cleanup() {
  code=$?
  if [ "$code" -ne 0 ] && [ -n "$HC_URL" ]; then
    curl -fsS -m 10 --retry 3 "${HC_URL}/fail" >/dev/null || true
  fi
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

if [ -n "$HC_URL" ]; then
  curl -fsS -m 10 --retry 3 "${HC_URL}/start" >/dev/null || true
fi

echo "listando ${REMOTE}/${PREFIX}/ ..."
latest="$(rclone lsf "${REMOTE}/${PREFIX}/" --files-only | sort | tail -1)"
if [ -z "$latest" ]; then
  echo "nenhum dump em ${REMOTE}/${PREFIX}/" >&2
  exit 1
fi
echo "restaurando ${latest}"

rclone copyto "${REMOTE}/${PREFIX}/${latest}" "$dump_age"
age -d -i "$AGE_PRIV" -o "$dump_plain" "$dump_age"

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
  -m 384m \
  -e POSTGRES_PASSWORD=throwaway \
  "$PGIMAGE" >/dev/null

for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 2
done
docker exec "$CONTAINER" pg_isready -U postgres

# Restaura o custom-format (-Fc) num DB novo.
docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS sejaengajado;"
docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE sejaengajado;"
docker exec -i "$CONTAINER" pg_restore -U postgres -d sejaengajado --no-owner --no-acl < "$dump_plain" \
  || true
# pg_restore pode retornar 1 com avisos; validamos com queries.

docker exec "$CONTAINER" psql -U postgres -d sejaengajado -v ON_ERROR_STOP=1 -tAc \
  "SELECT to_regclass('public.sites') IS NOT NULL
      AND to_regclass('public.resellers') IS NOT NULL
      AND to_regclass('public.payments') IS NOT NULL;" | grep -q t

sites="$(docker exec "$CONTAINER" psql -U postgres -d sejaengajado -tAc 'SELECT count(*) FROM sites;')"
resellers="$(docker exec "$CONTAINER" psql -U postgres -d sejaengajado -tAc 'SELECT count(*) FROM resellers;')"
echo "rows sites=${sites} resellers=${resellers}"

end_ts="$(date +%s)"
RESTORE_RTO_SECONDS=$((end_ts - start_ts))
export RESTORE_RTO_SECONDS
echo "RESTORE_RTO_SECONDS=${RESTORE_RTO_SECONDS}"

if [ -n "$HC_URL" ]; then
  curl -fsS -m 10 --retry 3 "$HC_URL" >/dev/null || true
fi

echo "restore-test ok (${latest}) RTO=${RESTORE_RTO_SECONDS}s"
