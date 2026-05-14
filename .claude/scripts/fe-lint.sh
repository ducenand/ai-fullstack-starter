#!/usr/bin/env bash
set -euo pipefail

# Only run when frontend source files changed.
DIFF=$(git diff HEAD --name-only 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)
FE=$(echo "$DIFF" | grep '^apps/web/src/' || true)
[ -z "$FE" ] && exit 0

output=$(pnpm --filter @starter/web lint 2>&1)
code=$?
echo "$output"
[ $code -eq 0 ] && exit 0 || exit 2
