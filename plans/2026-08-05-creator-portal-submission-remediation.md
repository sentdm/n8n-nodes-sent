# Pre-submission remediation — `@sentdm/n8n-nodes-sent`

> **Historical record — fully resolved and superseded.** This is the audit plan that drove the
> 2026-08-05 remediation. Every blocker described below (including the dead trigger and the failing
> CI grep) was fixed and verified in that work, and the node surface has since been trimmed well
> beyond what this document describes. It is kept only as an audit trail. For the package as it
> actually stands, read `README.md` and `docs/verification/`.

## Context

`@sentdm/n8n-nodes-sent` is a complete but **unpublished** n8n community node package (a `Sent`
action node + a `Sent Trigger`) targeting Sent API v3. The goal is to publish it and submit it to
the [n8n Creator Portal](https://creators.n8n.io/nodes) for community-node verification.

A multi-agent audit (3 research agents against n8n `master` + live docs, 6 audit agents, 83
adversarial verifiers) produced 108 raw findings; 36 were refuted, 47 survived. A follow-up
simplicity review then cut ~11 of the resulting work items as net-negative and found ~620 lines
that should be **deleted rather than fixed**.

Headline: **the `Sent Trigger` is functionally dead** — it can never register a webhook or fire —
and **CI has never passed**, because the security-grep step matches its own source line. Neither is
catchable by lint, `tsc`, or the existing 50-test suite, which is why both survived.

Everything below was verified by reading n8n `master` source or by executing the command in this
checkout.

**User decisions:** full scope · `CLAUDE.md` holds the content and `AGENTS.md` becomes a pointer ·
`x-profile-id` is not a required Sent header, remove it · clean up and keep `docs/verification/`.

---

## Part 0 — Scope reduction

Remove from the node surface:

1. `Contact → Create` · 2. `Contact → Get Message Summary` · 3. `Contact → Update` ·
4. the entire `Conversation` resource · 5. **all `x-profile-id` / Profile Scope ID support**
   (confirmed not required; a UI control for a header the API may ignore is worse than none).

Contact keeps **Delete, Get, Get Many**. Resources 10 → 9; operations 43 → 38.

Touches `properties.ts` (operations, `resourceOptions`, `conversationId`, `phoneNumber` and
`contactId` displayOptions, `paginationFields`, `contactUpdateOptions`), `operations.ts`
(`scopeId()` and its call sites, the contact/conversation branches, `requestOptions()`),
`types/index.ts` (`profileId` on `SentRequestOptions`), `transport/index.ts:83` (header injection),
`SentTrigger.node.ts` (the option + `profileId: options.profileScopeId`), and
`examples/workflows/04-create-and-get-contact.json` (delete).

Removing `x-profile-id` **closes H3** (the create/checkExists/delete asymmetry) by deleting the
asymmetric field rather than persisting it.

### Two traps the scope cut sets off — must land in the same commit

- **`mutationOperations` (`properties.ts:78`) goes dead.** Verified: exactly two references — its
  declaration and the top-level `profileScopeId` `displayOptions.hide` at `:616`. `tsconfig.json:13`
  sets `noUnusedLocals: true`, so leaving it is a **build failure**.
- **`webhookDeleteOptions` (`properties.ts:601-605`) becomes `options: []`** — it contains only
  `profileScopeOption`. Ships an "Options" button opening an empty panel. Delete the collection.
  It was already redundant: `operations.ts:228-233` force-clears `body` and `idempotencyKey` for
  `webhook:delete` at runtime regardless of what the UI collected.

### Collapse six option collections into one

`properties.ts:561-618` defines six collections; `requestOptions` and `updateOptions` are
byte-identical, as are `deleteOptions` and `removeOptions`. After Part 0 removes
`profileScopeOption` and `contactUpdateOptions`, one collection carrying
`[Idempotency Key, Sandbox]` covers every mutation. `requestOptions()` (`operations.ts:16-28`)
collapses from 12 lines to 1. Also delete the now single-use `requestOptionsCollection` factory
(`:110-122`) and `commonMutationOptions` (`:104-108`). **~85 lines, 6 UI concepts → 1.**

The six only exist because of the n8n bug logged in `docs/verification/local-ui-smoke-test.md:42-48`
(`Could not resolve parameter dependencies`) — which is about `displayOptions` on collection
*children*. Nothing prevents one collection whose *own* `displayOptions` covers all mutations.
`test/property-schema.test.ts:7-16` already guards the real constraint.

---

## Part 1 — Blockers

### B1. `restartWebhook: true` — the trigger can never fire
`nodes/SentTrigger/SentTrigger.node.ts:66` — *found independently by 5 agents.*

`restartWebhook` marks a **wait/resume** webhook (only `Wait.node.ts`, `Form.node.ts`,
`sendAndWait`), served at `/webhook-waiting/<executionId>`.
`WebhookService.getNodeWebhooks()` (`packages/cli/src/webhooks/webhook.service.ts:338`) does
`if (ignoreRestartWebhooks && webhookDescription.restartWebhook === true) continue;` — and **every**
caller passes `true`: `active-workflow-manager.ts:150, 297, 818`, `webhook-trigger-registrar.ts:68`,
`test-webhooks.ts:358`, `trigger-count.service.ts:20`.

Net effect: zero webhooks collected → `create()` never invoked → nothing registered at Sent →
`staticData.signingSecret` never written → no route mounted. Dead in production *and* test mode.

**Fix:** delete line 66. The block becomes byte-identical to `StripeTrigger.node.ts`.
**Guard** (the suite calls `webhookMethods.default.*` directly and structurally cannot catch this):

```ts
const webhooks = new SentTrigger().description.webhooks ?? [];
expect(webhooks[0]).not.toHaveProperty('restartWebhook');   // load-bearing
expect(webhooks[0]).toMatchObject({ name: 'default', httpMethod: 'POST',
  responseMode: 'onReceived', path: 'webhook' });
```

### B2. `Contact → Get Many` is unreachable
`operations.ts:138` calls `identifier(context, itemIndex, 'contactId')` before the `getMany` branch
at `:142`. `contactId` isn't rendered for `getMany`, so it's `''` and `identifier()` throws
`contactId is required` before any request. Contact is the only resource with this ordering.
**Fix:** hoist `getMany` above the `identifier()` call. Still required after Part 0.

### B3. Paginator shrinks `page_size` mid-run → duplicate and missing records
`transport/index.ts:165`. `page` is a page **number** (`SentPagination` carries `total_pages`), so
offset is `(page-1) * page_size`; recomputing `page_size` per iteration changes what `page=2` means.
`Limit = 150`: iter 1 → `page=1&page_size=100` → rows 1-100; iter 2 → `page=2&page_size=50` →
offset 50 → **rows 51-100 again**. Rows 101-150 never fetched.
**Fix:** `const pageSize = returnAll ? 100 : Math.min(100, Math.max(1, limit));` hoisted out of the
loop. Truncation at `:176`/`:184` already discards the over-fetch.

### B4. CI has never passed
`.github/workflows/ci.yml:49`. The pathspec excludes only `docs/**` and `test/**`, so `git grep`
scans `ci.yml` itself and line 49 contains the literals `NODE_TLS_REJECT_UNAUTHORIZED` and
`child_process`. **Reproduced here:** prints `ci.yml:49`, exits 0 → `exit 1`. 100% false-positive.
**Fix:** `-- nodes credentials package.json`. Do **not** merely append `':!.github/**'` — that stops
scanning `publish.yml`, the file most likely to carry a real supply-chain injection.

### B5. Icons are a 199×54 wordmark (3.69:1)
n8n requires square/near-square; the official starter ships `icons/github.svg` at `0 0 40 40`.
The two files are **byte-identical except `fill="#060606"` vs `#F5F5F5"`**, and the target is a
**six-line file** (2 chevron paths, `viewBox="0 0 64 64"`, no wordmark, no `<defs>`/`clipPath`).
**Write the file fresh; don't perform eight micro-edits across two 4.8 KB files.** Centring:
`<g transform="translate(3.4 5)">` for chevron bounds x −0.24→57.4, y 1.0→53.1. Derive dark by
swapping the one hex value. Then correct `CHANGELOG.md:7`, which falsely calls these "placeholder
icons".

### B6. Repo not public; first publish has no working auth path
`https://github.com/sentdm/n8n-nodes-sent` → **404**. The scanner fetches attested source via npm
provenance → `codeload.github.com` and hard-fails when unreachable. Separately, `publish.yml` is
OIDC-only but **npm Trusted Publishers can only be configured on a package that already exists**
(`npm/cli#8544`). Bootstrap order (make mandatory in `submission-checklist.md:24`): publish `0.0.0`
from a maintainer machine → access public → add Trusted Publisher → **then** tag `0.1.0`.
`publish.yml:45` gates on version, not package, so the placeholder doesn't block it.

### B7. Pre-publication placeholder text ships to npm
`README.md:5, 18, 102, 103, 126, 132, 135, 148` and `CHANGELOG.md:5-9` — both in `files`.
`:5` "has not been published to npm" is self-falsifying on the npm page; `:102` reads as *fails the
n8n scanner*; `:103`/`:135` contradict `package.json:16-22` on the exact item reviewers check;
`:126` is internal agent-task framing. Same class in `SECURITY.md:5, 11` and `CODE_OF_CONDUCT.md:13`
(which literally instructs the reader **not** to publish).

---

## Part 2 — Security

| # | Sev | Location | Disposition |
| --- | --- | --- | --- |
| S1 | Low | `SentTrigger.node.ts:232` | **Signing secret in static data.** `workflow_entity.staticData` is a plain `@JsonColumn` with no `N8N_ENCRYPTION_KEY`, and `prepareExecutionDataForDbUpdate` (`shared-hook-functions.ts:37-52`) `pick`s it into **every saved execution row**. **Keep the implementation** — canonical n8n pattern (Stripe, GitHub), this node fails *closed* (401), and Sent returns the secret only from `POST /v3/webhooks` so a credential field can't support auto-registration. **Action: document it** in README's `### Webhook security`. |
| S2 | Low | `signature.ts:105` | `host === '::1'` is **dead code** — WHATWG `URL.hostname` returns `'[::1]'` with brackets. **Reduced fix: one line** — `const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');` (plus `'0.0.0.0'` in the literal list). Full IPv6/ULA/CGNAT parsing is cut: the sole input is the operator's own `getNodeWebhookUrl()`, zero attacker reachability, and ~25 lines of address arithmetic has its own bug surface (the naive version rejects `fdic.gov`). Soften `README.md:72` instead of over-claiming. |
| S3 | Low | `publish.yml:20, 25, 32` | Pin `actions/checkout` + `actions/setup-node` to 40-char SHAs and `npm@11.6.2` — **in `publish.yml` only**. `ci.yml` has `permissions: contents: read`, no secrets, and cannot publish. **Cut `.github/dependabot.yml`** — maintenance overhead purchased with no budget. Do **not** add `--ignore-scripts`: `isolated-vm`, `unrs-resolver`, `esbuild` need install scripts. |
| S4 | Low | `local-development-startup.md:78` | Cites `/Users/amarrama/Desktop/…` — a third party's home directory. Resolved by deleting the file (Part 4). |

**Verified non-issues — do not "fix":** Sent `error.message` in execution data (the phone number is
already in the `Recipients` parameter in the same row; `details` are key-redacted, *stricter* than
n8n core) · `signing_secret` in `Webhook → Get Many` output (that is the operation) ·
`readRawBody()` on a consumed stream (throws `BadRequestError`) · `rawEvent` duplicating `payload`
(`flatted` writes shared refs once) · `engines.node: ">=22"`, root `icons/`,
`peerDependencies: {"n8n-workflow":"*"}`, tsconfig including `package.json`, `usableAsTool` on the
**action** node, zero runtime deps — all match the official starter or current n8n.

---

## Part 3 — Should-fix (post-review, trimmed)

- **H1 · JSON params crash on object-valued expressions** — `operations.ts:13`. `parameter()` does
  `String(getNodeParameter(...))`; `={{ $json.vars }}` resolves to an object → `'[object Object]'` →
  `JSON.parse` throws. Six sites. Widen `parseJsonInput` to `unknown`, short-circuit objects, and
  move the shape check **out of** the `try` (today `must contain a JSON object` is swallowed and
  mis-reported as `is not valid JSON`).
- **H2 · `usableAsTool: true` on the trigger** — `SentTrigger.node.ts:56`. `createAiTools` filters on
  `Boolean(nodeType.usableAsTool)` with no trigger guard → a phantom "Sent Trigger Tool" whose
  `execute?.call()` optional-chains to `undefined`. ⚠️ The type is
  `true | UsableAsToolDescription | undefined` — **`false` is a TS2322 build error**. Use
  `usableAsTool: undefined`; an `eslint-disable` won't work (the scanner sets
  `allowInlineConfig: false`).
