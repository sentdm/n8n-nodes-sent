import { describe, expect, it } from 'vitest';

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
	'{"field":"message","event":"message.delivered","payload":{"message_id":"m1","message_status":"DELIVERED"}}',
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
				{ event: 'message.delivered', payload: { message_id: 'm1', message_status: 'DELIVERED' } },
				rawBody,
			),
		).toBe('m1:DELIVERED');
	});

	it('derives a stable hash fallback when the event has no resource ID', () => {
		expect(deriveEventIdempotencyKey({ field: 'unknown' }, rawBody, '1712345678')).toMatch(
			/^[a-f0-9]{64}$/,
		);
		expect(deriveEventIdempotencyKey({ field: 'unknown' }, rawBody, '1712345678')).not.toBe(
			deriveEventIdempotencyKey({ field: 'unknown' }, rawBody, '1712345679'),
		);
	});
});

describe('webhook URL validation', () => {
	it.each(['http://example.com/webhook', 'https://localhost/webhook', 'https://127.0.0.1/hook', 'https://10.0.0.1/hook', 'https://192.168.1.2/hook', 'not-a-url'])(
		'rejects non-public URL %s',
		(value) => expect(isPublicWebhookUrl(value)).toBe(false),
	);

	it('accepts a public HTTPS URL', () => {
		expect(isPublicWebhookUrl('https://n8n.example.com/webhook/sent')).toBe(true);
	});
});
