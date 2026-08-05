import { NodeOperationError } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { sentApiRequest, sentApiRequestAllItems } from '../nodes/Sent/transport';

// `JSON.stringify(error)` alone cannot see a leak: Error#message and Error#stack are
// non-enumerable, so the field most likely to carry raw upstream text is invisible to it.
function errorSurface(error: unknown): string {
	if (!(error instanceof Error)) return String(error);
	const fields = error as unknown as Record<string, unknown>;
	return [
		error.message,
		error.stack ?? '',
		String(fields.description ?? ''),
		JSON.stringify(fields.cause ?? null),
		JSON.stringify(fields.context ?? null),
		JSON.stringify(error),
	].join('\n');
}

async function captureError(run: Promise<unknown>): Promise<unknown> {
	try {
		await run;
	} catch (error) {
		return error;
	}
	throw new Error('expected the request to reject');
}

function contextWithResponses(...responses: unknown[]) {
	const httpRequestWithAuthentication = vi.fn();
	for (const response of responses) httpRequestWithAuthentication.mockResolvedValueOnce(response);
	return {
		getNode: () => ({
			name: 'Sent',
			type: 'test.sent',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		helpers: { httpRequestWithAuthentication },
	};
}

describe('Sent transport', () => {
	it('returns a success envelope', async () => {
		const context = contextWithResponses({
			statusCode: 200,
			headers: { 'x-request-id': 'req-1' },
			body: { success: true, data: { id: 'one' }, meta: { request_id: 'req-1' } },
		});
		await expect(
			sentApiRequest.call(context as never, { method: 'GET', path: '/v3/me' }),
		).resolves.toMatchObject({ success: true, data: { id: 'one' } });
	});

	it('normalizes a 204 response', async () => {
		const context = contextWithResponses({ statusCode: 204, headers: {}, body: undefined });
		await expect(
			sentApiRequest.call(context as never, { method: 'DELETE', path: '/v3/contacts/c1' }),
		).resolves.toEqual({ success: true, data: { deleted: true } });
	});

	it('passes the idempotency header without generating a value', async () => {
		const context = contextWithResponses({
			statusCode: 200,
			headers: {},
			body: { success: true, data: {} },
		});
		await sentApiRequest.call(context as never, {
			method: 'POST',
			path: '/v3/messages',
			idempotencyKey: 'workflow-item-1',
		});
		const options = context.helpers.httpRequestWithAuthentication.mock.calls[0][1];
		expect(options.headers).toEqual({
			Accept: 'application/json',
			'Idempotency-Key': 'workflow-item-1',
		});
	});

	it('omits the idempotency header when no key is supplied', async () => {
		const context = contextWithResponses({
			statusCode: 200,
			headers: {},
			body: { success: true, data: {} },
		});
		await sentApiRequest.call(context as never, { method: 'GET', path: '/v3/me' });
		const options = context.helpers.httpRequestWithAuthentication.mock.calls[0][1];
		expect(options.headers).toEqual({ Accept: 'application/json' });
		expect(options).toMatchObject({
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
			json: true,
		});
	});

	it('preserves safe Sent error context and request ID', async () => {
		const context = contextWithResponses({
			statusCode: 422,
			headers: { 'x-request-id': 'req-422' },
			body: {
				success: false,
				error: {
					code: 'VALIDATION_001',
					message: 'Invalid phone number',
					details: { to: ['invalid'] },
				},
				meta: { request_id: 'req-422' },
			},
		});
		await expect(
			sentApiRequest.call(context as never, { method: 'POST', path: '/v3/messages' }),
		).rejects.toThrow(/Invalid phone number/);
	});

	it('preserves Retry-After for a 429 without retrying automatically', async () => {
		const context = contextWithResponses({
			statusCode: 429,
			headers: { 'retry-after': '60' },
			body: { success: false, error: { code: 'BUSINESS_002', message: 'Rate limit exceeded' } },
		});
		const surface = errorSurface(
			await captureError(sentApiRequest.call(context as never, { method: 'GET', path: '/v3/me' })),
		);

		expect(surface).toMatch(/Rate limit exceeded/);
		// The whole point of the test: the caller must be able to see how long to wait.
		expect(surface).toContain('Retry-After: 60');
		expect(context.helpers.httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
	});

	it.each([
		[
			'network failure',
			new Error('socket closed with api-key=real-looking-secret'),
			/Sent API request failed/,
		],
		['timeout', new Error('ETIMEDOUT after 30000ms'), /timed out/],
	])('normalizes %s without leaking low-level sensitive text', async (_name, failure, message) => {
		const context = contextWithResponses();
		context.helpers.httpRequestWithAuthentication.mockRejectedValueOnce(failure);

		const captured = await captureError(
			sentApiRequest.call(context as never, { method: 'GET', path: '/v3/me' }),
		);

		expect(String(captured)).toMatch(message);
		expect(errorSurface(captured)).not.toContain('real-looking-secret');
	});

	it('rethrows an n8n error instead of relabelling it a network failure', async () => {
		const context = contextWithResponses();
		const credentialError = new NodeOperationError(
			{
				name: 'Sent',
				type: 'test.sent',
				typeVersion: 1,
				position: [0, 0],
				parameters: {},
			} as never,
			"Credentials for 'sentApi' could not be found",
		);
		context.helpers.httpRequestWithAuthentication.mockRejectedValueOnce(credentialError);

		const captured = await captureError(
			sentApiRequest.call(context as never, { method: 'GET', path: '/v3/me' }),
		);

		expect(captured).toBe(credentialError);
		expect(errorSurface(captured)).not.toContain('Network request failed');
	});

	it('redacts sensitive validation details while preserving the request ID', async () => {
		const context = contextWithResponses({
			statusCode: 401,
			headers: { 'x-request-id': 'req-auth' },
			body: {
				success: false,
				error: {
					code: 'AUTH_001',
					message: 'Invalid API key',
					details: { api_key: 'secret-value', phone_number: '+15555550123', field: 'api_key' },
				},
			},
		});

		const surface = errorSurface(
			await captureError(sentApiRequest.call(context as never, { method: 'GET', path: '/v3/me' })),
		);

		// Positive assertions first: without them the redaction checks could pass on an
		// empty string.
		expect(surface).toContain('req-auth');
		expect(surface).toContain('Invalid API key');
		expect(surface).toContain('[REDACTED]');
		expect(surface).not.toContain('secret-value');
		expect(surface).not.toContain('+15555550123');
	});

	it('paginates until has_more is false', async () => {
		const context = contextWithResponses(
			{
				statusCode: 200,
				headers: {},
				body: { success: true, data: { contacts: [{ id: '1' }], pagination: { has_more: true } } },
			},
			{
				statusCode: 200,
				headers: {},
				body: { success: true, data: { contacts: [{ id: '2' }], pagination: { has_more: false } } },
			},
		);
		await expect(
			sentApiRequestAllItems.call(
				context as never,
				{ method: 'GET', path: '/v3/contacts' },
				'contacts',
				true,
				100,
			),
		).resolves.toEqual([{ id: '1' }, { id: '2' }]);
	});

	it('keeps page_size constant across pages so a multi-page limit returns distinct rows', async () => {
		const page = (start: number) =>
			Array.from({ length: 100 }, (_, offset) => ({ id: String(start + offset) }));
		const context = contextWithResponses(
			{
				statusCode: 200,
				headers: {},
				body: { success: true, data: { contacts: page(1), pagination: { has_more: true } } },
			},
			{
				statusCode: 200,
				headers: {},
				body: { success: true, data: { contacts: page(101), pagination: { has_more: true } } },
			},
		);

		const records = await sentApiRequestAllItems.call(
			context as never,
			{ method: 'GET', path: '/v3/contacts' },
			'contacts',
			false,
			150,
		);

		expect(records).toHaveLength(150);
		expect(new Set(records.map((record) => record.id)).size).toBe(150);
		expect(records[149]).toEqual({ id: '150' });

		const queries = context.helpers.httpRequestWithAuthentication.mock.calls.map(
			(call: unknown[]) => (call[1] as { qs: unknown }).qs,
		);
		expect(queries).toEqual([
			{ page: 1, page_size: 100 },
			{ page: 2, page_size: 100 },
		]);
	});

	it('honors a limit smaller than a page', async () => {
		const context = contextWithResponses({
			statusCode: 200,
			headers: {},
			body: {
				success: true,
				data: { contacts: [{ id: '1' }, { id: '2' }], pagination: { has_more: true } },
			},
		});
		await expect(
			sentApiRequestAllItems.call(
				context as never,
				{ method: 'GET', path: '/v3/contacts' },
				'contacts',
				false,
				1,
			),
		).resolves.toEqual([{ id: '1' }]);
	});

	it('returns a final partial page and stops', async () => {
		const context = contextWithResponses(
			{
				statusCode: 200,
				headers: {},
				body: {
					success: true,
					data: { contacts: [{ id: '1' }, { id: '2' }], pagination: { has_more: true } },
				},
			},
			{
				statusCode: 200,
				headers: {},
				body: { success: true, data: { contacts: [{ id: '3' }], pagination: { has_more: false } } },
			},
		);
		await expect(
			sentApiRequestAllItems.call(
				context as never,
				{ method: 'GET', path: '/v3/contacts' },
				'contacts',
				true,
				100,
			),
		).resolves.toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
		expect(context.helpers.httpRequestWithAuthentication).toHaveBeenCalledTimes(2);
	});

	it('stops on empty data even when pagination metadata is malformed', async () => {
		const context = contextWithResponses({
			statusCode: 200,
			headers: {},
			body: { success: true, data: { contacts: [], pagination: { has_more: true } } },
		});
		await expect(
			sentApiRequestAllItems.call(
				context as never,
				{ method: 'GET', path: '/v3/contacts' },
				'contacts',
				true,
				100,
			),
		).resolves.toEqual([]);
	});
});