- **H4 · `getTemplates` search box is a silent no-op** — `Sent.node.ts:38`. Declared
  `searchable: true` but takes no `filter`. **Fix the filter only** — accept `filter?: string`, pass
  `{ search: filter }`, and drop entries with no `id` (`:49` currently emits `value: ''`).
  **Cut the `paginationToken` half:** Sent paginates by page *number*, so a token means encoding an
  integer into an opaque string.
- **H5 · Empty `PATCH` on `Profile → Update`** — `operations.ts:183-186`. Guard with
  `Object.keys(fields).length === 0` → `NodeOperationError`. *(The contact half is removed by Part 0
  — the earlier draft mislabelled this H7.)*
- **H6 · Credential icon light-only, near-black** — `SentApi.credentials.ts:13`. Use the themed
  `{light, dark}` form, keeping `as const` (without it the literals widen to `string` and fail the
  `file:${string}.svg` template type).
- **H8 · Coverage** — 1 of 43 `buildOperation` branches is tested; `Sent.execute()` has **zero**
  tests; the signature-**rejection** path is untested; and the redaction assertions use
  `JSON.stringify(error)`, which drops the non-enumerable `message` and so cannot detect the likely
  leak. Add a **37-row table** of `[resource, operation, params, expected {method, path}]` plus
  `test/execute.test.ts`. **Cut the proposed `displayOptions.show` walker** — `getNodeParameters` is
  already imported at `test/property-schema.test.ts:1`, and a second divergent implementation of
  n8n's display semantics can pass while the product is broken. Every required-ID property defaults
  to `''` anyway, so explicit fixtures are needed regardless.

