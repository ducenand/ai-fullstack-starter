#!/usr/bin/env bash
set -euo pipefail

# If a component's diff exceeds this many changed lines, its test file must also be updated.
THRESHOLD=15

DIFF=$(git diff HEAD --name-only 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)
COMPS=$(echo "$DIFF" | grep -E '^apps/web/src/components/[^/]+\.tsx$' | sed 's|.*/||; s|\.tsx$||' | sort -u || true)
[ -z "$COMPS" ] && exit 0

WARN=""
while IFS= read -r comp; do
  lower=$(echo "$comp" | tr '[:upper:]' '[:lower:]')

  # Find the first matching test file for this component.
  test_file=""
  for candidate in \
    "apps/web/src/__tests__/${comp}.test.tsx" \
    "apps/web/src/components/__tests__/${comp}.test.tsx" \
    "apps/web/e2e/${comp}.spec.ts" \
    "apps/web/e2e/${lower}.spec.ts"; do
    [ -f "$candidate" ] && test_file="$candidate" && break
  done

  # Rule 1: test file must exist.
  if [ -z "$test_file" ]; then
    WARN="${WARN}\n  ${comp} — no test file (add apps/web/e2e/${lower}.spec.ts)"
    continue
  fi

  # Rule 2: if the component changed significantly, the test must also be touched.
  lines_changed=$(git diff HEAD -- "apps/web/src/components/${comp}.tsx" 2>/dev/null \
    | grep -E '^[+-]' | grep -v '^[+-]{3}' | wc -l | tr -d '[:space:]')
  lines_changed=${lines_changed:-0}

  if [ "$lines_changed" -gt "$THRESHOLD" ]; then
    if ! echo "$DIFF" | grep -qF "$test_file"; then
      WARN="${WARN}\n  ${comp} — ${lines_changed} lines changed but $(basename "$test_file") not updated"
    fi
  fi
done <<< "$COMPS"

if [ -n "$WARN" ]; then
  printf "Frontend test drift detected:%b\n" "$WARN"
  echo "Update the test to cover the new component behaviour before finishing."
  exit 2
fi

exit 0
