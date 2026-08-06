# @sentdm/n8n-nodes-sent

An n8n community node package for the Sent API. It provides a `Sent` action node for the stable Sent API v3 resources and a `Sent Trigger` that registers, verifies, and removes Sent webhooks through the n8n webhook lifecycle.

## Compatibility

- Node.js 22 or later (matching the current official n8n starter requirement)
- n8n versions supporting community nodes built with `n8nNodesApiVersion: 1`
- Sent API v3 at `https://api.sent.dm`
- Development alignment: `@n8n/node-cli` 0.42.1

The package has no runtime dependencies. `n8n-workflow` is a peer dependency.

## Installation

Follow n8n's [community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management) and install the exact npm name:

```text
@sentdm/n8n-nodes-sent
```

For local development, clone the repository, use Node.js 22 or later, and run `npm install` followed by `npm run dev`.

## Credentials and authentication

Create a Sent API key in Sent, then create a **Sent API** credential in n8n and paste the key into **API Key**. The credential injects the secret as `x-api-key` and tests it with `GET /v3/me`. The key is a password field and is never returned in node output. When using an organization-level API key, set the optional **Profile ID** to target a child profile; the credential then also sends `x-profile-id`.

See Sent's [authentication documentation](https://docs.sent.dm/reference/api/authentication) for API-key types and permissions.

## Resources and operations

| Resource | Operations |
| --- | --- |
| Account | Get authenticated account |
| Message | Send, Get, Get Activities |
| Contact | Get, Get Many |
| Phone Number | Lookup |

