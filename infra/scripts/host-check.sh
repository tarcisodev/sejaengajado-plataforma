#!/usr/bin/env bash
# Host probe (read-only): RAM, disco, certs locais ACME, serviços Swarm.
# Ping Healthchecks.io (vps-host) só quando OK. Cron sugerido: */5.
# URL: HC_HOST_URL ou HC_HOST_URL_FILE (secret se_hc_host_url_v1 no host, não no Swarm app).
set -euo pipefail

HC_FILE="${HC_HOST_URL_FILE:-}"
HC_URL="${HC_HOST_URL:-}"
if [ -z "$HC_URL" ] && [ -n "$HC_FILE" ] && [ -f "$HC_FILE" ]; then
  HC_URL="$(tr -d '\r\n' < "$HC_FILE")"
fi
if [ -z "$HC_URL" ]; then
  echo "HC_HOST_URL ou HC_HOST_URL_FILE obrigatório" >&2
  exit 2
fi

MIN_RAM_MIB="${HOST_CHECK_MIN_RAM_MIB:-300}"
MAX_DISK_PCT="${HOST_CHECK_MAX_DISK_PCT:-85}"
STACK="${HOST_CHECK_STACK:-sejaengajado}"
# Volume Swarm dos certificados Traefik nesta VPS (override com HOST_CHECK_ACME_CF).
ACME_CF="${HOST_CHECK_ACME_CF:-/var/lib/docker/volumes/volume_swarm_certificates/_data/acme-cf.json}"

avail="$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)"
disk="$(df --output=pcent / | tail -1 | tr -d ' %')"
reasons=()

if [ "${avail:-0}" -le "$MIN_RAM_MIB" ]; then
  reasons+=("mem=${avail}MiB<=${MIN_RAM_MIB}")
fi
if [ "${disk:-100}" -ge "$MAX_DISK_PCT" ]; then
  reasons+=("disk=${disk}%>=${MAX_DISK_PCT}")
fi

# Serviços do stack (réplicas desejadas vs em execução)
missing=0
while IFS= read -r line; do
  name="$(echo "$line" | awk '{print $1}')"
  reps="$(echo "$line" | awk '{print $2}')"
  case "$reps" in
    */*)
      cur="${reps%%/*}"
      want="${reps##*/}"
      if [ "$cur" != "$want" ] && [ "$want" != "0" ]; then
        reasons+=("svc:${name}=${reps}")
        missing=$((missing + 1))
      fi
      ;;
  esac
done < <(docker service ls --format '{{.Name}} {{.Replicas}}' 2>/dev/null | grep "^${STACK}_" || true)

# Cert / ACME storage presente e não vazio (não altera DNS nem Traefik)
if [ -f "$ACME_CF" ]; then
  size="$(wc -c < "$ACME_CF" | tr -d ' ')"
  if [ "${size:-0}" -lt 64 ]; then
    reasons+=("acme-cf-too-small")
  fi
else
  reasons+=("acme-cf-missing")
fi

# Expiração do cert público (read-only openssl) — app.
if command -v openssl >/dev/null 2>&1; then
  end_date="$(
    echo | openssl s_client -servername app.sejaengajado.com.br \
      -connect app.sejaengajado.com.br:443 2>/dev/null \
      | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || true
  )"
  if [ -n "$end_date" ]; then
    end_epoch="$(date -d "$end_date" +%s 2>/dev/null || true)"
    now_epoch="$(date +%s)"
    if [ -n "$end_epoch" ]; then
      days=$(( (end_epoch - now_epoch) / 86400 ))
      if [ "$days" -lt 14 ]; then
        reasons+=("cert-days=${days}")
      fi
    fi
  fi
fi

detail="mem=${avail}MiB disk=${disk}% missing_svc=${missing}"
if [ "${#reasons[@]}" -eq 0 ]; then
  curl -fsS -m 10 --retry 2 "$HC_URL" >/dev/null
  echo "ok ${detail}"
  exit 0
fi

msg="$(IFS=','; echo "${reasons[*]}")"
curl -fsS -m 10 --retry 2 --data-raw "${detail} ${msg}" "${HC_URL}/fail" >/dev/null || true
echo "fail ${detail} ${msg}" >&2
exit 1