**Cut entirely (was H3, H7, N9):** H3 is closed by Part 0 §5. H7's own conclusion was "don't do it"
(adding a third key to `item.json` silently reroutes failed items to the **success** branch).
N9's `tsconfig.test.json` + retyping 25 mocks to `Partial<T>` **does not compile** —
`Partial<IExecuteFunctions>` is not assignable to the `this: SentFunctions` receiver, so you'd need
`as unknown as T`, exactly as unsound as `as never`. Keep only the 2-line CI step rename
("Lint and type-check" → "Lint" at `ci.yml:30`, `publish.yml:50`).

---

## Part 4 — Deletions (largest single win: ~620 lines, ~17% of the repo)

| Target | Why | Lines |
| --- | --- | --- |
| **9 dead interfaces** in `types/index.ts` — `SentAccount`, `SentMessage`, `SentContact`, `SentTemplate`, `SentProfile`, `SentCampaign`, `SentUser`, `SentWebhookEvent`, `SentNumberLookup` | **Verified: zero references anywhere**, including inside the file. All `extends IDataObject` with all-optional members — structurally identical to `IDataObject`, so zero type safety even if used. `noUnusedLocals` doesn't flag exported types. Keep `SentMeta`/`SentError`/`SentPagination`/`SentTemplateReference` (members of live types) | ~62 |
| Six option collections → one | See Part 0 | ~85 |
| `docs/verification/local-ui-smoke-test.md`, `local-development-startup.md` | Per user decision. Unfinished work log that ends by telling the reader to redo the work; leaked third-party home directory | ~200 |
| `AGENTS.md:82, 84-94` | The `.agents/*.md` table pointing at six files that have never existed — this is the entire real defect Part 5 addresses | 13 |
| `examples/workflows/{01,03,04,05,06,07}.json` | `01`≈`02`, `07`≈`08`, `03`/`05`/`06` are one-node stubs, `04` is deleted by Part 0. Each hardcodes parameter names, so every scope cut silently rots them. **Keep `02`, `08`, `09`** (README:86 links 09) | ~55 |
| `package.json:20-22` `maintainers` | Registry-generated, inert. Not "optional" — an optional item gets relitigated | 3 |

