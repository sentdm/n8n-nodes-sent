# Verification readiness evidence

Assessment date: 2026-08-05. Every row below was produced by running the command in this checkout. "Configured" is not equivalent to published or n8n-verified.

## Command log

Environment: Node.js `v24.6.0`, npm `11.17.0`, pnpm `11.7.0`, `@n8n/node-cli/0.42.0 darwin-arm64 node-v24.6.0`.

| Command | Exit | Result |
| --- | ---: | --- |
| `pnpm install` | 0 | Lockfile satisfied; 824 resolved dependencies (153 prod, 669 dev, 95 optional, 69 peer) |
| `pnpm run lint` | 0 | `n8n-node lint` 0.42.0, no errors or warnings |
| `pnpm exec tsc --noEmit` | 0 | No type errors under `strict` + `noUnusedLocals` |
| `pnpm test` | 0 | 8 files / **148 tests** passed |
| `pnpm run build` | 0 | TypeScript build and static-file copy successful |
| `npm pack --dry-run` | 0 | 27 files, 20.9 kB packed / 87.8 kB unpacked |
| `npm audit --omit=dev` | 0 | **0 vulnerabilities** |
| `npm audit` | 1 | 6 moderate, 2 high — all in development-only CLI/release tooling; see below |
| CI gate: tracked-artifact grep | 1 (no match) | No tracked `.env`, `coverage/`, `node_modules/`, or `dist/` |
| CI gate: unsafe-construct grep | 1 (no match) | No `NODE_TLS_REJECT_UNAUTHORIZED`, `rejectUnauthorized: false`, `process.env`, `child_process`, `eval(`, or `<script` across `credentials`, `nodes`, `icons`, `package.json` |
| JSON/YAML parse check | 0 | 3 example workflows, 2 node codex files, `package.json`, and 2 Actions workflows all parse |
| `curl -IL https://github.com/sentdm/n8n-nodes-sent` | — | **404** — the repository is not public yet |
| `npm view @sentdm/n8n-nodes-sent` | — | **E404** — the package is not published yet |

### Packed contents

Only compiled output and required metadata ship:

```
CHANGELOG.md  LICENSE.md  README.md  package.json
dist/credentials/SentApi.credentials.{js,d.ts}
dist/icons/sent-logo.svg  dist/icons/sent-logo.dark.svg
dist/nodes/Sent/**  dist/nodes/SentTrigger/**  dist/package.json
```

No tests, examples, docs, plans, CI workflows, or source `.ts` files are included.

## Requirement matrix

| Requirement | Evidence | Result | Remaining human action |
| --- | --- | --- | --- |
| Official scaffold and CLI | `@n8n/node-cli` 0.42.0 pinned in `devDependencies`; `eslint.config.mjs` is the unmodified default re-export that strict mode requires | Pass | Recheck the CLI version before release |
| Node.js 22+ | `engines.node: ">=22"`; both workflows use Node 22 | Pass | None |
| Clean install | `package-lock.json` committed; both workflows use `npm ci` | Pass | None |
| English UI and documentation | `n8n-node lint` plus editorial review | Pass | None |
| API-key credential | `credentials/SentApi.credentials.ts`: password field, `x-api-key`, `GET /v3/me` test, themed icon | Pass structurally | Live valid/invalid-key test |
| Stable Sent v3 coverage | 38 of the 43 documented operations, each asserted in `test/operations.test.ts`; 5 documented exclusions | Pass | Live representative API smoke tests |
| Trigger registers a real webhook | `description.webhooks` carries no `restartWebhook`, asserted in `test/trigger-lifecycle.test.ts` | Pass | Live activation against a public HTTPS URL |
| Trigger is not an AI tool | `usableAsTool` is `undefined`, asserted in `test/trigger-lifecycle.test.ts` | Pass | Confirm no "Sent Trigger Tool" appears in the AI Tools panel |
| Raw-body signature security | Deterministic HMAC, replay window, body-mutation and rejection tests; a rejected delivery produces no execution | Pass | Live Sent delivery and a forged-body 401 |
| Pagination bounded and correct | Constant page size across pages, `limit=150` two-page distinctness test, 10,000-page guard | Pass | Live list smoke test |
| Errors safe and actionable | Envelope, 204, 401, 422, 429, network, and timeout paths; redaction asserted against `error.message`, not only `JSON.stringify` | Pass | Live 401/403/5xx checks |
| No runtime dependencies | `package.json` declares no `dependencies`; the production audit is 0 | Pass | None |
| MIT license | `LICENSE.md`, `package.json` | Pass | None |
| Branding | Square `viewBox="0 0 64 64"` Sent chevron, light and dark, on both nodes and the credential | Pass | Brand-owner sign-off |
| README, support, security | README, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, all pointing at `support@sent.dm` | Pass | None |
| CI quality gates | `.github/workflows/ci.yml`; the runtime-safety grep is scoped to shipped sources so it cannot match itself | Pass locally | Run in the public repository |
| Publication and provenance | `.github/workflows/publish.yml`: `id-token: write`, SHA-pinned actions, pinned npm, tag/version gate, provenance, post-publish scan | Configured, not run | Bootstrap npm, add a Trusted Publisher, push a tag |
| Public GitHub and npm metadata | `package.json` URLs are exact locally | Not externally verifiable | Create the public repository and publish |
| Community scanner | Registry-only tool; needs a published version | Blocked until publication | Scan the exact published version at `@0.31.0` and `@beta` |
| Creator Portal | `creator-portal-submission.md` | Not submitted | Authenticated human completion after publication |

## What still needs external state

The public GitHub repository, the npm package, the Git tag, the Actions publish run, npm provenance, the scanner pass, and the Creator Portal submission do not exist yet. Local implementation cannot substitute for them; `submission-checklist.md` has the required ordering.

## Security audit interpretation

The development install inherits eight advisories through `@n8n/node-cli` 0.42.0 and the official starter's release tooling. The published package has no runtime `dependencies` and the production-only audit is zero, so none of the eight reaches a user. Do not run `npm audit fix --force`: npm proposes downgrading the official CLI to 0.20.0 and a major-version bump of the release tooling, which would break alignment with the official starter without an n8n-supported migration.

## Repository security review

Searches covered API keys, bearer tokens, `whsec_`, phone numbers, email addresses, `.env`, `process.env`, filesystem access, child and shell execution, dynamic evaluation, TLS bypasses, authorization headers, retry loops, and unsafe SVG constructs. Matches were limited to credential field and header declarations, synthetic `whsec_` values and reserved example phone numbers in tests, the documented `support@sent.dm` address and the `e.g. person@example.com` placeholder, `.env` deny patterns in `.gitignore` and CI, and the bounded pagination loop.

No runtime filesystem or environment access, shell or dynamic-code execution, TLS weakening, secret logging, embedded SVG scripts or remote references, unbounded retry, or credential fixture was found. Both icons are static path data with no `<script>`, `<image>`, or external `href`. The shared transport redacts secret, token, phone, recipient, and body fields from validation details and normalizes low-level network errors before emitting them.

One residual risk is accepted and documented rather than fixed: the webhook signing secret lives in n8n workflow static data, which n8n stores unencrypted and copies into saved executions. Sent returns that secret only from `POST /v3/webhooks`, so moving it to a credential field would mean giving up automatic registration. See the README's *Webhook security* section.
