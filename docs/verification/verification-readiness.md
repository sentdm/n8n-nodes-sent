# Verification readiness evidence

Baseline assessment date: 2026-08-05. The command log below records the pre-remediation checkout and is retained for traceability; it is **not current release sign-off** after the 2026-08-06 review changes. "Configured" is not equivalent to tested, published, or n8n-verified.

## Current release decision

**Local gates complete; publication gates remain.** The exact clean-install gate with the pinned CLI 0.42.1 has passed and is recorded below, and the maintainer has attested the live Sent and n8n checks (see _Live check attestation_). What remains is external and human-only: a public GitHub repository, the first GitHub Actions publish with provenance, npm Trusted Publishing handoff, the community-package scanner against the published version, and Creator Portal review. `submission-checklist.md` has the required ordering; nothing in this repository can substitute for those steps.

Post-remediation checks recorded on 2026-08-06: lint, strict TypeScript, build, and all 13 test files / **282 tests** passed with the previously installed `@n8n/node-cli` 0.42.0. The codex-category and publication-workflow guards pass and were each proven to fail against a noncompliant value; `publish.yml` parses as YAML; `npm audit --omit=dev --package-lock-only` reports zero vulnerabilities; and the full lockfile audit still reports six moderate and two high development-tooling advisories. `@n8n/node-cli` 0.42.1 is pinned in `package.json` and `package-lock.json`, but a clean `npm ci` could not finish in the restricted review environment because a required registry tarball was not cached. The clean-gate caveat in that paragraph is superseded by the section below; its 0.42.0 tool version is retained for traceability.

## Clean 0.42.1 release gate

Recorded 2026-08-06 on a network-enabled checkout of `main` at `a34c0eb`, working tree clean. `main` has
since advanced to `ddc5024`, which only deletes a planning document and touches no shipped source, so
these results carry forward unchanged. This is
the gate that `submission-checklist.md` §3 and the execution plan's step 3 require, and it closes the
"exact clean `npm ci` with 0.42.1" release blocker.

Environment: Node.js `v24.6.0`, npm `11.17.0`, `@n8n/node-cli` **0.42.1**.

| Command                             |         Exit | Result                                                                                                                                                                       |
| ----------------------------------- | -----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                            |            0 | 739 packages added, 740 audited, from the committed `package-lock.json`; installed CLI is exactly 0.42.1                                                                     |
| `npm run lint`                      |            0 | `n8n-node lint v0.42.1`, no errors or warnings                                                                                                                               |
| `npx tsc --noEmit -p tsconfig.json` |            0 | No type errors under `strict` + `noUnusedLocals`                                                                                                                             |
| `npm test`                          |            0 | 13 files / **282 tests** passed                                                                                                                                              |
| `npm run build`                     |            0 | TypeScript build and static-file copy successful                                                                                                                             |
| `npm pack --dry-run`                |            0 | 27 files, **23.4 kB packed / 93.4 kB unpacked**                                                                                                                              |
| `npm audit --omit=dev`              |            0 | **0 vulnerabilities**                                                                                                                                                        |
| `npm audit`                         |            1 | 8 vulnerabilities (6 moderate, 2 high) — unchanged, all development-only tooling; see _Security audit interpretation_                                                        |
| CI gate: tracked-artifact grep      | 1 (no match) | No tracked `.env`, `coverage/`, `node_modules/`, or `dist/`                                                                                                                  |
| CI gate: unsafe-construct grep      | 1 (no match) | No `NODE_TLS_REJECT_UNAUTHORIZED`, `rejectUnauthorized: false`, `process.env`, `child_process`, `eval(`, or `<script` across `credentials`, `nodes`, `icons`, `package.json` |
| `git diff --check`                  |            0 | No whitespace errors                                                                                                                                                         |
| `git status --short`                |            0 | Empty                                                                                                                                                                        |
| Markdown link integrity             |            0 | Every relative and `blob/main` link across tracked `*.md` resolves                                                                                                           |

Operation-count cross-check — all five sources of truth agree on **4 resources / 7 operations**: the
built `dist/nodes/Sent/actions/properties.js`, the 7 rows of `api-coverage.md`, the 7 entries of
`test/operations.test.ts`, the "exposes **7** of them" line, and the README resource table
(Account 1 + Message 3 + Contact 2 + Phone Number 1). Exposed 7 + excluded 36 = 43.

