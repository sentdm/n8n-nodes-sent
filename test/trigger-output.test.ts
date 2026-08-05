import { describe, expect, it, vi } from 'vitest';

import { SentTrigger } from '../nodes/SentTrigger/SentTrigger.node';
import { computeSentSignature } from '../nodes/SentTrigger/helpers/signature';

const secret = `whsec_${Buffer.from('output-test-secret').toString('base64')}`;

interface DeliveryOverrides {
	rawBody?: Buffer;
	headers?: Record<string, string | undefined>;
	storedSecret?: string;
}

function delivery(event: Record<string, unknown>, overrides: DeliveryOverrides = {}) {
	const signedBody = Buffer.from(JSON.stringify(event));
	const webhookId = 'webhook-output-test';
	const timestamp = String(Math.floor(Date.now() / 1000));
	const signature = computeSentSignature(webhookId, timestamp, signedBody, secret);
	const rawBody = overrides.rawBody ?? signedBody;
	const writeHead = vi.fn();
	const end = vi.fn();
	const request = {
		rawBody,
		headers: {
			'x-webhook-id': webhookId,
			'x-webhook-timestamp': timestamp,
			'x-webhook-signature': signature,
			'x-webhook-event-type': String(event.event),
			...overrides.headers,
		},
		readRawBody: async () => rawBody,
	};
	const context = {
		getNode: () => ({
			name: 'Sent Trigger',
			type: 'test.sentTrigger',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getRequestObject: () => request,
		getResponseObject: () => ({ writeHead, end }),
		getWorkflowStaticData: () => ({
			signingSecret: 'storedSecret' in overrides ? overrides.storedSecret : secret,
			webhookId,
		}),
	};
	return { context, writeHead, end };
}

async function deliver(event: Record<string, unknown>, overrides: DeliveryOverrides = {}) {
	const { context, writeHead, end } = delivery(event, overrides);
	const result = await new SentTrigger().webhook.call(context as never);
	return { result, writeHead, end };
}

describe('Sent Trigger normalized output', () => {
	it.each([
		[
			'message status',
			{
				field: 'message',
				event: 'message.delivered',
				timestamp: '2026-08-04T00:00:00Z',
				payload: { message_id: 'm1', message_status: 'DELIVERED' },
			},
			'delivered',
			'm1:DELIVERED',
		],
		[
			'inbound message',
			{
				field: 'message',
				event: 'message.received',
				timestamp: '2026-08-04T00:00:00Z',
				payload: { message_id: 'm2', text: 'Synthetic inbound text' },
			},
			'received',
			'm2:message.received',
		],
		[
			'template event',
			{
				field: 'templates',
				event: 'templates.approved',
				timestamp: '2026-08-04T00:00:00Z',
				payload: { template_id: 't1', status: 'APPROVED' },
			},
			'approved',
			't1:APPROVED',
		],
	])('normalizes a verified %s event', async (_label, event, subtype, idempotencyKey) => {
		const { result } = await deliver(event);
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

describe('Sent Trigger signature rejection', () => {
	const event = { field: 'message', event: 'message.delivered', payload: { message_id: 'm1' } };

	it.each([
		[
			'a tampered body',
			{
				rawBody: Buffer.from(
					'{"field":"message","event":"message.delivered","payload":{"message_id":"forged"}}',
				),
			},
		],
		[
			'a forged signature',
			{ headers: { 'x-webhook-signature': 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' } },
		],
		['a missing signature header', { headers: { 'x-webhook-signature': undefined } }],
		['a mismatched webhook ID', { headers: { 'x-webhook-id': 'someone-elses-webhook' } }],
		['a stale timestamp', { headers: { 'x-webhook-timestamp': '1000000000' } }],
		['no stored signing secret', { storedSecret: undefined }],
	])('answers 401 and starts no execution for %s', async (_label, overrides) => {
		const { result, writeHead, end } = await deliver(event, overrides);

		// No workflowData means n8n creates no execution row for the rejected delivery.
		expect(result).toEqual({ noWebhookResponse: true });
		expect(result.workflowData).toBeUndefined();
		expect(writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
		expect(end).toHaveBeenCalledTimes(1);
		expect(String(end.mock.calls[0][0])).not.toContain(secret);
	});

	it('rejects a body that passes signing but is not JSON', async () => {
		const notJson = Buffer.from('this is not json');
		const { context } = delivery({}, { rawBody: notJson });
		// Re-sign the non-JSON body so verification succeeds and parsing is what fails.
		const headers = context.getRequestObject().headers;
		headers['x-webhook-signature'] = computeSentSignature(
			headers['x-webhook-id'] as string,
			headers['x-webhook-timestamp'] as string,
			notJson,
			secret,
		);

		await expect(new SentTrigger().webhook.call(context as never)).rejects.toThrow(
			/not valid JSON/,
		);
	});
});
