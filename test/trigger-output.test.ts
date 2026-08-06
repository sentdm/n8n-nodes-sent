import { describe, expect, it, vi } from 'vitest';

import { SentTrigger } from '../nodes/SentTrigger/SentTrigger.node';
import { computeSentSignature } from '../nodes/SentTrigger/helpers/signature';

const secret = `whsec_${Buffer.from('output-test-secret').toString('base64')}`;

interface DeliveryOverrides {
	rawBody?: Buffer;
	headers?: Record<string, string | undefined>;
	storedSecret?: string;
}

function delivery(event: unknown, overrides: DeliveryOverrides = {}) {
	const signedBody = Buffer.from(JSON.stringify(event));
	const webhookId = 'webhook-output-test';
	const timestamp = String(Math.floor(Date.now() / 1000));
	const signature = computeSentSignature(webhookId, timestamp, signedBody, secret);
	const rawBody = overrides.rawBody ?? signedBody;
	const bodyEventType =
		typeof event === 'object' && event !== null && !Array.isArray(event)
			? ((event as Record<string, unknown>).sub_type ??
				(event as Record<string, unknown>).event)
			: undefined;
	const writeHead = vi.fn();
	const end = vi.fn();
	const request = {
		rawBody,
		headers: {
			'x-webhook-id': webhookId,
			'x-webhook-timestamp': timestamp,
			'x-webhook-signature': signature,
			'x-webhook-event-type':
				typeof bodyEventType === 'string' ? bodyEventType : undefined,
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

async function deliver(event: unknown, overrides: DeliveryOverrides = {}) {
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
				sub_type: 'message.delivered',
				timestamp: '2026-08-04T00:00:00Z',
				payload: { message_id: 'm1', message_status: 'DELIVERED' },
			},
			'delivered',
			'm1:DELIVERED:2026-08-04T00:00:00Z',
		],
		[
			'inbound message',
			{
				field: 'message',
				sub_type: 'message.received',
				timestamp: '2026-08-04T00:00:00Z',
				payload: { message_id: 'm2', text: 'Synthetic inbound text' },
			},
			'received',
			'm2:message.received:2026-08-04T00:00:00Z',
		],
		[
				'queued message',
				{
					field: 'message',
					sub_type: 'message.queued',
					timestamp: '2026-08-04T00:00:00Z',
					payload: { message_id: 'm3', message_status: 'QUEUED' },
				},
				'queued',
				'm3:QUEUED:2026-08-04T00:00:00Z',
			],
		])('normalizes a verified %s event', async (_label, event, subtype, idempotencyKey) => {
		const { result } = await deliver(event);
		const json = result.workflowData?.[0]?.[0]?.json;
			expect(json).toMatchObject({
				field: event.field,
				event: event.sub_type,
				subtype,
				payload: event.payload,
				idempotencyKey,
				headers: { 'x-webhook-event-type': event.sub_type },
				rawEvent: event,
			});
		expect(JSON.stringify(json)).not.toContain(secret);
		expect(JSON.stringify(json)).not.toContain('x-webhook-signature');
	});

	it('trusts the signed subtype without a header and rejects a mismatched header', async () => {
		const event = {
			field: 'message',
			sub_type: 'message.delivered',
			timestamp: '2026-08-04T00:00:00Z',
			payload: { message_id: 'm1', message_status: 'DELIVERED' },
		};
		const { result } = await deliver(event, {
			headers: { 'x-webhook-event-type': undefined },
		});

		expect(result.workflowData?.[0]?.[0]?.json).toMatchObject({
			field: 'message',
			event: 'message.delivered',
			subtype: 'delivered',
			payload: event.payload,
			idempotencyKey: 'm1:DELIVERED:2026-08-04T00:00:00Z',
		});

		const mismatch = await deliver(event, {
			headers: { 'x-webhook-event-type': 'message.failed' },
		});
		expect(mismatch.result).toEqual({ noWebhookResponse: true });
		expect(mismatch.result.workflowData).toBeUndefined();
		expect(mismatch.writeHead).toHaveBeenCalledWith(400, {
			'Content-Type': 'application/json',
		});
	});
});

describe('Sent Trigger signature rejection', () => {
	const event = {
		field: 'message',
		sub_type: 'message.delivered',
		timestamp: '2026-08-04T00:00:00Z',
		payload: { message_id: 'm1' },
	};

	it.each([
		[
			'a tampered body',
			{
				rawBody: Buffer.from(
					'{"field":"message","sub_type":"message.delivered","payload":{"message_id":"forged"}}',
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
		const { context, writeHead, end } = delivery({}, { rawBody: notJson });
		// Re-sign the non-JSON body so verification succeeds and parsing is what fails.
		const headers = context.getRequestObject().headers;
		headers['x-webhook-signature'] = computeSentSignature(
			headers['x-webhook-id'] as string,
			headers['x-webhook-timestamp'] as string,
			notJson,
			secret,
		);

		await expect(new SentTrigger().webhook.call(context as never)).resolves.toEqual({
			noWebhookResponse: true,
		});
		expect(writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
		expect(String(end.mock.calls[0][0])).toContain('not valid JSON');
	});

	it.each([
		['null', null],
		['an array', []],
		['a missing field', { timestamp: '2026-08-04T00:00:00Z', payload: {} }],
		['a missing timestamp', { field: 'message', sub_type: 'message.sent', payload: {} }],
		[
			'an invalid timestamp',
			{ field: 'message', sub_type: 'message.sent', timestamp: 'not-a-date', payload: {} },
		],
		[
			'a missing payload',
			{ field: 'message', sub_type: 'message.sent', timestamp: '2026-08-04T00:00:00Z' },
		],
		[
			'an array payload',
				{
					field: 'message',
					sub_type: 'message.sent',
					timestamp: '2026-08-04T00:00:00Z',
				payload: [],
			},
		],
		[
			'a message without a message event',
			{ field: 'message', timestamp: '2026-08-04T00:00:00Z', payload: {} },
		],
	])('answers 400 and starts no execution for a signed envelope containing %s', async (_label, event) => {
		const { result, writeHead, end } = await deliver(event, {
			headers: {
				'x-webhook-event-type':
					_label === 'a message without a message event' ? undefined : 'message.sent',
			},
		});

		expect(result).toEqual({ noWebhookResponse: true });
		expect(result.workflowData).toBeUndefined();
		expect(writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
		expect(end).toHaveBeenCalledTimes(1);
	});
});
