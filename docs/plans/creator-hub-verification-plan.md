# Creator Hub verification execution plan

Last updated: 2026-08-06  
Branch: `few-fixes-before-submission`  
Checkpoint commit: `ff180fe`

## Objective

Prepare `@sentdm/n8n-nodes-sent` for n8n Creator Hub submission and official-node verification. The node intentionally exposes only the Sent API operations that fit n8n workflows; complete API coverage is not a goal.

## Current state

- [x] Action-node UX, validation, error handling, and output shaping were improved.
- [x] Optional child-profile routing through `x-profile-id` was added to shared API requests.
- [x] Trigger registration now checks, repairs, reactivates, and removes its remote webhook.
- [x] Trigger inputs, signatures, replay tolerance, malformed deliveries, and deduplication received expanded tests.
- [x] Release metadata, codex category, publishing workflow, verification docs, and first-publish/OIDC handoff were updated.
- [x] `@n8n/node-cli` is pinned to `0.42.1` in the npm manifest and lockfile.
- [x] The latest canonical-envelope and durable trigger-creation changes passed formatting, lint, strict TypeScript, build, and 13 test files / 282 tests with the previously installed CLI 0.42.0 compatibility tree.
- [x] The latest package dry run contained 27 intended files and no tests, source TypeScript, or source maps.
- [x] The offline production dependency audit reported zero vulnerabilities.
- [ ] The exact clean `npm ci` gate with CLI 0.42.1 remains pending because the review environment could not resolve `registry.npmjs.org`, and its network escalation failed in the approval service.
- [ ] No npm publish, Git tag, Creator Hub submission, or other public release action has been performed as part of this work.

## Remaining work in recommended order

### 1. Finish canonical webhook-envelope handling

Sent's current Events Reference uses the signed body field `sub_type`, while the earlier implementation used `event` or the unsigned `X-Webhook-Event-Type` header.

- [x] Read `sub_type` as the canonical signed event name.
- [x] Retain signed-body `event` only as a compatibility spelling.
- [x] Reject a header that disagrees with the signed body instead of letting it change workflow semantics.
- [x] Restrict the static fallback to the seven documented message suffixes: `queued`, `routed`, `sent`, `delivered`, `read`, `failed`, and `received`.
- [x] Convert trigger fixtures to canonical `sub_type` payloads.
- [x] Strengthen the redelivery test so it proves a real, non-undefined idempotency key is emitted.
- [x] Run formatter, lint, TypeScript, and trigger tests for these edits with the available CLI 0.42.0 compatibility tree.

Files currently involved:

- `nodes/SentTrigger/SentTrigger.node.ts`
- `nodes/SentTrigger/helpers/signature.ts`
- `nodes/SentTrigger/types/index.ts`
- `test/signature.test.ts`
- `test/trigger-lifecycle.test.ts`
- `test/trigger-output.test.ts`

### 2. Make create-webhook idempotency survive failed activation

The current random creation key is written to workflow static data immediately before the POST. n8n normally persists that static data only after activation succeeds, so a lost response followed by a restart can generate a new key and create an orphan webhook.

- [x] Replace reliance on the pre-POST random value with a deterministic creation key.
- [x] Derive the key from workflow identity, node identity, desired webhook configuration, and a creation generation.
- [x] Use a stable initial generation for the first activation.
- [x] After deletion, remote 404 recovery, or replacement of a webhook with an unusable local secret, retain the old webhook ID as the next generation.
- [x] Clear the generation only after a new webhook ID and valid signing secret are safely stored.
- [x] If Sent returns a webhook ID without a valid secret, clean up that remote webhook when possible before failing activation.
- [x] Add a regression that retries with a fresh static-data object to simulate restart/non-persistence and asserts the same creation key.
- [x] Add a regression proving delete/recreate uses a new key, while a same-generation retry reuses its key.
- [x] Update README wording from a "persisted request key" to the deterministic recovery behavior.
- [x] Run formatter, lint, TypeScript, and lifecycle tests for these edits with the available CLI 0.42.0 compatibility tree.

### 3. Run the clean local release gate

Run on a network-enabled clean checkout so the exact pinned CLI is exercised:

```bash
npm ci
npm run lint
npx tsc --noEmit -p tsconfig.json
npm test
npm run build
npm pack --dry-run --json
npm audit --omit=dev
git diff --check
git status --short
```

Also repeat the repository guards for generated artifacts, unsafe runtime constructs, JSON/YAML parsing, package contents, and codex metadata.

The prior review environment could not finish `npm ci` because registry access was unavailable and the local cache did not contain `@n8n/node-cli@0.42.1`. Do not mark the clean gate complete from the earlier CLI 0.42.0 run.

### 4. Complete authorized live Sent and n8n checks

Required inputs: a test Sent API key, an organization/profile pair if profile routing is supported by the key, and an n8n instance with a public HTTPS production webhook URL.

- [ ] Valid and invalid credential tests.
- [ ] Organization-level key with and without Profile ID; confirm `x-profile-id` routing.
- [ ] Sandbox template send and sandbox text send.
- [ ] Message status, activities, contact lookup/search/list pagination, account, and number lookup.
- [ ] 401/403, validation, rate-limit, and Continue On Fail output inspection.
- [ ] AI Tool UI and Simplified/Raw/Selected Fields output inspection.
- [ ] Trigger activation and remote configuration inspection.
- [ ] Disabled/stale webhook repair and reactivation.
- [ ] Canonical signed `sub_type` delivery.
- [ ] Forged signature, modified body, stale timestamp, mismatched header, and malformed envelope rejection with no workflow execution.
- [ ] Exact retry deduplication and later repeated-status distinction.
- [ ] Trigger deactivation and remote deletion.

Accepted limitation: if a signing secret is rotated directly in Sent, deactivate and reactivate the n8n workflow because the webhook read endpoint does not return the replacement secret.

### 5. Release and submit only after all gates pass

- [ ] Review and merge the release commit to `main`.
- [ ] Make the GitHub repository anonymously readable.
- [ ] Add a short-lived, narrowly scoped granular npm token as `NPM_TOKEN` for the first GitHub Actions publish only.
- [ ] Create and push the exact `0.1.0` tag; never publish locally.
- [ ] Verify the Actions run, npm version, public access, provenance, package contents, and public URLs.
- [ ] Configure npm Trusted Publishing for the GitHub workflow.
- [ ] Delete the GitHub `NPM_TOKEN` secret and revoke the token.
- [ ] Run the pinned and then current n8n community-package scanner against the exact published version.
- [ ] Complete the Creator Hub form from public evidence and record the submission identifier.

## Release blockers

Do not publish or submit while any of these remain:

- The exact clean `npm ci` gate with CLI 0.42.1 has not passed.
- Live Sent/n8n lifecycle and security checks are incomplete.
- Repository/package/provenance/scanner evidence is not public and verified.

## Completion criteria

The package is ready for Creator Hub submission when the clean local gate, authorized live checks, public GitHub/npm release, provenance verification, and scanner checks all pass; the documented signing-secret rotation limitation is retained; and no release blocker above remains.
