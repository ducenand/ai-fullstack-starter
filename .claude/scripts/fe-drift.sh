#!/usr/bin/env bash
set -euo pipefail

# Detect components modified without corresponding test files.
DIFF=$(git diff HEAD --name-only 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)
COMPS=$(echo "$DIFF" | grep -E '^apps/web/src/components/[^/]+\.tsx$' | sed 's|.*/||; s|\.tsx$||' | sort -u || true)
[ -z "$COMPS" ] && exit 0

WARN=""
while IFS= read -r comp; do
  lower=$(echo "$comp" | tr '[:upper:]' '[:lower:]')
  # Accept unit tests alongside the component, or a Playwright E2E spec named after it.
  if ! ls "apps/web/src/__tests__/${comp}.test.tsx" \
        "apps/web/src/components/__tests__/${comp}.test.tsx" \
        "apps/web/e2e/${comp}.spec.ts" \
        "apps/web/e2e/${lower}.spec.ts" 2>/dev/null | grep -q .; then
    WARN="$WARN $comp"
  fi
done <<< "$COMPS"

if [ -n "$WARN" ]; then
  echo "Frontend component(s) changed without a test file:${WARN}"
  echo "Add a Playwright E2E spec (apps/web/e2e/<component>.spec.ts) or a Vitest unit test covering the main user flow."
  exit 2
fi

exit 0