The packed size grew from the 2026-08-05 baseline's 18.2 kB / 67.2 kB to 23.4 kB / 93.4 kB at the same
27 files, which reflects the canonical-envelope and durable trigger-creation work, not new files.

## Live check attestation

Recorded 2026-08-06. These are the execution plan's step 4 checks, run by the maintainer against a
live Sent account and a local n8n instance. They are **attested by the maintainer, not machine-captured
in this repository** — no request/response transcript is stored here, deliberately, because these
exchanges carry a real API key, a `whsec_` signing secret, and recipient phone numbers.

Environment for the live run: n8n **2.33.4** on Node.js `v24.6.0`, package loaded from `dist/` through
`~/.n8n-node-cli/.n8n/custom/node_modules/@sentdm/n8n-nodes-sent`, public HTTPS production webhook URL
supplied by an ngrok tunnel with `N8N_WEBHOOK_URL` set to its origin.

| Group                              | Checks attested                                                                                                                                                                                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential and API operations      | Valid and invalid credential test; organization-level key with and without Profile ID, confirming `x-profile-id` routing; sandbox template send and sandbox text send; message status; activities; contact lookup, search and list pagination; account; number lookup |
| Errors and AI Tool surface         | 401/403, validation and rate-limit handling; Continue On Fail output inspection; AI Tool UI; Simplified, Raw and Selected Fields output shapes                                                                                                                        |
| Trigger lifecycle                  | Activation and remote configuration inspection; disabled/stale webhook repair and reactivation; canonical signed `sub_type` delivery; deactivation and remote deletion                                                                                                |
| Webhook security and deduplication | Forged signature, modified body, stale timestamp, mismatched header and malformed envelope each rejected with no workflow execution; exact-retry deduplication; later repeated-status transitions kept distinct                                                       |

Two registry facts were machine-verified during the same session against the running instance, via an
authenticated `GET /types/nodes.json` over 975 loaded node types:

- `CUSTOM.sent`, `CUSTOM.sentTrigger` and `CUSTOM.sentTool` are registered, each bound to `sentApi`.
- `CUSTOM.sentTriggerTool` is **absent**, which is the runtime confirmation that `usableAsTool` being
  `undefined` on the trigger keeps `createAiTools` from minting a tool whose `execute` is `undefined`.
  This is the live counterpart to the `test/trigger-lifecycle.test.ts` assertion.

Accepted limitation, unchanged: if a signing secret is rotated directly in Sent, the n8n workflow must
be deactivated and reactivated, because the webhook read endpoint does not return the replacement
secret.

## Publication progress

`submission-checklist.md` §2 and the execution plan's step 5 are human-only and performed outside this
repository. Progress is recorded here as each item becomes externally verifiable.

**Step 5 item 1 — source public. Complete, verified 2026-08-06 without authentication:**

| Evidence                                           | Result                                                                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `curl -L https://github.com/sentdm/n8n-nodes-sent` | **HTTP 200**                                                                                                                                                   |
| Anonymous `GET /repos/sentdm/n8n-nodes-sent`       | `visibility: public`, `private: false`, `default_branch: main`, `has_issues: true`                                                                             |
| `codeload.github.com/.../tar.gz/refs/heads/main`   | **HTTP 200** — this is the URL the n8n community scanner fetches attested source from, and the reason the repository had to be public before the first publish |
| Anonymous `git ls-remote refs/heads/main`          | `ddc5024…`, identical to local `main`                                                                                                                          |
| Anonymous `git ls-remote --tags`                   | none — `0.1.0` does not exist yet, so the publish workflow has not been triggered                                                                              |

**Public URL sweep — complete, 2026-08-06.** Every non-npm URL that `submission-checklist.md` §5 requires
returns **HTTP 200 unauthenticated**: 17 distinct URLs covering `package.json`'s `repository`, `homepage`
and `bugs`, the issues page, both `docs.sent.dm` links including
`docs.sent.dm/reference/api/authentication`, the four `docs.n8n.io` links, `creators.n8n.io/nodes`, and
every `blob/main` and `tree/main` link in the README. None returned 404.

Still pending and unverifiable until publication: the npm package, the Git tag, the Actions publish run,
npm provenance attestations, the community-package scanner result, and Creator Portal submission. Scanner
dist-tags rechecked 2026-08-06: `latest` = `beta` = 0.31.0, `stable` = 0.29.1, unchanged from 2026-08-05.

Not verifiable from an unauthenticated session, so left for the maintainer: that GitHub Actions is enabled
and required branch protections are configured on `main`.

