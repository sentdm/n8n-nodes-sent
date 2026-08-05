# Sent API v3 coverage

Live Sent documentation was reviewed on 2026-08-04. The review found 43 distinct stable public v3 method/path operations. This package exposes **21** of them; the 22 deliberate exclusions are listed at the bottom. No undocumented endpoint is implemented.

Every operation below has a matching row in the `matrix` table in `test/operations.test.ts`, which asserts its HTTP method and path. That test compares its own matrix against the operations declared in `properties.ts` and fails if either side gains or loses an operation, so the node and the test cannot drift. This markdown table is **not** machine-checked and must be updated by hand alongside them. The "Test status" column names the test that covers the operation; a live endpoint call remains a manual pre-release check.

| # | Sent resource | Method | Endpoint | n8n resource / operation | Test status | Notes |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Account | GET | `/v3/me` | Account / Get | Matrix + credential | Credential test target |
| 2 | Message | POST | `/v3/messages` | Message / Send | Matrix + direct | Text/template; Sent/SMS/WhatsApp/RCS; sandbox; idempotency |
| 3 | Message | GET | `/v3/messages/{messageId}` | Message / Get | Matrix + execute | Exact ID |
| 4 | Message | GET | `/v3/messages/{messageId}/activities` | Message / Get Activities | Matrix | Exact ID |
| 5 | Contact | GET | `/v3/contacts/{contactId}` | Contact / Get | Matrix | — |
| 6 | Contact | GET | `/v3/contacts` | Contact / Get Many | Matrix + pagination | Filters, Return All, Limit |
| 7 | Campaign | POST | `/v3/profiles/{profileId}/campaigns` | Brand Campaign / Create | Matrix | Campaign object as validated JSON |
| 8 | Campaign | DELETE | `/v3/profiles/{profileId}/campaigns/{campaignId}` | Brand Campaign / Delete | Matrix | Documented sandbox support |
| 9 | Campaign | GET | `/v3/profiles/{profileId}/campaigns` | Brand Campaign / Get Many | Matrix | API returns a complete array; no invented pagination |
| 10 | Campaign | PUT | `/v3/profiles/{profileId}/campaigns/{campaignId}` | Brand Campaign / Update | Matrix | Campaign object as validated JSON |
| 11 | Webhook | POST | `/v3/webhooks` | Webhook / Create | Matrix + lifecycle | Also used by Sent Trigger activation |
| 12 | Webhook | DELETE | `/v3/webhooks/{webhookId}` | Webhook / Delete | Matrix + lifecycle | No sandbox or idempotency; documented exception, and the Options collection is hidden for it |
| 13 | Webhook | GET | `/v3/webhooks/{webhookId}` | Webhook / Get | Matrix + lifecycle | Trigger existence check |
| 14 | Webhook | GET | `/v3/webhooks/{webhookId}/events` | Webhook / Get Events | Matrix + pagination | Return All, Limit |
| 15 | Webhook | GET | `/v3/webhooks/event-types` | Webhook / Get Event Types | Matrix | Trigger dynamic options with fallback |
| 16 | Webhook | GET | `/v3/webhooks` | Webhook / Get Many | Matrix + pagination | Filters, Return All, Limit |
| 17 | Webhook | POST | `/v3/webhooks/{webhookId}/rotate-secret` | Webhook / Rotate Signing Secret | Matrix | New secret returned only by the action call |
| 18 | Webhook | POST | `/v3/webhooks/{webhookId}/test` | Webhook / Test | Matrix | Event type input |
| 19 | Webhook | PATCH | `/v3/webhooks/{webhookId}/toggle-status` | Webhook / Toggle Status | Matrix | Active boolean |
| 20 | Webhook | PUT | `/v3/webhooks/{webhookId}` | Webhook / Update | Matrix | Full configuration update |
| 21 | Number Lookup | GET | `/v3/numbers/lookup/{phoneNumber}` | Number Lookup / Lookup | Matrix | International number input |

## Deliberately excluded operations

These 22 documented stable endpoints are intentionally not exposed. `test/operations.test.ts` asserts that each removed resource/operation pair now raises `Unsupported Sent operation`.

| Sent resource | Method | Endpoint | Reason |
| --- | --- | --- | --- |
| Conversation | GET | `/v3/conversations` | Returns message records already reachable through Message operations; the extra resource added a second, near-duplicate list surface |
| Conversation | GET | `/v3/conversations/{id}` | Same as above |
| Contact | POST | `/v3/contacts` | Contact creation is a side effect of sending; exposing it invited duplicate-contact workflows |
| Contact | DELETE | `/v3/contacts/{contactId}` | Irreversible removal of a contact and its history, with no undo and little automation value; Contact is intentionally read-only |
| Contact | PATCH | `/v3/contacts/{contactId}` | Only `default_channel` and `opt_out` were settable, and both were buried in an options collection |
| Contact | GET | `/v3/contacts/{contactId}/message-summary` | Aggregate reporting endpoint with no workflow-automation use case found |
| Template | POST | `/v3/templates` | Template authoring is a console task, not a workflow step; `Message → Send` still selects an existing template |
| Template | DELETE | `/v3/templates/{templateId}` | Same as above |
| Template | GET | `/v3/templates/{templateId}` | Same as above |
| Template | GET | `/v3/templates` | Not exposed as an action, but still backs the searchable template picker on `Message → Send` |
| Template | PUT | `/v3/templates/{templateId}` | Full-replace PUT that would silently reset category, language and definition to node defaults |
| User | GET | `/v3/users/{userId}` | Team and seat administration is a console task with no automation use case found |
| User | GET | `/v3/users` | Same as above |
| User | POST | `/v3/users` | Same as above; automated invitations are a security-sensitive surface |
| User | DELETE | `/v3/users/{userId}` | Same as above; irreversible seat removal |
| User | PATCH | `/v3/users/{userId}` | Same as above; automated privilege changes are a security-sensitive surface |
| Profile | POST | `/v3/profiles` | Brand/sender profile onboarding is a console task with carrier review steps that do not fit a workflow |
| Profile | DELETE | `/v3/profiles/{profileId}` | Same as above; irreversible and would orphan campaigns |
| Profile | GET | `/v3/profiles/{profileId}` | Same as above |
| Profile | GET | `/v3/profiles` | Same as above |
| Profile | PATCH | `/v3/profiles/{profileId}` | Same as above |
| Profile | POST | `/v3/profiles/{profileId}/complete` | Same as above; completion is a one-off onboarding step |

Brand Campaign operations still route through `/v3/profiles/{profileId}/campaigns`, so the campaign forms keep their own **Profile ID** field. Take that ID from the Sent console.

No deprecated, private, beta, or inferred routes are included. Live side-effect testing requires a user-authorized Sent API key; implementation and mocked verification are complete.
