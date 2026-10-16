#!/usr/bin/env bash
# Cria/atualiza labels do labels.yml no repo atual (ou: REPO=owner/repo ./labels.sh). Idempotente (--force).
set -euo pipefail
cd "$(dirname "$0")"
R=${REPO:+--repo "$REPO"}
grep -E '^- \{' labels.yml | sed -E 's/^- \{name: "([^"]+)", *color: "([^"]+)", *description: "([^"]*)"\}.*/\1|\2|\3/' |
while IFS='|' read -r n c d; do gh label create "$n" --color "$c" --description "$d" --force $R; done
