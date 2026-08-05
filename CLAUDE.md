# @sentdm/n8n-nodes-sent

An n8n community node package for the Sent API v3: a `Sent` action node and a `Sent Trigger`
webhook node, plus a `Sent API` credential. Target is n8n Cloud verification through the
[Creator Portal](https://creators.n8n.io/nodes).

## Commands

`npm` owns the committed lockfile and both GitHub Actions workflows use `npm ci`. Locally you may
use `pnpm` (`pnpm-lock.yaml` and `pnpm-workspace.yaml` are gitignored); if you change dependencies,
regenerate `package-lock.json` too or CI will drift.

```bash
pnpm install         # or npm install
pnpm run lint        # n8n-node lint — eslint only, it does NOT typecheck
pnpm test            # vitest, mocked responses only
pnpm run build       # n8n-node build — rimraf dist, then tsc, then copy **/*.svg
pnpm run dev         # boots a local n8n with the node linked; the only way to test activation
npm pack --dry-run   # must list dist/{nodes,credentials,icons}, README, LICENSE, CHANGELOG
```

`pnpm run lint` exits 0 while `tsc` still fails, so run `pnpm exec tsc --noEmit` or `pnpm run build`
before believing a change compiles.

## Layout and the one seam that matters

```
credentials/SentApi.credentials.ts   x-api-key header, GET /v3/me credential test
nodes/Sent/
  actions/properties.ts              the entire UI: resources, operations, displayOptions
  helpers/operations.ts              (resource, operation, params) -> { method, path, body, query }
  transport/index.ts                 HTTP, pagination, envelope unwrapping, error normalisation
  Sent.node.ts                       execute() loop + the getTemplates list search
nodes/SentTrigger/
  helpers/signature.ts               HMAC verification, idempotency key, public-URL check
  SentTrigger.node.ts                webhookMethods lifecycle + webhook() handler
```

`properties.ts -> operations.ts -> transport/index.ts` is a one-way dependency. `operations.ts`
never performs I/O — it returns a plain `BuiltOperation`, which is why every operation can be
asserted without a network mock (`test/operations.test.ts`).

A parameter only exists at runtime if `properties.ts` renders it. Reading an ID before the branch
that needs it therefore breaks the operations that do not render it — the reason `contact.getMany`
must resolve before the `identifier(context, itemIndex, 'contactId')` call.

## Trigger webhook lifecycle

Activation calls `checkExists` then `create`, which `POST /v3/webhooks` and stores
`{ webhookId, signingSecret }` in `getWorkflowStaticData('node')`. Deactivation calls `delete`.
Sent returns the signing secret **only** from the create call, so it cannot become a credential
field without giving up auto-registration.

Two traps, both invisible to lint, `tsc`, and unit tests that call `webhookMethods` directly:

- **Never add `restartWebhook: true`** to `description.webhooks`. It marks a wait/resume webhook.
  Every caller of `WebhookService.getNodeWebhooks()` passes `ignoreRestartWebhooks = true`, so the
  webhook is never collected, never registered at Sent, and no route is mounted — the trigger is
  silently dead in production *and* in test mode. Guarded by `test/trigger-lifecycle.test.ts`.
- **Never set `usableAsTool` on the trigger.** `createAiTools` filters on `Boolean(usableAsTool)`
  with no trigger guard, producing a phantom tool whose `execute` is `undefined`. The type is
  `true | UsableAsToolDescription | undefined`, so `false` is a TS2322 error — use `undefined`.

## `package.json` `n8n` block

`n8n.nodes` and `n8n.credentials` list **built** paths under `dist/`. Adding, renaming, or removing
a node or credential means editing them; nothing else validates the mapping. `files` must keep
shipping `dist/icons`: the nodes reference `file:../../icons/*.svg` and the credential, one directory
shallower in `dist/`, references `file:../icons/*.svg`.

## Strings the linter owns

`n8n-node lint` byte-compares `eslint.config.mjs` against its own bundled template and aborts with
"Strict mode violation" if they differ, so leave that file exactly as it is — do not reformat or
"simplify" it. It also sets `allowInlineConfig: false`, so `eslint-disable` comments do nothing.
These literals come from
`eslint-plugin-n8n-nodes-base/dist/lib/constants.js` and must match byte for byte:

| Parameter | Required text |
| --- | --- |
| `returnAll` display name / description | `Return All` / `Whether to return all results or only up to a given limit` |
| `limit` description / default | `Max number of results to return` / `50` |
| dynamic multi-options description ends with | `Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>` |
| string placeholders | must start with `e.g. ` |

That expressions URL is hard-coded in the plugin and is required verbatim even though it now
redirects elsewhere. Do not "fix" it.

## Docs URLs

n8n moved its node-building docs: `docs.n8n.io/integrations/creating-nodes/**` now redirects to
`docs.n8n.io/connect/create-nodes/**`. Sent's auth page is
`docs.sent.dm/reference/api/authentication`; the `/api-reference/` form 308s to a section index, so
it reads as a soft 404. Link the canonical forms.

## Testing contract

`test/operations.test.ts` holds one row per declared operation and fails if the matrix and
`properties.ts` disagree, so a new operation cannot ship without a method/path assertion. Assert on
`error.message` and `error.description`, not `JSON.stringify(error)` — `Error#message` is
non-enumerable, so a stringify-only assertion cannot see the field most likely to leak.
