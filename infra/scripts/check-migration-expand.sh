#!/usr/bin/env bash
# Fail if new migration SQL looks like a "contract" (DROP/RENAME) without expand/contract review.
# Expand-only releases: ADD COLUMN nullable/default, CREATE TABLE/INDEX. No DROP/RENAME in the same PR.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
mig_dir="$root/api/prisma/migrations"

if [ ! -d "$mig_dir" ]; then
  echo "no migrations dir" >&2
  exit 0
fi

# When BASE_REF is set (PR), only check new files; otherwise scan all (local).
base="${BASE_REF:-}"
files=()
if [ -n "$base" ] && git -C "$root" rev-parse --verify "$base" >/dev/null 2>&1; then
  while IFS= read -r f; do
    [ -n "$f" ] && files+=("$f")
  done < <(git -C "$root" diff --name-only --diff-filter=A "$base"...HEAD -- 'api/prisma/migrations/**/*.sql' || true)
else
  while IFS= read -r f; do
    files+=("$f")
  done < <(find "$mig_dir" -name '*.sql' -type f)
fi

if [ "${#files[@]}" -eq 0 ]; then
  echo "check-migration-expand: no new migration SQL"
  exit 0
fi

bad=0
for f in "${files[@]}"; do
  path="$f"
  case "$path" in
    /*) ;;
    *) path="$root/$f" ;;
  esac
  # Strip line comments then look for destructive DDL.
  if grep -Eiv '^\s*--' "$path" | grep -Eiq '\b(DROP|RENAME)\b'; then
    echo "blocked contract DDL in $f (DROP/RENAME). Use expand/contract across releases." >&2
    bad=1
  fi
done

if [ "$bad" -ne 0 ]; then
  exit 1
fi

echo "check-migration-expand: ok"
