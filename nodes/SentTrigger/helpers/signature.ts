import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import type { IDataObject } from 'n8n-workflow';

export const SENT_WEBHOOK_TOLERANCE_SECONDS = 300;

export interface SignatureInput {
	webhookId?: string;
	timestamp?: string;
	signature?: string;
	rawBody: Buffer;
	secret?: string;
	nowSeconds?: number;
}

export interface SignatureResult {
	valid: boolean;
	reason?: string;
}

export function computeSentSignature(
	webhookId: string,
	timestamp: string,
	rawBody: Buffer,
	secret: string,
): string {
	if (!secret.startsWith('whsec_')) throw new Error('Malformed webhook signing secret');
	const encodedKey = secret.slice('whsec_'.length);
	if (!encodedKey || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedKey)) {
		throw new Error('Malformed webhook signing secret');
	}
	const key = Buffer.from(encodedKey, 'base64');
	if (key.length === 0) throw new Error('Malformed webhook signing secret');
	const signedContent = Buffer.concat([Buffer.from(`${webhookId}.${timestamp}.`, 'utf8'), rawBody]);
	return `v1,${createHmac('sha256', key).update(signedContent).digest('base64')}`;
}

export function isValidSentSigningSecret(secret: unknown): secret is string {
	if (typeof secret !== 'string') return false;
	try {
		computeSentSignature('validation', '0', Buffer.alloc(0), secret);
		return true;
	} catch {
		return false;
	}
}

export function verifySentSignature(input: SignatureInput): SignatureResult {
	const { webhookId, timestamp, signature, rawBody, secret } = input;
	if (!webhookId || !timestamp || !signature)
		return { valid: false, reason: 'Missing signature header' };
	if (!secret) return { valid: false, reason: 'Missing signing secret' };
	if (!/^v1,[A-Za-z0-9+/]+={0,2}$/.test(signature)) {
		return { valid: false, reason: 'Malformed signature' };
	}

	const timestampSeconds = Number(timestamp);
	const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
	if (!Number.isInteger(timestampSeconds)) return { valid: false, reason: 'Malformed timestamp' };
	if (Math.abs(nowSeconds - timestampSeconds) > SENT_WEBHOOK_TOLERANCE_SECONDS) {
		return { valid: false, reason: 'Timestamp outside tolerance' };
	}

	try {
		const expected = Buffer.from(
			computeSentSignature(webhookId, timestamp, rawBody, secret),
			'utf8',
		);
		const received = Buffer.from(signature, 'utf8');
		if (expected.length !== received.length) {
			return { valid: false, reason: 'Malformed signature' };
		}

		if (!timingSafeEqual(expected, received)) {
			return { valid: false, reason: 'Signature mismatch' };
		}

		return { valid: true };
	} catch {
		return { valid: false, reason: 'Malformed signing secret' };
	}
}

export function deriveEventIdempotencyKey(event: IDataObject, rawBody: Buffer): string {
	const payload =
		typeof event.payload === 'object' && event.payload !== null
			? (event.payload as IDataObject)
			: {};
	const eventType = typeof event.event === 'string' ? event.event : String(event.field ?? 'event');
	const occurrence =
		(typeof payload.updated_at === 'string' && payload.updated_at.trim()) ||
		(typeof event.timestamp === 'string' && event.timestamp.trim()) ||
		createHash('sha256').update(rawBody).digest('hex');
	if (typeof payload.message_id === 'string') {
		const transition = String(payload.message_status ?? eventType);
		return `${payload.message_id}:${transition}:${occurrence}`;
	}
	if (typeof payload.template_id === 'string') {
		return `${payload.template_id}:${String(payload.status ?? eventType)}:${occurrence}`;
	}
	// Hash the body alone. Sent re-signs a retry with a fresh timestamp, because an
	// original one would fall outside the replay window, so folding the timestamp into
	// the key would change it on exactly the redeliveries this key exists to collapse.
	return createHash('sha256').update(rawBody).digest('hex');
}

export function isPublicWebhookUrl(value: string): boolean {
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:') return false;
		// WHATWG URL keeps an IPv6 literal bracketed, so a bare '::1' comparison never
		// matches url.hostname.
		const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
		if (host === 'localhost' || host === '::1' || host === '0.0.0.0' || host.endsWith('.local')) {
			return false;
		}
		if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false;
		const private172 = /^172\.(\d+)\./.exec(host);
		if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
		return true;
	} catch {
		return false;
	}
}