## Command log

Environment: Node.js `v24.6.0`, npm `11.17.0`, pnpm `11.7.0`, `@n8n/node-cli/0.42.0 darwin-arm64 node-v24.6.0`.

| Command                                             |         Exit | Result                                                                                                                                                                                       |
| --------------------------------------------------- | -----------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                      |            0 | Lockfile satisfied; 824 resolved dependencies (153 prod, 669 dev, 95 optional, 69 peer)                                                                                                      |
| `pnpm run lint`                                     |            0 | `n8n-node lint` 0.42.0, no errors or warnings                                                                                                                                                |
| `pnpm exec tsc --noEmit`                            |            0 | No type errors under `strict` + `noUnusedLocals`                                                                                                                                             |
| `pnpm test`                                         |            0 | 11 files / **225 tests** passed                                                                                                                                                              |
| `pnpm run build`                                    |            0 | TypeScript build and static-file copy successful                                                                                                                                             |
| `npm pack --dry-run`                                |            0 | 27 files, 18.2 kB packed / 67.2 kB unpacked                                                                                                                                                  |
| `npm audit --omit=dev`                              |            0 | **0 vulnerabilities**                                                                                                                                                                        |
| `npm audit`                                         |            1 | 6 moderate, 2 high — all in development-only CLI/release tooling; see below                                                                                                                  |
| CI gate: tracked-artifact grep                      | 1 (no match) | No tracked `.env`, `coverage/`, `node_modules/`, or `dist/`                                                                                                                                  |
| CI gate: unsafe-construct grep                      | 1 (no match) | No `NODE_TLS_REJECT_UNAUTHORIZED`, `rejectUnauthorized: false`, `process.env`, `child_process`, `eval(`, or `<script` across `credentials`, `nodes`, `icons`, `package.json`                 |
| JSON/YAML parse check                               |            0 | 7 example workflows, 2 node codex files, `package.json`, and 2 Actions workflows all parse. `test/examples.test.ts` additionally checks every example against the node's declared parameters |
| `curl -IL https://github.com/sentdm/n8n-nodes-sent` |            — | **404** — the repository is not public yet                                                                                                                                                   |
| `npm view @sentdm/n8n-nodes-sent`                   |            — | **E404** — the package is not published yet                                                                                                                                                  |

### Packed contents

Only compiled output and required metadata ship:

```
CHANGELOG.md  LICENSE.md  README.md  package.json
dist/credentials/SentApi.credentials.{js,d.ts}
dist/icons/sent-dark-icon.svg  dist/icons/sent-light-icon.svg
dist/nodes/Sent/**  dist/nodes/SentTrigger/**  dist/package.json
```

No tests, examples, docs, plans, CI workflows, or source `.ts` files are included.

## Requirement matrix

