---
name: verify
description: Run the full pre-submission gate for this n8n node package — lint, typecheck, tests, build, package inspection, CI safety greps, and a cross-check that the node registry, docs, tests and README all agree. Use before claiming a change works, and before any release or Creator Portal submission.
---

Run every gate below and report a single pass/fail table. Do not stop at the first failure — run them
all, so the user sees the complete picture in one pass.

`pnpm run lint` is eslint-only and exits 0 while TypeScript is broken, which is why the typecheck is a
separate gate. Never report success from lint alone.

## 1. Gates

```bash
cd "$(git rev-parse --show-toplevel)"
pnpm run lint                                  # expect 0
pnpm exec tsc --noEmit -p tsconfig.json        # expect 0
pnpm test                                      # expect all passing
pnpm run build                                 # expect 0
npm pack --dry-run --cache /tmp/n8n-sent-npm-cache
```

`npm pack` must list exactly `dist/credentials`, `dist/icons`, `dist/nodes`, `dist/package.json`,
`README.md`, `LICENSE.md`, `CHANGELOG.md` — no tests, docs, examples, plans or source `.ts`.

If `npm` fails with `EACCES` on `~/.npm/_cacache`, the user's npm cache has root-owned files. Keep
using `--cache /tmp/n8n-sent-npm-cache`; do not run `sudo` on their behalf.

## 2. CI safety gates

Both must exit **1** (no match). These are the same commands `.github/workflows/ci.yml` runs, so a
match here means CI will fail.

```bash
git ls-files | grep -E '(^|/)\.env($|\.)|(^|/)coverage/|(^|/)node_modules/|(^|/)dist/'
git grep -nE 'NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized[[:space:]]*:[[:space:]]*false|process\.env|child_process|eval\(|<script' -- credentials nodes icons package.json
```

## 3. Cross-check that every source of truth agrees

The operation count is asserted in five places and has drifted before. Read the authoritative value
from the built node, then compare:

```bash
node -e "
const {sentProperties}=require('./dist/nodes/Sent/actions/properties.js');
const ops=sentProperties.filter(p=>p.name==='operation');
console.log('resources:',ops.length,'operations:',ops.reduce((n,p)=>n+p.options.length,0));
"
grep -cE '^\| [0-9]+ \|' docs/verification/api-coverage.md   # coverage table rows
grep -cE '^\t\{ resource:' test/operations.test.ts           # test matrix rows
```

These three must match, and the README resource table plus `docs/verification/api-coverage.md`'s
"exposes **N** of them" line must agree with them. Exposed + excluded must total 43.

## 4. Docs integrity

Check that no markdown link points at a file that no longer exists — renamed examples and deleted
docs have broken links before:

```bash
python3 - <<'PY'
import re, pathlib
bad = []
for p in [x for x in pathlib.Path('.').rglob('*.md')
          if 'node_modules' not in str(x) and not str(x).startswith('plans/')]:
    t = p.read_text()
    for m in re.finditer(r'\]\((?!https?://|mailto:|#)([^)#]+)', t):
        if not (p.parent / m.group(1)).resolve().exists():
            bad.append(f'{p} -> {m.group(1)}')
    for m in re.finditer(r'https://github\.com/sentdm/n8n-nodes-sent/(?:blob|tree)/main/([^)\s]+)', t):
        if not pathlib.Path(m.group(1)).exists():
            bad.append(f'{p} -> {m.group(1)}')
print('\n'.join(bad) if bad else 'all links resolve')
PY
```

Also confirm any test count quoted in `CHANGELOG.md` or
`docs/verification/verification-readiness.md` matches what `pnpm test` just reported.

## 5. Report

Print a table of gate → result. For any failure, give the exact command, the real output, and the
file:line to fix. If everything passes, say so plainly with the concrete numbers (operation count,
test count, packed size and file count) rather than just "all green".
