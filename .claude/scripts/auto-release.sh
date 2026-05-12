#!/usr/bin/env bash
set -euo pipefail

# Only run if the previous hook auto-committed quality-gate results.
LAST_MSG=$(git log -1 --format='%s' 2>/dev/null)
[ "$LAST_MSG" = "chore: [auto] quality gates passed" ] || exit 0

# Bump patch version in all publishable packages and return the new version.
NEW=$(node -e "
const fs = require('fs');
const f = 'packages/ai-agent/package.json';
const p = JSON.parse(fs.readFileSync(f, 'utf8'));
const v = p.version.split('.');
v[2] = String(Number(v[2]) + 1);
p.version = v.join('.');
fs.writeFileSync(f, JSON.stringify(p, null, 2) + '\n');
console.log(p.version);
")

git add packages/ai-agent/package.json
git commit -m "chore: bump version to v${NEW}"
git tag -a "v${NEW}" -m "v${NEW}"

# Push branch + reachable annotated tags in one round-trip.
git push --follow-tags

echo "Released v${NEW}"