The endpoint-by-endpoint matrix is in [API coverage](https://github.com/sentdm/n8n-nodes-sent/blob/main/docs/verification/api-coverage.md).

## Send Message

**Message → Send** accepts up to 1,000 comma-separated recipients, free-form text or a template selected by name/ID, template variables as a JSON object, channels, sandbox mode, and an optional idempotency key.

The channel choices follow Sent's documented semantics:

- `sent` lets Sent route and auto-detect the channel and is the default.
- `sms`, `whatsapp`, and `rcs` explicitly select those channels.
- `sent` cannot be combined with an explicit channel; the node stops before sending if both are selected.
- Selecting several explicit channels broadcasts separately on each channel. The array is not a fallback priority list; WhatsApp plus SMS may create two messages for every recipient.
- Cross-channel fallback is controlled by Sent routing, not by option order.

Sent currently documents no scheduling field in the v3 send-message request, so this package does not invent one.

**Template Parameters** accepts either literal JSON text or an expression that resolves to an object, for example `={{ $json.variables }}`.

## Sandbox and idempotency

**Message → Send** is the only operation that changes state, and it carries an **Options** collection with **Sandbox** and **Idempotency Key**. Sandbox is an operation-level option, not a credential toggle: it is implemented by sending `sandbox: true` in the request body.

## Pagination

**Contact → Get Many** exposes **Return All** and **Limit**. The paginator requests a constant page size of at most 100 items, preserves ordering, stops when `has_more` is false or data is empty, honors the requested limit, and has a 10,000-page safety guard.

Read operations whose Sent response contains more than ten fields expose **Output** with **Simplified**, **Raw**, and **Selected Fields** modes. Simplified output contains at most ten useful fields, while Selected Fields always retains the record ID. **Contact → Get** also provides a searchable contact picker with a by-ID fallback.

## Sent Trigger

The trigger registers the n8n production webhook URL when a workflow activates and stores the returned webhook ID and signing secret in node workflow static data. Activation validates the remote URL, event filters, retry/timeout settings, active state, and local signing secret; it updates or reactivates a stale registration and safely recreates one whose secret is unavailable. A persisted request key makes a retried create idempotent. Deactivation deletes only the stored webhook. Sent must be able to reach a public HTTPS URL; non-HTTPS URLs, `localhost`, `.local` names, IPv4 loopback/private ranges, `0.0.0.0`, and IPv6 loopback are rejected.

The trigger subscribes to the `message` event category. It dynamically loads active `message.*` subtypes from `GET /v3/webhooks/event-types`. It falls back to the documented static subtype list when Sent is temporarily unavailable, rate-limited, or returns no active `message.*` type. Authentication and other non-transient client errors are surfaced instead of being hidden by the fallback.

### Webhook security

Every delivery is verified before workflow execution using the exact raw body and Sent's HMAC-SHA256 construction:

```text
HMAC-SHA256(base64decode(secret after whsec_), webhookId + "." + timestamp + "." + rawBody)
```

The expected header value is `v1,<base64 digest>`. Comparisons use Node.js `timingSafeEqual`; missing or malformed headers, modified bodies, and timestamps outside the ±300-second replay window receive HTTP 401 and start no execution. The trigger never emits the signing secret or the signature header in its output.

**Where the signing secret is stored.** Sent returns a webhook's signing secret only from `POST /v3/webhooks`, so it cannot be supplied as a credential field without giving up automatic registration. Like n8n's built-in Stripe and GitHub triggers, this node keeps the secret in workflow static data. n8n persists static data in the `workflow_entity.staticData` column, which is **not** covered by `N8N_ENCRYPTION_KEY`, and copies it into saved execution records. Treat database and execution-log access as equivalent to access to the signing secret. If the secret is exposed, rotate it in Sent, then deactivate and reactivate the n8n workflow so the trigger registers a new webhook and stores its new secret. Sent's webhook read response does not reveal a rotated secret, so an out-of-band rotation cannot be repaired automatically. Verification fails closed: without a matching stored secret every delivery is rejected with 401.

Valid output includes the event category/type, payload, webhook ID/timestamp, safe relevant headers, parsed raw event, and an idempotency key. Where possible, the key combines the resource ID, transition, and event occurrence timestamp; otherwise it uses a SHA-256 hash of the raw body. Exact redeliveries retain the same key while later occurrences of a repeated status remain distinct. Durable deduplication must be implemented in the workflow; see [the Postgres deduplication example](https://github.com/sentdm/n8n-nodes-sent/blob/main/examples/workflows/07-durable-webhook-deduplication.json).

### Local webhook testing

Run `npm run dev`. Use a secure public HTTPS tunnel or an n8n instance with a public production webhook URL, then activate the workflow. Do not use a tunnel URL you do not control, and never put the signing secret in workflow fields or logs.

## Errors, rate limits, and retries

Sent errors are surfaced with the HTTP status, safe Sent code/message, request ID, validation details, documentation URL, and `Retry-After` when present. Secret, token, phone, recipient, and body fields are redacted from validation details. The node handles 204 responses and n8n **Continue On Fail** item behavior; failed items retain structured `errorCode`, `httpCode`, `requestId`, `retryAfter`, and `documentationUrl` fields when Sent provides them. Mutations are never retried automatically because replaying them without an intentional idempotency key can duplicate side effects. Build rate-limit handling in the workflow using `Retry-After` and an explicit policy.

## Example workflows

Seven importable workflows live in [`examples/workflows`](https://github.com/sentdm/n8n-nodes-sent/tree/main/examples/workflows), with an [index](https://github.com/sentdm/n8n-nodes-sent/blob/main/examples/workflows/README.md) mapping each one to the operations it demonstrates:

| # | Workflow | Shows |
| --- | --- | --- |
| 01 | Send a Text Message | `Message → Send` |
| 02 | Send a Template Message | `Message → Send` with variables |
| 03 | Validate a Number Before Sending | `Phone Number → Lookup` gating a send |
| 04 | Track Delivery Status | `Message → Get` and `Get Activities` |
| 05 | Message Contacts in Batches | `Contact → Get Many` through Loop Over Items |
| 06 | Inbound Message Trigger | `Sent Trigger` |
| 07 | Durable Webhook Deduplication | `Sent Trigger` with a Postgres `ON CONFLICT` claim |

They contain placeholders only — no credential IDs, no secrets, and phone numbers drawn from ranges reserved for fiction. Every send sets **Sandbox**, so importing and running one cannot deliver a real message. `test/examples.test.ts` asserts all of that, and fails if an example drifts from the node's actual parameters.

## Known limitations

- Sent's documented v3 send schema has no scheduling input.
- Webhook registration requires a public HTTPS URL and real Sent credentials; it cannot be exercised against `localhost`.
- The action node is deliberately scoped to sending messages and reading their status. Template authoring, user and seat administration, brand-profile onboarding, brand campaigns, and webhook administration are all console tasks and are not exposed as actions. `Message → Send` still selects an existing template, and the searchable picker still lists them.
- Webhook lifecycle is owned by **Sent Trigger**, which registers, repairs, reactivates, and removes its own webhook. There is no action-node equivalent. If a webhook signing secret is rotated directly in Sent, deactivate and reactivate the workflow because Sent does not return the replacement secret from its webhook read endpoint.

## Development and testing

Use the repository-local CLI; no global install is required.

```bash
npm install
npm run dev
npm run lint
npm run lint:fix
npm test
npm run build
npm pack --dry-run
```

Direct CLI commands use `npx n8n-node <command>`. Tests use mocked responses only.

## Publishing

Publication runs from GitHub Actions with npm provenance; see [`.github/workflows/publish.yml`](https://github.com/sentdm/n8n-nodes-sent/blob/main/.github/workflows/publish.yml). Because npm can only attach a Trusted Publisher after the package exists, the first release uses a short-lived `NPM_TOKEN` in that same workflow. After the provenance-enabled public package is created, configure the OIDC Trusted Publisher, delete the repository secret, and revoke the token. Never bootstrap the package with a local publish. The exact ordering is in the [submission checklist](https://github.com/sentdm/n8n-nodes-sent/blob/main/docs/verification/submission-checklist.md).

Only n8n can grant verified status.

## Support and security

- Product/API support: [support@sent.dm](mailto:support@sent.dm)
- Package issues: [GitHub Issues](https://github.com/sentdm/n8n-nodes-sent/issues)
- Security reports: follow [SECURITY.md](https://github.com/sentdm/n8n-nodes-sent/blob/main/SECURITY.md)

## Resources

- [Sent API documentation](https://docs.sent.dm)
- [Sent authentication](https://docs.sent.dm/reference/api/authentication)
- [n8n node-building documentation](https://docs.n8n.io/connect/create-nodes/overview)
- [n8n community nodes](https://docs.n8n.io/integrations/community-nodes)
- [Official n8n starter](https://github.com/n8n-io/n8n-nodes-starter)
- [n8n Creator Portal](https://creators.n8n.io/nodes)

## Version history

See [CHANGELOG.md](https://github.com/sentdm/n8n-nodes-sent/blob/main/CHANGELOG.md).
