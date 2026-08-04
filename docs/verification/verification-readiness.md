# Verification readiness evidence

Assessment date: 2026-08-04. “Configured” is not equivalent to published or n8n-verified.

| Requirement | Relevant file | Evidence / command | Result | Remaining human action |
| --- | --- | --- | --- | --- |
| Official current scaffold/CLI | `package.json`, `docs/research/official-requirements.md` | `npm create @n8n/node`; `npx n8n-node --version`; CLI help inspected | Pass; local CLI 0.42.0 | Recheck before release |
| Node 22+ | `package.json`, CI workflows | `node --version` → `v24.9.0`; starter requires 22+ | Pass | None |
| Clean install | `package-lock.json` | `npm install` | Pass; 823 packages; audit findings recorded below | Use `npm ci` in clean GitHub Actions |
| English UI/documentation | node descriptions, README/docs | CLI lint + repository review | Pass locally | Human editorial review |
| API-key credential | `credentials/SentApi.credentials.ts` | Unit tests | Pass structurally; `/v3/me`, password field, `x-api-key` | Live valid/invalid-key test |
| Stable Sent v3 coverage | action node/helpers, `api-coverage.md` | Documentation-to-code route matrix | Pass: 43 distinct method/path operations | Live representative API smoke tests |
| Trigger lifecycle | `nodes/SentTrigger`, lifecycle tests | Mocked create/check/delete tests | Pass | Live public HTTPS activation/deactivation |
| Raw-body signature security | signature helper/trigger/tests | deterministic HMAC/replay/body mutation tests | Pass | Live Sent delivery test |
| Pagination bounded | transport/tests | mocked empty/multiple/limit tests; 10,000-page guard | Pass | Live list smoke test |
| Errors safe and actionable | transport/tests | envelope, 204, 422, 429, network paths | Pass locally | Live representative 401/403/5xx checks |
| No runtime dependencies | `package.json` | package metadata inspection | Pass | Recheck packed manifest |
| MIT license | `LICENSE.md`, `package.json` | license inspection | Partial | Replace legal holder placeholder |
| Approved branding | `icons/sent.placeholder*.svg` | static SVG inspection | Partial | Replace with approved Sent SVGs |
| README/support/security | README, `SECURITY.md`, governance files | file review | Partial | Confirm contacts and legal governance owner |
| CI quality gates | `.github/workflows/ci.yml` | YAML review | Configured | Run in public GitHub repository |
| Actions publication/provenance | `.github/workflows/publish.yml` | `id-token: write`, Trusted Publisher/OIDC, tag/version gate | Configured, not run | Configure npm Trusted Publisher and push authorized tag |
| Public GitHub/npm metadata | `package.json` | URLs/metadata exact locally | Not externally verifiable yet | Create public repo/package and confirm no 404 |
| Community scanner | scanner 0.31.0 | `--help` was interpreted as package and returned npm 404; tool is registry-only | Blocked until npm publication | Scan exact published version and preserve pass evidence |
| Creator Portal | `creator-portal-submission.md` | Public page inspection showed sign-in only | Not submitted | Authenticated human completion after publication |
| Public URL accessibility | intended GitHub/npm URLs | `git ls-remote` returned authentication failure; `npm view` returned E404 | Fail as expected before publication | Create public repository and publish package |

## Final command log

This table is finalized after the last repository edits. Exact final results will be updated if any command is rerun.

| Command | Result |
| --- | --- |
| `npm install` | Pass; 823 packages installed |
| `npx n8n-node --version` | Pass; `@n8n/node-cli/0.42.0 darwin-arm64 node-v24.9.0` |
| `npm run lint:fix` | Pass |
| `npm run lint` | Pass; official `n8n-node lint` 0.42.0 |
| `npm test -- --reporter=dot` | Pass; 5 files / 48 tests |
| `npm run build` | Pass; TypeScript and static-file build successful |
| `npm run dev` | Partial; watcher compiled with 0 errors, but bundled n8n 2.33.3 bootstrap remained in peer-dependency resolution and port 5678 was not reachable before an intentional clean stop |
| workflow JSON/YAML parse checks | Pass; 9 workflow JSON files and 2 Actions YAML files parsed |
| `npm pack --dry-run --json --cache /private/tmp/n8n-sent-npm-cache` | Pass; 27 files, 20.4 KB packed / 90.1 KB unpacked; only compiled nodes/credential, icons, package metadata, README, license, changelog |
| `npm audit --omit=dev --json` | Pass; 0 runtime/production vulnerabilities |
| `npm audit --json` | Advisory result; 6 moderate and 2 high findings in development-only official CLI/release transitive packages; no runtime dependency is published |
| `npx --yes @n8n/scan-community-package@0.31.0 --help` | Tool has no help mode and treated `--help` as an npm package, returning 404 |
| `npx --yes @n8n/scan-community-package@0.31.0 @sentdm/n8n-nodes-sent@0.1.0` | Expected pre-publication failure: registry HTTP 404; scanner itself exits 0 on this failure, so publish workflow checks its success text |
| `npm view @sentdm/n8n-nodes-sent version repository --json` | E404: package not published |
| `git ls-remote https://github.com/sentdm/n8n-nodes-sent` | Authentication failure: repository is not publicly readable |

## Evidence still requiring external state

The public GitHub repository, npm package, Git tag, GitHub Actions publish run, npm provenance, published-package scanner pass, and Creator Portal form do not exist or cannot be accessed yet. They must remain marked pending; local implementation cannot substitute for them.

## Security audit interpretation

The full development install inherits eight advisories through `@n8n/node-cli` 0.42.0 and the official starter's release tooling (`release-it`/`undici`, plus CLI AI-tooling dependencies). The packed package has no runtime `dependencies`, and the production-only audit is zero. Do not run `npm audit fix --force`: npm proposes downgrading the official CLI to 0.20.0 and upgrading release tooling across a major version, which would break the source-of-truth alignment without an n8n-supported migration.

## Repository security review

Repository-wide searches covered API keys, bearer tokens, `whsec_`, phone numbers, email addresses, `.env`, `process.env`, filesystem access, child/shell execution, dynamic evaluation, TLS bypasses, authorization headers, retry loops, and unsafe SVG constructs. Matches were limited to:

- credential field/header declarations and documentation;
- synthetic `whsec_` values and reserved example telephone numbers in tests/workflows;
- the documented `support@sent.dm` address and placeholder `person@example.com`;
- `.env` deny patterns in `.gitignore`/CI;
- the bounded pagination loop and documented webhook retry configuration.

No runtime filesystem/environment access, shell/dynamic-code execution, TLS weakening, secret logging, embedded SVG scripts/remote references, unbounded retry, or credential fixture was found. The shared transport redacts secret/token/phone/recipient/body fields from validation details and normalizes low-level network errors before emitting them.
