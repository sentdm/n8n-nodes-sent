# Example workflows

Import any file below with **Workflows → ⋯ → Import from File**, then pick your **Sent API**
credential on each Sent node. Every example is checked by `test/examples.test.ts`, which fails if a
workflow references a resource, operation or parameter the node does not declare.

They contain placeholders only. Phone numbers use ranges reserved for fiction (NANP `555-01xx` and
Ofcom's `020 7946 0xxx`), and every send sets **Sandbox** so importing and running one cannot deliver
a real message or spend credit. Replace `YOUR_TEMPLATE_NAME` and `YOUR_MESSAGE_ID` with your own
values, and turn Sandbox off when you are ready to send for real.

| # | Workflow | Sent operations shown | What it demonstrates |
| --- | --- | --- | --- |
| 01 | [Send a Text Message](01-send-text-message.json) | `Message → Send` | The smallest useful send: free-form text, sandbox, and a per-item idempotency key |
| 02 | [Send a Template Message](02-send-template-message.json) | `Message → Send` | Sending an approved template with variables to several recipients |
| 03 | [Validate a Number Before Sending](03-validate-number-before-sending.json) | `Number Lookup → Lookup`, `Message → Send` | Branching on a lookup result so unreachable numbers are skipped instead of billed |
| 04 | [Track Delivery Status](04-track-delivery-status.json) | `Message → Get`, `Message → Get Activities` | Reading a message and then its per-channel delivery timeline |
| 05 | [Message Contacts in Batches](05-message-contacts-in-batches.json) | `Contact → Get Contacts`, `Message → Send` | Paginated contact retrieval fed through **Loop Over Items** so large lists send in controlled batches |
| 06 | [Inbound Message Trigger](06-inbound-message-trigger.json) | `Sent Trigger` | Starting a workflow from a signature-verified inbound message |
| 07 | [Durable Webhook Deduplication](07-durable-webhook-deduplication.json) | `Sent Trigger` | Using the trigger's redelivery-stable `idempotencyKey` with a Postgres `ON CONFLICT` claim so a Sent retry runs the workflow body once |

## Operations without a dedicated example

`Account → Get` and `Contact → Get Contact` are single-call operations that take no configuration
beyond an ID, so a workflow file for them would add nothing over the node's own panel. `Account →
Get` is also what the credential's **Test** button calls, which makes it the quickest way to confirm
an API key works.

## A note on idempotency keys

Examples 01, 02 and 05 set an **Idempotency Key**. Sent uses it to collapse duplicate sends, so
reusing the same key on a retry will not send twice. The expressions build a key from
`$execution.id` plus the item, which is stable within one execution and unique across executions —
exactly the property you want when n8n retries a failed item.

Example 07 uses a different key: the one the **trigger** emits. That is derived from the event, not
the execution, so it stays the same when Sent redelivers the same webhook.
