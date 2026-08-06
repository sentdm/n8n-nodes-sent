import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { SentTrigger } from '../nodes/SentTrigger/SentTrigger.node';
import {
	computeSentSignature,
	deriveEventIdempotencyKey,
	isPublicWebhookUrl,
	verifySentSignature,
} from '../nodes/SentTrigger/helpers/signature';

const secret = `whsec_${Buffer.from('test-webhook-secret').toString('base64')}`;
const webhookId = '7ba7b820-9dad-11d1-80b4-00c04fd430c8';
const timestamp = '1761905442';
const rawBody = Buffer.from(
	'{"field":"message","sub_type":"message.delivered","payload":{"message_id":"m1","message_status":"DELIVERED"}}',
);

describe('Sent webhook signature verification', () => {
	it('accepts a valid deterministic signature', () => {
		const signature = computeSentSignature(webhookId, timestamp, rawBody, secret);
		expect(
			verifySentSignature({
				webhookId,
				timestamp,
				signature,
				rawBody,
				secret,
				nowSeconds: Number(timestamp),
			}),
		).toEqual({ valid: true });
	});

	it.each([
		['invalid signature', { signature: 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' }],
		['missing signature', { signature: undefined }],
		['wrong webhook ID', { webhookId: 'another-webhook' }],
		['modified raw body', { rawBody: Buffer.from('{"changed":true}') }],
	])('rejects %s', (_name, override) => {
		const signature = computeSentSignature(webhookId, timestamp, rawBody, secret);
		expect(
			verifySentSignature({
				webhookId,
				timestamp,
				signature,
				rawBody,
				secret,
				nowSeconds: Number(timestamp),
				...override,
			}).valid,
		).toBe(false);
	});

	it('rejects a malformed secret', () => {
		expect(
			verifySentSignature({
				webhookId,
				timestamp,
				signature: 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
				rawBody,
				secret: 'not-a-whsec',
				nowSeconds: Number(timestamp),
			}).valid,
		).toBe(false);
	});

	it.each([301, -301])('rejects timestamps outside the replay window (%s seconds)', (offset) => {
		const signature = computeSentSignature(webhookId, timestamp, rawBody, secret);
		expect(
			verifySentSignature({
				webhookId,
				timestamp,
				signature,
				rawBody,
				secret,
				nowSeconds: Number(timestamp) + offset,
			}).valid,
		).toBe(false);
	});

	it('derives a transition-specific message idempotency key', () => {
		expect(
			deriveEventIdempotencyKey(
				{
					sub_type: 'message.delivered',
					timestamp: '2026-08-04T00:00:00Z',
					payload: { message_id: 'm1', message_status: 'DELIVERED' },
				},
				rawBody,
			),
		).toBe('m1:DELIVERED:2026-08-04T00:00:00Z');
	});

	it('collapses exact redeliveries but distinguishes a later repeated transition', () => {
		const firstBody = Buffer.from(
			'{"field":"message","sub_type":"message.routed","timestamp":"2026-08-04T00:00:00Z","payload":{"message_id":"m1","message_status":"ROUTED","updated_at":"2026-08-04T00:00:00Z","channel":"sms"}}',
		);
		const laterBody = Buffer.from(
			'{"field":"message","sub_type":"message.routed","timestamp":"2026-08-04T00:01:00Z","payload":{"message_id":"m1","message_status":"ROUTED","updated_at":"2026-08-04T00:01:00Z","channel":"whatsapp"}}',
		);
		const first = JSON.parse(firstBody.toString('utf8'));
		const redelivery = JSON.parse(firstBody.toString('utf8'));
		const later = JSON.parse(laterBody.toString('utf8'));

		expect(deriveEventIdempotencyKey(first, firstBody)).toBe(
			deriveEventIdempotencyKey(redelivery, firstBody),
		);
		expect(deriveEventIdempotencyKey(later, laterBody)).not.toBe(
			deriveEventIdempotencyKey(first, firstBody),
		);
	});

	it('derives a body-stable hash fallback when the event has no resource ID', () => {
		const key = deriveEventIdempotencyKey({ field: 'unknown' }, rawBody);

		// Pinned to the digest of the body ALONE. A looser assertion cannot tell
		// `sha256(body)` apart from `sha256(body + timestamp)`, and the whole point of
		// this key is that a Sent redelivery — which is re-signed with a fresh timestamp,
		// because the original would fall outside the replay window — produces the same
		// value and is therefore deduplicated.
		expect(key).toBe(createHash('sha256').update(rawBody).digest('hex'));
		expect(deriveEventIdempotencyKey({ field: 'unknown' }, Buffer.from('{"other":true}'))).not.toBe(
			key,
		);
	});

	it('emits that same body-stable key through the trigger on redelivery', async () => {
		const body = Buffer.from(
			'{"field":"message","sub_type":"message.sent","timestamp":"2026-08-04T00:00:00Z","payload":{"synthetic":"value"}}',
		);
		const webhookId = 'wh-redelivery';
		const secretForRun = secret;

		const deliverAt = async (seconds: string) => {
			const signature = computeSentSignature(webhookId, seconds, body, secretForRun);
			const context = {
				getNode: () => ({
					name: 'Sent Trigger',
					type: 't',
					typeVersion: 1,
					position: [0, 0],
					parameters: {},
				}),
				getRequestObject: () => ({
					rawBody: body,
					headers: {
						'x-webhook-id': webhookId,
						'x-webhook-timestamp': seconds,
						'x-webhook-signature': signature,
						'x-webhook-event-type': 'message.sent',
					},
					readRawBody: async () => body,
				}),
				getResponseObject: () => ({ writeHead: () => undefined, end: () => undefined }),
				getWorkflowStaticData: () => ({ signingSecret: secretForRun, webhookId }),
			};
			const result = await new SentTrigger().webhook.call(context as never);
			return result.workflowData?.[0]?.[0]?.json.idempotencyKey;
		};

		const now = Math.floor(Date.now() / 1000);
		// The same event delivered twice, minutes apart, with different valid timestamps.
		const first = await deliverAt(String(now - 120));
		expect(first).toBe(createHash('sha256').update(body).digest('hex'));
		expect(first).toBe(await deliverAt(String(now)));
	});
});

describe('webhook URL validation', () => {
	it.each([
		'http://example.com/webhook',
		'https://localhost/webhook',
		'https://127.0.0.1/hook',
		'https://10.0.0.1/hook',
		'https://192.168.1.2/hook',
		'https://172.16.0.1/hook',
		'https://[::1]/hook',
		'https://0.0.0.0/hook',
		'https://n8n.local/hook',
		'not-a-url',
	])('rejects non-public URL %s', (value) => expect(isPublicWebhookUrl(value)).toBe(false));

	it.each([
		'https://n8n.example.com/webhook/sent',
		// 172.x outside 16-31 is public, and a host merely starting with those digits
		// must not be mistaken for one.
		'https://172.15.0.1/hook',
		'https://172.32.0.1/hook',
		'https://fdic.gov/hook',
	])('accepts public URL %s', (value) => expect(isPublicWebhookUrl(value)).toBe(true));
});
