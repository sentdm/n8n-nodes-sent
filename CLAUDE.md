# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`@sentdm/n8n-nodes-sent` is an n8n community node package for the Sent API v3 — a `Sent` action node
(4 resources / 7 operations), a `Sent Trigger` webhook node, and a `Sent API` credential. The goal is
verification through the [n8n Creator Portal](https://creators.n8n.io/nodes), so **n8n's published
requirements are acceptance criteria, not suggestions**.

## Commands

`npm` owns the committed lockfile and both GitHub Actions workflows run `npm ci`. Locally you may use
`pnpm` (`pnpm-lock.yaml` and `pnpm-workspace.yaml` are gitignored). If you change dependencies,
regenerate `package-lock.json` too or CI will drift.

```bash
pnpm run lint         # n8n-node lint — eslint ONLY, does not typecheck
pnpm exec tsc --noEmit -p tsconfig.json
pnpm test             # vitest, mocked responses only
pnpm run build        # rimraf dist, tsc, then copy **/*.svg into dist/
pnpm run dev          # local n8n with the node linked — the only way to test webhook activation
npm pack --dry-run    # must list dist/{nodes,credentials,icons}, README, LICENSE, CHANGELOG
```

**`pnpm run lint` exits 0 while `tsc` is broken.** Never treat a green lint as "it compiles".
`/verify` runs the whole gate sequence; use it before claiming anything works.

## Three things no tool will tell you

**1. n8n's parameter lint rules do not fire in this repo.** Twelve rules in
`eslint-plugin-n8n-nodes-base` — including every operation/option naming rule — return early on
`options.hasPropertyPointingToIdentifier`, and `properties.ts` builds each Operation property's
options from a factory rather than an inline literal. A deliberately non-compliant operation
(`{ name: 'Get All Contacts', value: 'getAll', action: 'Get all contacts' }`) passes lint with exit 0.
Operation naming is enforced by **human review at the Portal**, so `test/ux-guidelines.test.ts`
encodes those rules instead.

**2. The n8n Cloud ruleset bans `node:fs`, `node:path` and `__dirname` in every `.ts` file, tests
included**, and sets `allowInlineConfig: false` so `eslint-disable` does nothing. To read a file in a
test, use Vite's `?raw` import or `import.meta.glob` (see `test/icons.test.ts`, `test/examples.test.ts`).

**3. `eslint.config.mjs` is byte-compared** against the CLI's bundled template. Reformatting it aborts
lint with "Strict mode violation". Leave it exactly as it is.

## UX guidelines are gating

`docs.n8n.io/connect/create-nodes/build-your-node/reference/ux-guidelines` opens with "your node's UI
must conform to these guidelines to be a verified community node candidate". The two naming fields
have **opposite** rules — this is easy to get backwards:

| Field | Where it renders | Rule |
| --- | --- | --- |
| `name` | Operation dropdown, resource shown above | **Don't** repeat the resource → `Get`, `Get Many` |
| `action` | Node picker, no resource context | **Do** repeat it, and omit articles → `Get contacts` |

Resource names are nouns (`Phone Number`, not `Number Lookup`). Every operation needs an `action` and
a `description`. Placeholders start with `e.g. `. These literals are required byte-for-byte:
`Return All` / `Whether to return all results or only up to a given limit`,
`Max number of results to return` (default `50`), and dynamic multi-options descriptions must end with
`Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>`
— that URL is hard-coded in the plugin and required verbatim even though it now redirects. Do not "fix" it.

## Layout and the one seam

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

`properties.ts → operations.ts → transport/index.ts` is one-way. `operations.ts` performs no I/O — it
returns a plain `BuiltOperation`, which is why every operation is asserted without a network mock.

**A parameter only exists at runtime if `properties.ts` renders it.** Reading an ID before the branch
that needs it breaks the operations that don't render it — the reason `contact.getMany` must resolve
before the `identifier(context, itemIndex, 'contactId')` call.

## Trigger traps

Activation calls `checkExists` then `create`, which `POST /v3/webhooks` and stores
`{ webhookId, signingSecret }` in `getWorkflowStaticData('node')`. Sent returns the signing secret
**only** from that create call, so it cannot move to a credential field without giving up
auto-registration. Both traps below are invisible to lint, `tsc`, and unit tests that call
`webhookMethods` directly:

- **Never add `restartWebhook: true`.** It marks a wait/resume webhook, and every caller of
  `getNodeWebhooks()` passes `ignoreRestartWebhooks = true` — so no webhook is collected, none is
  registered at Sent, and no route is mounted. The trigger is silently dead.
- **Never set `usableAsTool` on the trigger.** `createAiTools` filters on `Boolean(usableAsTool)` with
  no trigger guard, producing a phantom tool whose `execute` is `undefined`. The type is
  `true | UsableAsToolDescription | undefined`, so `false` is a TS2322 error — use `undefined`.

## Icons

The two SVGs are named by **glyph colour**, while n8n's `light`/`dark` keys name the **theme the icon
renders in**. The mapping is therefore deliberately crossed and must stay that way:
`light → sent-dark-icon.svg` (`#060606`), `dark → sent-light-icon.svg` (`#FFFFFF`). Matching them by
name puts a white glyph on n8n's white canvas and the icon disappears.

## `package.json` `n8n` block

`n8n.nodes` and `n8n.credentials` list **built** paths under `dist/`. Adding, renaming or removing a
node or credential means editing them; nothing else validates the mapping. `files` must keep shipping
`dist/icons` — the nodes reference `file:../../icons/*.svg` and the credential, one directory
shallower in `dist/`, references `file:../icons/*.svg`.

## Testing contract

Any rule n8n enforces by **human review only** gets a guard test, because lint cannot see it. Four
already exist — extend them rather than duplicating:

| Test | Guards |
| --- | --- |
| `operations.test.ts` | one row per declared operation; fails if the matrix and `properties.ts` disagree |
| `ux-guidelines.test.ts` | operation naming, articles, Title Case, descriptions |
| `icons.test.ts` | the crossed theme mapping, by luminance rather than filename |
| `examples.test.ts` | examples only use declared parameters, ship no credential IDs, and always set Sandbox |

Assert on `error.message` and `error.description`, **not `JSON.stringify(error)`** — `Error#message`
is non-enumerable, so a stringify-only assertion cannot see the field most likely to leak a secret.

When you change a guard, prove it still bites: revert the fix, confirm the test fails, restore.

## Working conventions

- You may `git add` to keep related changes together (a deletion and its replacement must not be
  staged apart). **Never commit** — hand off a summary of what changed instead.
- n8n reads node types **once at startup**. After changing `properties.ts` or a node description, a
  running dev instance keeps serving the old registry — restart it (`/n8n-reload`) before concluding
  a change didn't work.
- Docs URLs: `docs.n8n.io/integrations/creating-nodes/**` now redirects to
  `docs.n8n.io/connect/create-nodes/**`. Sent's auth page is
  `docs.sent.dm/reference/api/authentication`; the `/api-reference/` form 308s to a section index and
  reads as a soft 404. Link the canonical forms.
- Publication is human-only and order-dependent: see `docs/verification/submission-checklist.md`.
  The repo must be public *before* the first publish, and npm needs an existing package before a
  Trusted Publisher can be attached.
