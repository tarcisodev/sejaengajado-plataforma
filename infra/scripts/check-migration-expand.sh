#!/usr/bin/env bash
# Fail if new migration SQL looks like a "contract" (DROP/RENAME) without expand/contract review.
# Expand-only releases: ADD COLUMN nullable/default, CREATE TABLE/INDEX.
#
# Baseline: migrations já aplicadas em produção até 20261015250000 (inclusive) são
# ignoradas — o check só avalia pastas posteriores, inclusive em workflow_dispatch.
#
# DROP POLICY IF EXISTS + CREATE POLICY na mesma migration = recriação de política
# (não é contract DDL) e é aceito.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
mig_dir="$root/api/prisma/migrations"
# Última migration aplicada em produção (inclusive). Só checa timestamps > este.
BASELINE_TS="${MIGRATION_EXPAND_BASELINE:-20261015250000}"

if [ ! -d "$mig_dir" ]; then
  echo "no migrations dir" >&2
  exit 0
fi

migration_ts() {
  # api/prisma/migrations/20261015260000_foo/migration.sql → 20261015260000
  local dir
  dir="$(basename "$(dirname "$1")")"
  echo "${dir%%_*}"
}

after_baseline() {
  local ts
  ts="$(migration_ts "$1")"
  [[ "$ts" =~ ^[0-9]+$ ]] || return 1
  [ "$ts" -gt "$BASELINE_TS" ]
}

# When BASE_REF is set, only check newly added migration SQL; otherwise all folders
# after the production baseline (workflow_dispatch / local).
base="${BASE_REF:-}"
candidates=()
if [ -n "$base" ] && git -C "$root" rev-parse --verify "$base" >/dev/null 2>&1; then
  while IFS= read -r f; do
    [ -n "$f" ] && candidates+=("$f")
  done < <(git -C "$root" diff --name-only --diff-filter=A "$base"...HEAD -- 'api/prisma/migrations/**/*.sql' || true)
else
  while IFS= read -r f; do
    candidates+=("$f")
  done < <(find "$mig_dir" -name 'migration.sql' -type f | sort)
fi

files=()
for f in "${candidates[@]+"${candidates[@]}"}"; do
  path="$f"
  case "$path" in
    /*) ;;
    *) path="$root/$f" ;;
  esac
  if after_baseline "$path"; then
    files+=("$path")
  fi
done

if [ "${#files[@]}" -eq 0 ]; then
  echo "check-migration-expand: no post-baseline migration SQL (baseline=${BASELINE_TS})"
  exit 0
fi

bad=0
for path in "${files[@]}"; do
  rel="${path#"$root"/}"
  # Strip line comments.
  body="$(grep -Eiv '^\s*--' "$path" || true)"
  # Recreate policy: DROP POLICY IF EXISTS + CREATE POLICY in the same file is OK.
  if printf '%s\n' "$body" | grep -Eiq 'DROP[[:space:]]+POLICY[[:space:]]+IF[[:space:]]+EXISTS' \
    && printf '%s\n' "$body" | grep -Eiq 'CREATE[[:space:]]+POLICY'; then
    body="$(printf '%s\n' "$body" | grep -Eiv 'DROP[[:space:]]+POLICY[[:space:]]+IF[[:space:]]+EXISTS' || true)"
  fi
  if printf '%s\n' "$body" | grep -Eiq '\b(DROP|RENAME)\b'; then
    echo "blocked contract DDL in $rel (DROP/RENAME). Use expand/contract across releases." >&2
    bad=1
  fi
done

if [ "$bad" -ne 0 ]; then
  exit 1
fi

echo "check-migration-expand: ok (baseline=${BASELINE_TS})"