### ⚠️ `deriveEventIdempotencyKey` — escalate before deciding
`signature.ts:76-98`, emitted at `SentTrigger.node.ts:317`, promoted in `README.md:86` and built on
by `examples/workflows/09` (a Postgres `ON CONFLICT (idempotency_key) DO NOTHING`).

The fallback branch (`:93-97`) hashes `rawBody + '.' + webhookTimestamp`. Sent retries deliveries
(`retry_count`, default 3), and a retry outside the ±300 s window (`signature.ts:52`) **must** carry
a fresh timestamp or fail verification — so the "durable deduplication key" **changes on
redelivery**, the exact case it exists for. A user following the shipped example gets duplicate side
effects on the first retry.

`test/signature.test.ts:88-93` asserts that behaviour as if it were correct:

```ts
expect(deriveEventIdempotencyKey({ field: 'unknown' }, rawBody, '1712345678')).not.toBe(
    deriveEventIdempotencyKey({ field: 'unknown' }, rawBody, '1712345679'),
);
```

**Planned fix (a):** drop `webhookTimestamp` from the hash so the fallback key is body-stable across
redeliveries, and invert `test/signature.test.ts:91-93` to assert *stability* instead of difference.
This keeps the feature and `examples/workflows/09` working with a two-line change.

Alternative (b), if you'd rather cut it: delete the helper outright — branches 1 and 2 are
one-liners a user writes as `{{$json.payload.message_id}}`, and the output already carries
`payload`, `rawEvent`, `webhookId`, `webhookTimestamp`. **Flagging this explicitly because it is
shipped behaviour, not a mechanical fix — say the word if you prefer (b).**

