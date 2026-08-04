import { describe, expect, it, vi } from 'vitest';

import { sentApiRequest, sentApiRequestAllItems } from '../nodes/Sent/transport';

function contextWithResponses(...responses: unknown[]) {
	const httpRequestWithAuthentication = vi.fn();
	for (const response of responses) httpRequestWithAuthentication.mockResolvedValueOnce(response);
	return {
		getNode: () => ({ name: 'Sent', type: 'test.sent', typeVersion: 1, position: [0, 0], parameters: {} }),
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

	it('passes idempotency and profile headers without generating values', async () => {
		const context = contextWithResponses({
			statusCode: 200,
			headers: {},
			body: { success: true, data: {} },
		});
		await sentApiRequest.call(context as never, {
			method: 'POST',
			path: '/v3/messages',
			idempotencyKey: 'workflow-item-1',
			profileId: 'profile-1',
		});
		const options = context.helpers.httpRequestWithAuthentication.mock.calls[0][1];
		expect(options.headers).toMatchObject({
			'Idempotency-Key': 'workflow-item-1',
			'x-profile-id': 'profile-1',
		});
	});

	it('preserves safe Sent error context and request ID', async () => {
		const context = contextWithResponses({
			statusCode: 422,
			headers: { 'x-request-id': 'req-422' },
			body: {
				success: false,
				error: { code: 'VALIDATION_001', message: 'Invalid phone number', details: { to: ['invalid'] } },
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
		await expect(
			sentApiRequest.call(context as never, { method: 'GET', path: '/v3/me' }),
		).rejects.toThrow(/Rate limit exceeded/);
		expect(context.helpers.httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
	});

	it.each([
		['network failure', new Error('socket closed with api-key=real-looking-secret'), /Sent API request failed/],
		['timeout', new Error('ETIMEDOUT after 30000ms'), /timed out/],
	])('normalizes %s without leaking low-level sensitive text', async (_name, failure, message) => {
		const context = contextWithResponses();
		context.helpers.httpRequestWithAuthentication.mockRejectedValueOnce(failure);
		let captured: unknown;
		try {
			await sentApiRequest.call(context as never, { method: 'GET', path: '/v3/me' });
		} catch (error) {
			captured = error;
		}
		expect(String(captured)).toMatch(message);
		expect(JSON.stringify(captured)).not.toContain('real-looking-secret');
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
		let serialized = '';
		try {
			await sentApiRequest.call(context as never, { method: 'GET', path: '/v3/me' });
		} catch (error) {
			serialized = JSON.stringify(error);
		}
		expect(serialized).toContain('req-auth');
		expect(serialized).not.toContain('secret-value');
		expect(serialized).not.toContain('+15555550123');
	});

	it('paginates until has_more is false', async () => {
		const context = contextWithResponses(
			{ statusCode: 200, headers: {}, body: { success: true, data: { contacts: [{ id: '1' }], pagination: { has_more: true } } } },
			{ statusCode: 200, headers: {}, body: { success: true, data: { contacts: [{ id: '2' }], pagination: { has_more: false } } } },
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

	it('honors a limit smaller than a page', async () => {
		const context = contextWithResponses({
			statusCode: 200,
			headers: {},
			body: { success: true, data: { contacts: [{ id: '1' }, { id: '2' }], pagination: { has_more: true } } },
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
			{ statusCode: 200, headers: {}, body: { success: true, data: { contacts: [{ id: '1' }, { id: '2' }], pagination: { has_more: true } } } },
			{ statusCode: 200, headers: {}, body: { success: true, data: { contacts: [{ id: '3' }], pagination: { has_more: false } } } },
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
