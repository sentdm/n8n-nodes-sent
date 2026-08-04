# @sentdm/n8n-nodes-sent

An n8n community node package for the Sent API. It provides a `Sent` action node for the stable Sent API v3 resources and a `Sent Trigger` that registers, verifies, and removes Sent webhooks through the n8n webhook lifecycle.

> **Package status:** pre-publication candidate. The package has not been published to npm, submitted to the n8n Creator Portal, or verified by n8n. Maintainer details require human confirmation before release.

## Compatibility

- Node.js 22 or later (matching the current official n8n starter requirement)
- n8n versions supporting community nodes built with `n8nNodesApiVersion: 1`
- Sent API v3 at `https://api.sent.dm`
- Development alignment: `@n8n/node-cli` 0.42.0

The package has no runtime dependencies. `n8n-workflow` is a peer dependency.

## Installation

After the package is publicly published, follow n8n's [community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and install the exact npm name:

```text
@sentdm/n8n-nodes-sent
```

For local development, clone the repository, use Node.js 22 or later, and run `npm install` followed by `npm run dev`.

## Credentials and authentication

Create a Sent API key in Sent, then create a **Sent API** credential in n8n and paste the key into **API Key**. The credential injects the secret as `x-api-key` and tests it with `GET /v3/me`. The key is a password field and is never returned in node output.

See Sent's [authentication documentation](https://docs.sent.dm/api-reference/authentication) for API-key types and permissions. Organization keys can use **Profile Scope ID** on node operations that need `x-profile-id` scoping.

## Resources and operations

| Resource | Operations |
| --- | --- |
| Account | Get authenticated account |
| Message | Send, Get, Get Activities |
| Conversation | Get Many, Get Messages |
| Contact | Create, Delete, Get, Get Many, Update, Get Message Summary |
| Template | Create, Delete, Get, Get Many, Update |
| Profile | Create, Delete, Get, Get Many, Update, Complete Setup |
| Campaign | Create, Delete, Get Many, Update |
| User | Get, Get Many, Invite, Update Role, Remove |
| Webhook | Create, Delete, Get, Get Many, Update, Toggle Status, Rotate Signing Secret, Test, Get Events, Get Event Types |
| Number Lookup | Lookup |