| Requirement                                  | Evidence                                                                                                                                                                                                          | Result                       | Remaining human action                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Official scaffold and CLI                    | `@n8n/node-cli` 0.42.1 pinned in `devDependencies` and `package-lock.json`; `eslint.config.mjs` is the unmodified default re-export that strict mode requires                                                     | Pass                         | None — clean `npm ci` gate with 0.42.1 recorded above                                                           |
| Node.js 22+                                  | `engines.node: ">=22"`; both workflows use Node 22                                                                                                                                                                | Pass                         | None                                                                                                            |
| Clean install                                | `package-lock.json` committed; both workflows use `npm ci`                                                                                                                                                        | Pass                         | None                                                                                                            |
| English UI and documentation                 | `n8n-node lint` plus editorial review                                                                                                                                                                             | Pass                         | None                                                                                                            |
| API-key credential                           | `credentials/SentApi.credentials.ts`: password field, `x-api-key`, optional child-profile targeting, `GET /v3/me` test, themed icon                                                                               | Pass (attested)              | None                                                                                                            |
| Stable Sent v3 coverage                      | 7 of the 43 documented operations, each asserted in `test/operations.test.ts`; 36 documented exclusions                                                                                                           | Pass (attested)              | None                                                                                                            |
| Trigger registers and repairs a real webhook | Lifecycle implementation and `test/trigger-lifecycle.test.ts`                                                                                                                                                     | Pass (attested)              | None                                                                                                            |
| Trigger is not an AI tool                    | `usableAsTool` is `undefined`, asserted in `test/trigger-lifecycle.test.ts`                                                                                                                                       | Pass                         | None                                                                                                            |
| Raw-body signature security                  | Deterministic HMAC, replay window, body-mutation and rejection tests; a rejected delivery produces no execution                                                                                                   | Pass (attested)              | None                                                                                                            |
| Pagination bounded and correct               | Constant page size across pages, `limit=150` two-page distinctness test, 10,000-page guard                                                                                                                        | Pass (attested)              | None                                                                                                            |
| Errors safe and actionable                   | Envelope, 204, 401, 422, 429, network, timeout, metadata preservation, and redaction assertions                                                                                                                   | Pass (attested)              | None                                                                                                            |
| No runtime dependencies                      | `package.json` declares no `dependencies`; the production audit is 0                                                                                                                                              | Pass                         | None                                                                                                            |
| MIT license                                  | `LICENSE.md`, `package.json`                                                                                                                                                                                      | Pass                         | None                                                                                                            |
| Branding                                     | Supplied Sent chevron, square `viewBox="0 0 24 24"`, on both nodes and the credential. `test/icons.test.ts` asserts the light theme gets the dark glyph and vice versa, since the files are named by glyph colour | Pass                         | Brand-owner sign-off                                                                                            |
| README, support, security                    | README, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, all pointing at `support@sent.dm`                                                                                                                 | Pass                         | None                                                                                                            |
| CI quality gates                             | `.github/workflows/ci.yml`; the runtime-safety grep is scoped to shipped sources so it cannot match itself                                                                                                        | Pass locally                 | Run in the public repository                                                                                    |
| Publication and provenance                   | `.github/workflows/publish.yml`: `id-token: write`, SHA-pinned actions, pinned npm, tag/version gate, provenance, optional temporary `NPM_TOKEN`, post-publish scan                                               | Configured, not run          | First GitHub Actions publish with temporary token; then configure Trusted Publisher and revoke/remove the token |
| Public GitHub and npm metadata               | `package.json` URLs are exact locally; the GitHub repository is public and anonymously readable as of 2026-08-06 (see _Publication progress_)                                                                     | GitHub verified; npm pending | Publish the package, then re-verify the npm half                                                                |
| Community scanner                            | Registry-only tool; needs a published version. Checked 2026-08-06: `latest`=`beta`=0.31.0, `stable`=0.29.1                                                                                                        | Blocked until publication    | Recheck dist-tags, then scan the exact published version with the pinned and current builds                     |
| Creator Portal                               | `creator-portal-submission.md`                                                                                                                                                                                    | Not submitted                | Authenticated human completion after publication                                                                |

## What still needs external state

The exact clean `npm ci` gate with `@n8n/node-cli` 0.42.1 is now recorded above. The live Sent/n8n checks still are not. The public GitHub repository, npm package, Git tag, Actions publish run, npm provenance, scanner pass, and Creator Portal submission also do not exist yet. Local implementation cannot substitute for them; `submission-checklist.md` has the required ordering.

## Security audit interpretation

The 2026-08-06 lockfile audits after pinning the CLI to 0.42.1 still report six moderate and two high advisories, all in development tooling: `release-it` reaches an affected `undici`, and the CLI's AI-development toolchain reaches an affected `uuid`. The production-only audit is zero and the published package declares no runtime `dependencies`. Do not run `npm audit fix --force`: npm proposes a breaking `release-it` major upgrade and downgrading the official CLI to 0.20.0.

## Repository security review

Searches covered API keys, bearer tokens, `whsec_`, phone numbers, email addresses, `.env`, `process.env`, filesystem access, child and shell execution, dynamic evaluation, TLS bypasses, authorization headers, retry loops, and unsafe SVG constructs. Matches were limited to credential field and header declarations, synthetic `whsec_` values and reserved example phone numbers in tests, the documented `support@sent.dm` address and the `e.g. person@example.com` placeholder, `.env` deny patterns in `.gitignore` and CI, and the bounded pagination loop.

No runtime filesystem or environment access, shell or dynamic-code execution, TLS weakening, secret logging, embedded SVG scripts or remote references, unbounded retry, or credential fixture was found. Both icons are static path data with no `<script>`, `<image>`, or external `href`. The shared transport redacts secret, token, phone, recipient, and body fields from validation details and normalizes low-level network errors before emitting them.

One residual risk is accepted and documented rather than fixed: the webhook signing secret lives in n8n workflow static data, which n8n stores unencrypted and copies into saved executions. Sent returns that secret only from `POST /v3/webhooks`, so moving it to a credential field would mean giving up automatic registration. See the README's _Webhook security_ section.
