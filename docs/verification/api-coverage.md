# Sent API v3 coverage

Live Sent documentation was reviewed on 2026-08-04. The review found 43 distinct stable public v3 method/path operations. This package exposes **38** of them; the five deliberate exclusions are listed at the bottom. No undocumented endpoint is implemented.

Every operation below has a matching row in the `matrix` table in `test/operations.test.ts`, which asserts its HTTP method and path. That test compares its own matrix against the operations declared in `properties.ts` and fails if either side gains or loses an operation, so the node and the test cannot drift. This markdown table is **not** machine-checked and must be updated by hand alongside them. The "Test status" column names the test that covers the operation; a live endpoint call remains a manual pre-release check.

| # | Sent resource | Method | Endpoint | n8n resource / operation | Test status | Notes |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Account | GET | `/v3/me` | Account / Get | Matrix + credential | Credential test target |
| 2 | Message | POST | `/v3/messages` | Message / Send | Matrix + direct | Text/template; Sent/SMS/WhatsApp/RCS; sandbox; idempotency |
| 3 | Message | GET | `/v3/messages/{messageId}` | Message / Get | Matrix + execute | Exact ID |
| 4 | Message | GET | `/v3/messages/{messageId}/activities` | Message / Get Activities | Matrix | Exact ID |
| 5 | Contact | DELETE | `/v3/contacts/{contactId}` | Contact / Delete | Matrix | Documented sandbox support |
| 6 | Contact | GET | `/v3/contacts/{contactId}` | Contact / Get | Matrix | — |
| 7 | Contact | GET | `/v3/contacts` | Contact / Get Many | Matrix + pagination | Filters, Return All, Limit |
| 8 | Template | POST | `/v3/templates` | Template / Create | Matrix | Definition object |
| 9 | Template | DELETE | `/v3/templates/{templateId}` | Template / Delete | Matrix | Documented sandbox support |
| 10 | Template | GET | `/v3/templates/{templateId}` | Template / Get | Matrix | — |
| 11 | Template | GET | `/v3/templates` | Template / Get Many | Matrix + pagination | Filters, Return All, Limit; also backs the template picker |
| 12 | Template | PUT | `/v3/templates/{templateId}` | Template / Update | Matrix | Definition object |
| 13 | Profile | POST | `/v3/profiles` | Profile / Create | Matrix | Advanced documented fields as JSON |
| 14 | Profile | DELETE | `/v3/profiles/{profileId}` | Profile / Delete | Matrix | Documented sandbox support |
| 15 | Profile | GET | `/v3/profiles/{profileId}` | Profile / Get | Matrix | — |
| 16 | Profile | GET | `/v3/profiles` | Profile / Get Many | Matrix + execute | API returns the complete `profiles` collection; no invented pagination |
| 17 | Profile | PATCH | `/v3/profiles/{profileId}` | Profile / Update | Matrix | Rejects an update with no changed field rather than sending an empty PATCH |
| 18 | Profile | POST | `/v3/profiles/{profileId}/complete` | Profile / Complete Setup | Matrix | Webhook URL input |
| 19 | Campaign | POST | `/v3/profiles/{profileId}/campaigns` | Brand Campaign / Create | Matrix | Campaign object as validated JSON |
| 20 | Campaign | DELETE | `/v3/profiles/{profileId}/campaigns/{campaignId}` | Brand Campaign / Delete | Matrix | Documented sandbox support |
| 21 | Campaign | GET | `/v3/profiles/{profileId}/campaigns` | Brand Campaign / Get Many | Matrix | API returns a complete array; no invented pagination |
| 22 | Campaign | PUT | `/v3/profiles/{profileId}/campaigns/{campaignId}` | Brand Campaign / Update | Matrix | Campaign object as validated JSON |
| 23 | User | GET | `/v3/users/{userId}` | User / Get | Matrix | — |
| 24 | User | GET | `/v3/users` | User / Get Many | Matrix | API returns the complete `users` collection; no invented pagination |
| 25 | User | POST | `/v3/users` | User / Invite | Matrix | Name, email, role |
| 26 | User | DELETE | `/v3/users/{userId}` | User / Remove | Matrix | Documented sandbox support |
| 27 | User | PATCH | `/v3/users/{userId}` | User / Update Role | Matrix | Role |
| 28 | Webhook | POST | `/v3/webhooks` | Webhook / Create | Matrix + lifecycle | Also used by Sent Trigger activation |
| 29 | Webhook | DELETE | `/v3/webhooks/{webhookId}` | Webhook / Delete | Matrix + lifecycle | No sandbox or idempotency; documented exception, and the Options collection is hidden for it |
| 30 | Webhook | GET | `/v3/webhooks/{webhookId}` | Webhook / Get | Matrix + lifecycle | Trigger existence check |
| 31 | Webhook | GET | `/v3/webhooks/{webhookId}/events` | Webhook / Get Events | Matrix + pagination | Return All, Limit |
| 32 | Webhook | GET | `/v3/webhooks/event-types` | Webhook / Get Event Types | Matrix | Trigger dynamic options with fallback |
| 33 | Webhook | GET | `/v3/webhooks` | Webhook / Get Many | Matrix + pagination | Filters, Return All, Limit |
| 34 | Webhook | POST | `/v3/webhooks/{webhookId}/rotate-secret` | Webhook / Rotate Signing Secret | Matrix | New secret returned only by the action call |
| 35 | Webhook | POST | `/v3/webhooks/{webhookId}/test` | Webhook / Test | Matrix | Event type input |
| 36 | Webhook | PATCH | `/v3/webhooks/{webhookId}/toggle-status` | Webhook / Toggle Status | Matrix | Active boolean |
| 37 | Webhook | PUT | `/v3/webhooks/{webhookId}` | Webhook / Update | Matrix | Full configuration update |
| 38 | Number Lookup | GET | `/v3/numbers/lookup/{phoneNumber}` | Number Lookup / Lookup | Matrix | International number input |

## Deliberately excluded operations

These five documented stable endpoints are intentionally not exposed. `test/operations.test.ts` asserts that each removed resource/operation pair now raises `Unsupported Sent operation`.

| Sent resource | Method | Endpoint | Reason |
| --- | --- | --- | --- |
| Conversation | GET | `/v3/conversations` | Returns message records already reachable through Message operations; the extra resource added a second, near-duplicate list surface |
| Conversation | GET | `/v3/conversations/{id}` | Same as above |
| Contact | POST | `/v3/contacts` | Contact creation is a side effect of sending; exposing it invited duplicate-contact workflows |
| Contact | PATCH | `/v3/contacts/{contactId}` | Only `default_channel` and `opt_out` were settable, and both were buried in an options collection |
| Contact | GET | `/v3/contacts/{contactId}/message-summary` | Aggregate reporting endpoint with no workflow-automation use case found |

No deprecated, private, beta, or inferred routes are included. Live side-effect testing requires a user-authorized Sent API key; implementation and mocked verification are complete.
