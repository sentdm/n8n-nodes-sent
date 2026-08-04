# Sent API v3 coverage

Live Sent documentation was reviewed on 2026-08-04. All **43** distinct stable public v3 method/path operations found are mapped; no undocumented endpoint is implemented. “Shared” test coverage means the common credential, transport, envelope/error, pagination, sandbox, and idempotency paths are tested, while a live endpoint call remains a manual pre-release check.

| # | Sent resource | Method | Endpoint | n8n resource / operation | Implemented | Test status | Notes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Account | GET | `/v3/me` | Account / Get | Yes | Credential + shared | Credential test target |
| 2 | Message | POST | `/v3/messages` | Message / Send | Yes | Direct + shared | Text/template; Sent/SMS/WhatsApp/RCS; sandbox; idempotency |
| 3 | Message | GET | `/v3/messages/{messageId}` | Message / Get | Yes | Shared | Exact ID |
| 4 | Message | GET | `/v3/messages/{messageId}/activities` | Message / Get Activities | Yes | Shared | Exact ID |
| 5 | Conversation | GET | `/v3/conversations` | Conversation / Get Many | Yes | Pagination shared | Returns message records |
| 6 | Conversation | GET | `/v3/conversations/{id}` | Conversation / Get Messages | Yes | Pagination shared | Conversation identifier |
| 7 | Contact | POST | `/v3/contacts` | Contact / Create | Yes | Shared | Sandbox/idempotency supported |
| 8 | Contact | DELETE | `/v3/contacts/{contactId}` | Contact / Delete | Yes | Shared | Documented sandbox support |
| 9 | Contact | GET | `/v3/contacts/{contactId}` | Contact / Get | Yes | Shared | — |
| 10 | Contact | GET | `/v3/contacts/{contactId}/message-summary` | Contact / Get Message Summary | Yes | Shared | — |
| 11 | Contact | GET | `/v3/contacts` | Contact / Get Many | Yes | Pagination direct/shared | Filters, Return All, Limit |
| 12 | Contact | PATCH | `/v3/contacts/{contactId}` | Contact / Update | Yes | Shared | Default channel/opt-out options |
| 13 | Template | POST | `/v3/templates` | Template / Create | Yes | Shared | Definition object |
| 14 | Template | DELETE | `/v3/templates/{templateId}` | Template / Delete | Yes | Shared | Documented sandbox support |
| 15 | Template | GET | `/v3/templates/{templateId}` | Template / Get | Yes | Shared | — |
| 16 | Template | GET | `/v3/templates` | Template / Get Many | Yes | Pagination shared | Filters, Return All, Limit |
| 17 | Template | PUT | `/v3/templates/{templateId}` | Template / Update | Yes | Shared | Definition object |
| 18 | Profile | POST | `/v3/profiles` | Profile / Create | Yes | Shared | Advanced documented fields as JSON |
| 19 | Profile | DELETE | `/v3/profiles/{profileId}` | Profile / Delete | Yes | Shared | Documented sandbox support |
| 20 | Profile | GET | `/v3/profiles/{profileId}` | Profile / Get | Yes | Shared | — |
| 21 | Profile | GET | `/v3/profiles` | Profile / Get Many | Yes | Shared | API returns complete `profiles` collection; no invented pagination |
| 22 | Profile | PATCH | `/v3/profiles/{profileId}` | Profile / Update | Yes | Shared | Advanced documented fields as JSON |
| 23 | Profile | POST | `/v3/profiles/{profileId}/complete` | Profile / Complete Setup | Yes | Shared | Webhook URL input |
| 24 | Campaign | POST | `/v3/profiles/{profileId}/campaigns` | Campaign / Create | Yes | Shared | Campaign object as validated JSON |
| 25 | Campaign | DELETE | `/v3/profiles/{profileId}/campaigns/{campaignId}` | Campaign / Delete | Yes | Shared | Documented sandbox support |
| 26 | Campaign | GET | `/v3/profiles/{profileId}/campaigns` | Campaign / Get Many | Yes | Shared | API returns a complete array; no invented pagination |
| 27 | Campaign | PUT | `/v3/profiles/{profileId}/campaigns/{campaignId}` | Campaign / Update | Yes | Shared | Campaign object as validated JSON |
| 28 | User | GET | `/v3/users/{userId}` | User / Get | Yes | Shared | — |
| 29 | User | GET | `/v3/users` | User / Get Many | Yes | Shared | API returns complete `users` collection; no invented pagination |
| 30 | User | POST | `/v3/users` | User / Invite | Yes | Shared | Name, email, role |
| 31 | User | DELETE | `/v3/users/{userId}` | User / Remove | Yes | Shared | Documented sandbox support |
| 32 | User | PATCH | `/v3/users/{userId}` | User / Update Role | Yes | Shared | Role |
| 33 | Webhook | POST | `/v3/webhooks` | Webhook / Create | Yes | Lifecycle + shared | Also used by Sent Trigger activation |
| 34 | Webhook | DELETE | `/v3/webhooks/{webhookId}` | Webhook / Delete | Yes | Lifecycle + shared | No sandbox or idempotency; documented exception |
| 35 | Webhook | GET | `/v3/webhooks/{webhookId}` | Webhook / Get | Yes | Lifecycle + shared | Trigger existence check |
| 36 | Webhook | GET | `/v3/webhooks/{webhookId}/events` | Webhook / Get Events | Yes | Pagination shared | Return All, Limit |
| 37 | Webhook | GET | `/v3/webhooks/event-types` | Webhook / Get Event Types | Yes | Shared | Trigger dynamic options with fallback |
| 38 | Webhook | GET | `/v3/webhooks` | Webhook / Get Many | Yes | Pagination shared | Filters, Return All, Limit |
| 39 | Webhook | POST | `/v3/webhooks/{webhookId}/rotate-secret` | Webhook / Rotate Signing Secret | Yes | Shared | New secret returned only by action call |
| 40 | Webhook | POST | `/v3/webhooks/{webhookId}/test` | Webhook / Test | Yes | Shared | Event type input |
| 41 | Webhook | PATCH | `/v3/webhooks/{webhookId}/toggle-status` | Webhook / Toggle Status | Yes | Shared | Active boolean |
| 42 | Webhook | PUT | `/v3/webhooks/{webhookId}` | Webhook / Update | Yes | Shared | Full configuration update |
| 43 | Number Lookup | GET | `/v3/numbers/lookup/{phoneNumber}` | Number Lookup / Lookup | Yes | Shared | International number input |

## Excluded or blocked operations

None among the stable public v3 endpoints found. No deprecated, private, beta, or inferred routes are included. Live side-effect testing is blocked only by the absence of a user-authorized Sent API key; implementation and mocked verification are complete.