The endpoint-by-endpoint matrix and implementation status are in [API coverage](https://github.com/sentdm/n8n-nodes-sent/blob/main/docs/verification/api-coverage.md).

## Send Message

**Message → Send** accepts one or more comma-separated recipients, free-form text or a template selected by name/ID, template variables as a JSON object, channels, sandbox mode, and an optional idempotency key.

The channel choices follow Sent's documented semantics:

- `sent` lets Sent route and auto-detect the channel and is the default.
- `sms`, `whatsapp`, and `rcs` explicitly select those channels.
- Selecting several explicit channels broadcasts separately on each channel. The array is not a fallback priority list; WhatsApp plus SMS may create two messages for every recipient.
- Cross-channel fallback is controlled by Sent routing, not by option order.

Sent currently documents no scheduling field in the v3 send-message request, so this package does not invent one.

## Sandbox behavior

Sandbox is an operation-level option only where the current Sent endpoint documents it. It is not a credential toggle. Sent documents sandbox support for mutations except webhook deletion. For that exception, the node omits both sandbox and idempotency controls. Sandbox behavior is implemented by passing `sandbox: true`; the package does not claim that a live side effect test was performed without a user-provided API key.

## Pagination

Sent's paginated list operations expose **Return All** and **Limit**. The shared paginator requests pages of at most 100 items, preserves ordering, stops when `has_more` is false or data is empty, honors the requested limit, and has a 10,000-page safety guard. Profile, campaign, and user list endpoints currently return their complete documented collection without pagination parameters.

## Sent Trigger

The trigger registers the n8n production webhook URL when a workflow activates, stores the returned webhook ID and signing secret in node workflow static data, checks for an existing registration, and deletes only that stored webhook when the workflow deactivates. Sent must be able to reach a public HTTPS URL; localhost, private-network, and non-HTTPS URLs are rejected.

The trigger dynamically loads active `message.*` event subtypes from `GET /v3/webhooks/event-types` and falls back to the documented static subtype list during a temporary API failure. Template filters accept comma-separated template names.

### Webhook security

Every delivery is verified before workflow execution using the exact raw body and Sent's HMAC-SHA256 construction:

```text
HMAC-SHA256(base64decode(secret after whsec_), webhookId + "." + timestamp + "." + rawBody)
```

The expected header value is `v1,<base64 digest>`. Comparisons use Node.js `timingSafeEqual`; missing or malformed headers, modified bodies, and timestamps outside the ±300-second replay window receive HTTP 401. Signing secrets and signature headers are not emitted in workflow data.

Valid output includes the event category/type, payload, webhook ID/timestamp, safe relevant headers, parsed raw event, and a transition-specific or hashed idempotency key. Durable deduplication must be implemented in the workflow; see [the Postgres deduplication example](https://github.com/sentdm/n8n-nodes-sent/blob/main/examples/workflows/09-durable-webhook-deduplication.json).

### Local webhook testing

Run `npm run dev`. Use a secure public HTTPS tunnel or an n8n instance with a public production webhook URL, then activate the workflow. Do not use a tunnel URL you do not control, and never put the signing secret in workflow fields or logs.

## Errors, rate limits, and retries

Sent errors are surfaced with the HTTP status, safe Sent code/message, request ID, validation details, documentation URL, and `Retry-After` when present. The node handles 204 responses and n8n **Continue On Fail** item behavior. Mutations are never retried automatically because replaying them without an intentional idempotency key can duplicate side effects. Build rate-limit handling in the workflow using `Retry-After` and an explicit policy.

## Example workflows

Importable JSON examples live in [`examples/workflows`](https://github.com/sentdm/n8n-nodes-sent/tree/main/examples/workflows): sandbox send, template send, message status, contact create/get, template list, number lookup, message-status trigger, inbound-message trigger, and durable webhook deduplication. They contain placeholders only—no credential IDs, secrets, or real phone numbers.

## Known limitations

- This is an unpublished candidate and cannot yet pass the scanner mode that downloads a package from npm.
- The maintainer identity/contact requires confirmation.
- Sent's documented v3 send schema has no scheduling input.
- Some complex campaign, profile, template, and webhook filter objects use validated advanced JSON fields to preserve the current documented schema without inventing UI fields.
- Webhook registration requires public HTTPS and real Sent credentials for an end-to-end activation test.

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

## Publishing overview

Publishing is intentionally not performed by this task. After human review, use `npm run release` to prepare a version/tag and let `.github/workflows/publish.yml` publish from GitHub Actions with npm provenance and Trusted Publisher/OIDC. Then verify the public repository, npm metadata, provenance, tag/version match, scanner result, and URLs before entering the exact npm name in the [n8n Creator Portal](https://creators.n8n.io/nodes).

Only n8n can grant verified status.

## Support and security

- Product/API support: [support@sent.dm](mailto:support@sent.dm) (documented by Sent; confirm before publication)
- Package issues: [GitHub Issues](https://github.com/sentdm/n8n-nodes-sent/issues)
- Security reports: follow [SECURITY.md](https://github.com/sentdm/n8n-nodes-sent/blob/main/SECURITY.md)
- Maintainer contact: human confirmation required before publication

## Resources

- [Sent API documentation](https://docs.sent.dm)
- [Sent authentication](https://docs.sent.dm/api-reference/authentication)
- [n8n node-building documentation](https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/)
- [n8n community nodes](https://docs.n8n.io/integrations/community-nodes/)
- [Official n8n starter](https://github.com/n8n-io/n8n-nodes-starter)
- [n8n Creator Portal](https://creators.n8n.io/nodes)

## Version history

See [CHANGELOG.md](https://github.com/sentdm/n8n-nodes-sent/blob/main/CHANGELOG.md). Version `0.1.0` is the initial, unpublished candidate.
