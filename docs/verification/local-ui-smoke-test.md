# Local n8n UI smoke test

## Scope and environment

| Field | Result |
| --- | --- |
| Phase | Phase 2 only: local n8n UI smoke test |
| Date | 2026-08-04 |
| Last evidence time | 21:44:25 CEST |
| Node.js | v24.9.0 |
| npm | 11.6.0 |
| `@n8n/node-cli` | 0.42.0, repository-local |
| n8n | 2.33.3 |
| Development command | `N8N_PORT=5679 npm run dev` after the initial `npm run dev` session on port 5678 |
| Active editor URL | <http://localhost:5679/> |
| Development session | Detached `screen` session `n8n_sent_dev` |
| Startup log | `/private/tmp/n8n-sent-dev.log` |

The alternate port is temporary and was used to give the editor a fresh origin after the
port-5678 browser session cached the pre-fix node description. It does not change the package's
runtime behavior or publication configuration.

## Package discovery and UI evidence

- The authenticated editor loaded on port 5678 before the fresh-origin restart.
- The first-step selector found the Sent app and exposed one trigger, **On new Sent event**.
- Adding that trigger created a node whose panel title is **Sent Trigger**.
- The trigger panel rendered the **Sent API** credential selector, Message/Templates event
  categories, message subtype selector, trigger options, and output area.
- The Sent action catalog rendered 43 actions across Account, Brand Campaign, Contact,
  Conversation, Message, Number Lookup, Profile, Template, User, and Webhook resources.
- Adding **Send a message** rendered Recipients, Channels, Message Type, Template,
  Template Parameters, and Options.
- The Send Message Options picker rendered Idempotency Key, Profile Scope ID, and Sandbox.
- The **Sent API** credential dialog rendered one required API Key password field and linked to
  <https://docs.sent.dm/reference/api/authentication>. No credential or secret was entered or saved.
- The terminal contained no Sent node-loading, trigger-loading, credential-loading, or TypeScript
  compilation error.

## Defect found and repaired

The action-node smoke test exposed this n8n autosave error:

`Could not resolve parameter dependencies. Max iterations reached!`

The cause was `displayOptions` on child fields inside the `requestOptions` collection. n8n 2.33.3
resolves collection children independently, so those child rules referenced unavailable root-level
parameters and prevented any workflow containing the Sent action node from being saved.

The repair:

- removed display dependencies from all collection children;
- split operation-specific option collections into uniquely named top-level parameter groups;
- made request construction read the appropriate option group for update, delete, and remove
  operations; and
- added `test/property-schema.test.ts` to reject collection-child display dependencies and exercise
  n8n's parameter resolver with Send Message options.

Validation after the repair:

- `npm run lint`: passed;
- `npm test`: passed, 6 test files and 50 tests including the new schema regression coverage;
- `npm run build`: passed;
- generated node catalog scan: no `displayOptions` remain on collection children;
- n8n dependency-order simulation against the generated `CUSTOM.sent` schema: all properties
  resolved with no missing dependency;
- restarted development server: TypeScript zero errors, n8n 2.33.3 reachable on port 5679.

## Required manual workflow scenarios

| # | Scenario | Current local UI result |
| --- | --- | --- |
| 1 | Send a sandbox message | Send Message UI, placeholder recipient, Sandbox, and Idempotency Key rendered; live execution intentionally not attempted without a user-provided API key. |
| 2 | Send a template with variables | Template mode, template locator, and Template Parameters JSON rendered. |
| 3 | Get message status | **Get a message** and **Get message activities** appeared in the Sent action catalog; detailed fresh-origin panel check pending sign-in. |
| 4 | Create and retrieve a contact | Create/Get Contact actions appeared in the catalog; detailed fresh-origin panel check pending sign-in. |
| 5 | List templates | Get Many Templates appeared in the catalog; detailed fresh-origin panel check pending sign-in. |
| 6 | Number lookup | Look Up a Phone Number appeared in the catalog; detailed fresh-origin panel check pending sign-in. |
| 7 | Receive a message-status webhook | Sent Trigger rendered; fresh-origin event subtype and autosave check pending sign-in. |
| 8 | Receive inbound `message.received` | Sent Trigger rendered; fresh-origin event subtype and autosave check pending sign-in. |
| 9 | Durable webhook deduplication | Exported example exists; UI configuration and non-live evidence check pending sign-in. |

The nine credential-free example workflow exports remain under `examples/workflows/`. No live Sent
request, webhook registration, workflow publication, or credential creation was performed.

## Current blocker

The fresh-origin editor at <http://localhost:5679/signin> requires the existing owner account to be
signed in. n8n's browser authentication state did not carry from port 5678 to port 5679. After
sign-in, repeat the Sent action autosave proof, inspect the remaining scenario panels, rerun all
validation, and record the final Phase 2 result here.
