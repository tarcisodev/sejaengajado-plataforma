#!/usr/bin/env bash
# Wait for a Swarm one-off service task to Complete (exit 0) or fail.
set -euo pipefail

svc="${1:?service name}"
timeout="${2:-180}"
t=0

while [ "$t" -lt "$timeout" ]; do
  state="$(docker service ps "$svc" --no-trunc --format '{{.CurrentState}}|{{.Error}}' | head -1 || true)"
  case "$state" in
    Complete*)
      exit 0
      ;;
    Failed*|Rejected*)
      echo "one-off failed: $state" >&2
      docker service logs "$svc" --tail 100 || true
      exit 1
      ;;
  esac
  sleep 3
  t=$((t + 3))
done

echo "timeout waiting for $svc" >&2
docker service logs "$svc" --tail 100 || true
exit 1