---

## Part 5 — `CLAUDE.md` rewrite (kept, but lean)

`CLAUDE.md` is one line (`@AGENTS.md`) and `AGENTS.md:82, 89-94` point at six nonexistent
`.agents/*.md` files, so every agent session hits a dead end.

Per your decision: **`CLAUDE.md` carries the content; `AGENTS.md` becomes a one-line pointer** to it,
preserving the cross-tool entry point for Codex/Cursor.

The simplicity reviewer's warning is fair and I'm taking it as a constraint: this repo has already
demonstrated it can't keep generated docs in sync (419 lines of `docs/verification/**` with stale
counts and nonexistent paths). So the new `CLAUDE.md` stays **short and non-restating** — commands
(`pnpm`), the `transport → operations → properties` seam, the trigger's webhook lifecycle, the
`package.json` `n8n` block contract, and the verified rule sources found in this audit
(`@n8n/node-cli/eslint` composition, the byte-exact `Return All`/`Limit` strings, the
`/connect/create-nodes/**` doc paths that replaced the 404'd `/integrations/creating-nodes/**`).
No file-by-file architecture tour.

---

## Part 6 — Ordered execution

Steps 1-8 touch **code only**. All prose lands once, in step 9, against the final state — the
earlier draft edited README/CHANGELOG/`api-coverage.md` twice.

1. **Trigger** — delete `restartWebhook` (B1); `usableAsTool: undefined` (H2); add the
   `description.webhooks` contract test.
2. **Scope cuts** — Part 0, *including* deleting `mutationOperations` and `webhookDeleteOptions` in
   the same commit (otherwise `noUnusedLocals` breaks the build) and collapsing the six collections.
3. **Action-node correctness** — hoist `contact:getMany` (B2); hoist `pageSize` (B3); add the
   `limit=150` two-page query assertion and the
   `returnFullResponse`/`ignoreHttpStatusErrors` assertion.
4. **CI** — scope the grep (B4), verify locally it exits **1**; drop duplicate Lint/Build from
   `publish.yml` (`n8n-node release` already runs them, and `n8n-node build` starts with
   `rimraf('dist')`, so the inspected tarball is deleted before publish); pin `publish.yml` actions
   (S3); rename the mislabelled CI steps.
5. **Input handling & UX** — `parseJsonInput` widening (H1); `getTemplates` filter (H4);
   `profile.update` guard (H5); resourceLocator `mode: 'list'` (N1); `e.g. ` placeholders (N2);
   rethrow `NodeOperationError`/`NodeApiError` first at `transport/index.ts:103` (N6 — today n8n's
   own `Credentials for 'sentApi' could not be found` is relabelled "Network request failed");
   `meta`/`_meta` key mismatch at `:190-191` (N7).
6. **Deletions** — Part 4 (dead types, examples, `maintainers`, `AGENTS.md` table).
7. **Trigger hardening** — one-line bracket strip in `isPublicWebhookUrl` (S2).
8. **Icons** — write both SVGs fresh (B5); themed credential icon (H6);
   `git rm "Sent-logo dark.svg"` (N3 — verified `fill="#060606"`, it is the **light** icon under a
   dark filename).
9. **Coverage** — 37-row operation table; `test/execute.test.ts` (H8).
10. **All prose, once** — README/CHANGELOG/SECURITY/CODE_OF_CONDUCT placeholder removal (B7);
    resource tables reflecting Part 0; `docs.sent.dm/reference/api/authentication` everywhere (the
    `/api-reference/` form is a 308 catch-all soft-404) (N4); n8n doc links → `/connect/create-nodes/**`
    (N5) — but **not** `SentTrigger.node.ts:90`'s `docs.n8n.io/code/expressions/`, which is 404 yet
    required verbatim by `node-param-description-wrong-for-dynamic-multi-options`; static-data
    disclosure (S1); regenerate `verification-readiness.md` from real command output; then
    `CLAUDE.md` + `AGENTS.md` (Part 5).
11. **Release** — CHANGELOG entry, then the B6 bootstrap sequence.

Also: copy this plan to a new `plans/` directory in the repo for human review, as requested.

---

## Verification

Nothing has been executed yet — `node_modules` is absent.

```bash
pnpm install && pnpm run lint && pnpm test && pnpm run build
npm pack --dry-run   # dist/nodes, dist/credentials, dist/icons, README, LICENSE, CHANGELOG — nothing else
git grep -nE 'NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized[[:space:]]*:[[:space:]]*false|process\.env|child_process|eval\(' -- nodes credentials package.json ; echo "EXIT=$?"   # must be 1
```

**Local n8n smoke test** (`pnpm run dev`) — the only way to verify B1:

- Square, legible icon in both themes; credential icon visible on dark.
- `Contact → Get Many` returns records (B2 — currently throws).
- `Contact → Get Many`, `Return All = false`, `Limit = 150` → 150 **distinct** records (B3).
- `Template Parameters` = `={{ $json.vars }}` where `vars` is an object → no error (H1).
- Drop **Sent Trigger**: the Production URL panel renders `https://<host>/webhook/<uuid>/webhook` —
  its reappearance is the visible signal B1 landed.
- Activate against real credentials → exactly one `POST /v3/webhooks`; webhook appears in Sent.
- Real event → workflow runs; output has no `signingSecret` / `x-webhook-signature`.
- Forged body → **401**, and **no execution row created**.
- Deactivate → webhook deleted at Sent, static data cleared.
- "Sent Trigger Tool" must **not** exist in the AI Tools panel (H2).

**Post-publish:** `npm view … dist.attestations`, then `npx @n8n/scan-community-package@0.31.0`
**and** `@beta` — the Portal has been observed running ahead of `latest`.
