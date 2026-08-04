import { describe, expect, it } from 'vitest';

import { SentTrigger } from '../nodes/SentTrigger/SentTrigger.node';
import { computeSentSignature } from '../nodes/SentTrigger/helpers/signature';

const secret = `whsec_${Buffer.from('output-test-secret').toString('base64')}`;

async function deliver(event: Record<string, unknown>) {
	const rawBody = Buffer.from(JSON.stringify(event));
	const webhookId = 'webhook-output-test';
	const timestamp = String(Math.floor(Date.now() / 1000));
	const signature = computeSentSignature(webhookId, timestamp, rawBody, secret);
	const request = {
		rawBody,
		headers: {
			'x-webhook-id': webhookId,
			'x-webhook-timestamp': timestamp,
			'x-webhook-signature': signature,
			'x-webhook-event-type': String(event.event),
		},
		readRawBody: async () => rawBody,
	};
	const context = {
		getNode: () => ({ name: 'Sent Trigger', type: 'test.sentTrigger', typeVersion: 1, position: [0, 0], parameters: {} }),
		getRequestObject: () => request,
		getResponseObject: () => ({ writeHead: () => undefined, end: () => undefined }),
		getWorkflowStaticData: () => ({ signingSecret: secret, webhookId }),
	};
	return new SentTrigger().webhook.call(context as never);
}

describe('Sent Trigger normalized output', () => {
	it.each([
		['message status', { field: 'message', event: 'message.delivered', timestamp: '2026-08-04T00:00:00Z', payload: { message_id: 'm1', message_status: 'DELIVERED' } }, 'delivered', 'm1:DELIVERED'],
		['inbound message', { field: 'message', event: 'message.received', timestamp: '2026-08-04T00:00:00Z', payload: { message_id: 'm2', text: 'Synthetic inbound text' } }, 'received', 'm2:message.received'],
		['template event', { field: 'templates', event: 'templates.approved', timestamp: '2026-08-04T00:00:00Z', payload: { template_id: 't1', status: 'APPROVED' } }, 'approved', 't1:APPROVED'],
	])('normalizes a verified %s event', async (_label, event, subtype, idempotencyKey) => {
		const result = await deliver(event);
		const json = result.workflowData?.[0]?.[0]?.json;
		expect(json).toMatchObject({
			field: event.field,
			event: event.event,
			subtype,
			payload: event.payload,
			idempotencyKey,
			headers: { 'x-webhook-event-type': event.event },
			rawEvent: event,
		});
		expect(JSON.stringify(json)).not.toContain(secret);
		expect(JSON.stringify(json)).not.toContain('x-webhook-signature');
	});
});
