import { NodeApiError } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { Sent } from '../nodes/Sent/Sent.node';

interface ExecuteOptions {
	items: Array<Record<string, unknown>>;
	responses: unknown[];
	continueOnFail?: boolean;
}

function executeContext(options: ExecuteOptions) {
	const httpRequestWithAuthentication = vi.fn();
	for (const response of options.responses) {
		if (response instanceof Error) httpRequestWithAuthentication.mockRejectedValueOnce(response);
		else httpRequestWithAuthentication.mockResolvedValueOnce(response);
	}
	return {
		getInputData: () => options.items.map((_item, index) => ({ json: { index } })),
		getNode: () => ({
			name: 'Sent',
			type: 'test.sent',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getNodeParameter: (name: string, itemIndex: number, fallback?: unknown) =>
			options.items[itemIndex]?.[name] ?? fallback,
		continueOnFail: () => options.continueOnFail ?? false,
		helpers: { httpRequestWithAuthentication },
	};
}

async function execute(options: ExecuteOptions) {
	const context = executeContext(options);
	const output = await new Sent().execute.call(context as never);
	return { branches: output, items: output[0], context };
}

const ok = (body: unknown) => ({ statusCode: 200, headers: {}, body });

describe('Sent.execute', () => {
	it('returns one paired item for a single-record operation', async () => {
		const { branches, items } = await execute({
			items: [{ resource: 'message', operation: 'get', messageId: 'm1', output: 'raw' }],
			responses: [
				ok({ success: true, data: { id: 'm1', status: 'DELIVERED' }, meta: { request_id: 'r1' } }),
			],
		});

		expect(branches).toHaveLength(1);
		expect(items).toEqual([
			{
				json: { id: 'm1', status: 'DELIVERED', _meta: { request_id: 'r1' } },
				pairedItem: { item: 0 },
			},
		]);
	});

	it('normalizes a 204 into a deleted marker', async () => {
		const { items } = await execute({
			items: [{ resource: 'message', operation: 'get', messageId: 'm1', output: 'raw' }],
			responses: [{ statusCode: 204, headers: {}, body: undefined }],
		});

		expect(items[0].json).toEqual({ deleted: true, _meta: {} });
	});

	it('uses the same _meta key when the envelope carries no object data', async () => {
		// `data: null` is the only path through unwrapEnvelope's non-object branch — a 204
		// is normalized to `{deleted: true}`, which is an object and takes the other branch.
		const { items } = await execute({
			items: [{ resource: 'account', operation: 'get', output: 'raw' }],
			responses: [ok({ success: true, data: null, meta: { request_id: 'r9' } })],
		});

		expect(items[0].json).toEqual({ success: true, _meta: { request_id: 'r9' } });
		expect(items[0].json).not.toHaveProperty('meta');
	});

	it('walks pages and truncates at the requested limit', async () => {
		const { items, context } = await execute({
			items: [{ resource: 'contact', operation: 'getMany', returnAll: false, limit: 3 }],
			responses: [
				ok({
					success: true,
					data: { contacts: [{ id: '1' }, { id: '2' }], pagination: { has_more: true } },
				}),
				ok({
					success: true,
					data: { contacts: [{ id: '3' }, { id: '4' }], pagination: { has_more: true } },
				}),
			],
		});

		expect(items.map((item) => item.json)).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
		expect(context.helpers.httpRequestWithAuthentication).toHaveBeenCalledTimes(2);
	});

	it('pairs output from several input items back to their source index', async () => {
		const { items } = await execute({
			items: [
				{ resource: 'message', operation: 'get', messageId: 'm1' },
				{ resource: 'message', operation: 'get', messageId: 'm2' },
			],
			responses: [
				ok({ success: true, data: { id: 'm1' } }),
				ok({ success: true, data: { id: 'm2' } }),
			],
		});

		expect(items.map((item) => [item.json.id, item.pairedItem])).toEqual([
			['m1', { item: 0 }],
			['m2', { item: 1 }],
		]);
	});

	it('throws on a failed item when Continue On Fail is off', async () => {
		await expect(
			execute({
				items: [{ resource: 'message', operation: 'get', messageId: 'm1' }],
				responses: [
					{
						statusCode: 404,
						headers: {},
						body: { success: false, error: { code: 'NOT_FOUND', message: 'Message not found' } },
					},
				],
			}),
		).rejects.toThrow(/Message not found/);
	});

	it('routes a failed item to output and keeps processing when Continue On Fail is on', async () => {
		const { items } = await execute({
			continueOnFail: true,
			items: [
				{ resource: 'message', operation: 'get', messageId: 'm1' },
				{ resource: 'message', operation: 'get', messageId: 'm2' },
			],
			responses: [
				{
					statusCode: 404,
					headers: {},
					body: { success: false, error: { code: 'NOT_FOUND', message: 'Message not found' } },
				},
				ok({ success: true, data: { id: 'm2' } }),
			],
		});

		expect(items).toHaveLength(2);
		expect(String(items[0].json.error)).toMatch(/Message not found/);
		expect(items[0].pairedItem).toEqual({ item: 0 });
		expect(items[1].json).toMatchObject({ id: 'm2' });
	});

	it('fails a build-time validation before issuing any request', async () => {
		const { context } = await execute({
			continueOnFail: true,
			items: [{ resource: 'contact', operation: 'get', contactId: '' }],
			responses: [],
		});

		expect(context.helpers.httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('defaults large entity responses to at most 10 useful fields', async () => {
		const fullMessage = {
			id: 'm1',
			customer_id: 'customer-1',
			contact_id: 'contact-1',
			phone: '+14155550123',
			phone_international: '+1 415-555-0123',
			region_code: 'US',
			template_id: 'template-1',
			template_name: 'Welcome',
			template_category: 'UTILITY',
			channel: 'sms',
			message_body: { content: 'Hello' },
			status: 'DELIVERED',
			direction: 'OUTBOUND',
			created_at: '2026-08-04T00:00:00Z',
			price: 0.01,
			active_contact_price: 0.02,
			events: [],
		};
		const { items } = await execute({
			items: [{ resource: 'message', operation: 'get', messageId: 'm1' }],
			responses: [ok({ success: true, data: fullMessage, meta: { request_id: 'r1' } })],
		});

		expect(Object.keys(items[0].json)).toEqual([
			'id',
			'contact_id',
			'phone',
			'channel',
			'status',
			'direction',
			'template_name',
			'message_body',
			'created_at',
			'events',
		]);
		expect(items[0].json).not.toHaveProperty('_meta');
		expect(items[0].pairedItem).toEqual({ item: 0 });
	});

	it('returns every response field in Raw output mode', async () => {
		const { items } = await execute({
			items: [{ resource: 'contact', operation: 'get', contactId: 'c1', output: 'raw' }],
			responses: [
				ok({
					success: true,
					data: { id: 'c1', phone_number: '+14155550123', updated_at: null },
					meta: { request_id: 'r1' },
				}),
			],
		});

		expect(items[0].json).toEqual({
			id: 'c1',
			phone_number: '+14155550123',
			updated_at: null,
			_meta: { request_id: 'r1' },
		});
	});

	it("always includes the entity ID in 'Selected Fields' output", async () => {
		const { items } = await execute({
			items: [
				{
					resource: 'message',
					operation: 'get',
					messageId: 'm1',
					output: 'fields',
					fields: ['status', 'price'],
				},
			],
			responses: [
				ok({
					success: true,
					data: { id: 'm1', status: 'DELIVERED', price: 0.01, phone: '+14155550123' },
				}),
			],
		});

		expect(items[0].json).toEqual({ id: 'm1', status: 'DELIVERED', price: 0.01 });
	});

	it("validates 'Selected Fields' expressions before issuing a request", async () => {
		const context = executeContext({
			items: [
				{
					resource: 'message',
					operation: 'get',
					messageId: 'm1',
					output: 'fields',
					fields: ['not_a_message_field'],
				},
			],
			responses: [],
		});

		await expect(new Sent().execute.call(context as never)).rejects.toThrow(
			/'Fields' contains the unsupported value/,
		);
		expect(context.helpers.httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.POSITIVE_INFINITY, 'many'])(
		"rejects an unsafe 'Limit' expression value %s before issuing a request",
		async (limit) => {
			const context = executeContext({
				items: [{ resource: 'contact', operation: 'getMany', returnAll: false, limit }],
				responses: [],
			});

			await expect(new Sent().execute.call(context as never)).rejects.toThrow(
				/'Limit' must be a whole number/,
			);
			expect(context.helpers.httpRequestWithAuthentication).not.toHaveBeenCalled();
		},
	);

	it('rethrows a Sent API response with its typed HTTP metadata intact', async () => {
		const context = executeContext({
			items: [{ resource: 'message', operation: 'get', messageId: 'm1' }],
			responses: [
				{
					statusCode: 429,
					headers: { 'retry-after': '60', 'x-request-id': 'req-429' },
					body: {
						success: false,
						error: {
							code: 'BUSINESS_002',
							message: 'Rate limit exceeded',
							doc_url: 'https://docs.sent.dm/reference/api/rate-limits',
						},
					},
				},
			],
		});

		let captured: unknown;
		try {
			await new Sent().execute.call(context as never);
		} catch (error) {
			captured = error;
		}

		expect(captured).toBeInstanceOf(NodeApiError);
		expect((captured as NodeApiError).httpCode).toBe('429');
		expect((captured as NodeApiError).description).toMatch(/Request ID: req-429/);
		expect((captured as NodeApiError).description).toMatch(/Retry-After: 60/);
	});

	it('preserves the exact typed n8n response raised by the request helper', async () => {
		const original = new NodeApiError(
			{
				name: 'Sent',
				type: 'test.sent',
				typeVersion: 1,
				position: [0, 0],
				parameters: {},
			},
			{ message: 'Rate limit exceeded', name: 'BUSINESS_002', httpCode: '429' },
			{ httpCode: '429', message: 'BUSINESS_002: Rate limit exceeded' },
		);
		const context = executeContext({
			items: [{ resource: 'message', operation: 'get', messageId: 'm1' }],
			responses: [original],
		});

		let captured: unknown;
		try {
			await new Sent().execute.call(context as never);
		} catch (error) {
			captured = error;
		}

		expect(captured).toBe(original);
		expect((captured as NodeApiError).httpCode).toBe('429');
	});

	it('keeps safe 429 metadata in Continue On Fail output', async () => {
		const { items } = await execute({
			continueOnFail: true,
			items: [{ resource: 'message', operation: 'get', messageId: 'm1' }],
			responses: [
				{
					statusCode: 429,
					headers: { 'retry-after': '60', 'x-request-id': 'req-429' },
					body: {
						success: false,
						error: {
							code: 'BUSINESS_002',
							message: 'Rate limit exceeded',
							doc_url: 'https://docs.sent.dm/reference/api/rate-limits',
						},
					},
				},
			],
		});

		expect(items[0].json).toMatchObject({
			error: 'BUSINESS_002: Rate limit exceeded',
			errorCode: 'BUSINESS_002',
			httpCode: '429',
			requestId: 'req-429',
			retryAfter: '60',
			documentationUrl: 'https://docs.sent.dm/reference/api/rate-limits',
		});
		expect(items[0].json.description).toMatch(/HTTP 429/);
		expect(items[0].json.description).toMatch(/Request ID: req-429/);
		expect(items[0].json.description).toMatch(/Retry-After: 60/);
		expect(items[0].json.description).toMatch(
			/Documentation: https:\/\/docs\.sent\.dm\/reference\/api\/rate-limits/,
		);
	});
});

describe('Sent listSearch.getTemplates', () => {
	function loadOptionsContext(body: unknown) {
		const httpRequestWithAuthentication = vi
			.fn()
			.mockResolvedValue({ statusCode: 200, headers: {}, body });
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

	const search = async (context: unknown, filter?: string) =>
		await new Sent().methods.listSearch.getTemplates.call(context as never, filter);

	it('passes the search box text through to the API as `search`', async () => {
		const context = loadOptionsContext({ success: true, data: { templates: [] } });

		await search(context, 'welcome');

		expect(context.helpers.httpRequestWithAuthentication.mock.calls[0][1].qs).toEqual({
			page: 1,
			page_size: 100,
			search: 'welcome',
		});
	});

	it('omits `search` entirely when the box is empty', async () => {
		const context = loadOptionsContext({ success: true, data: { templates: [] } });

		await search(context, undefined);

		expect(context.helpers.httpRequestWithAuthentication.mock.calls[0][1].qs).toEqual({
			page: 1,
			page_size: 100,
		});
	});

	it('drops templates with no ID rather than offering an unselectable entry', async () => {
		const context = loadOptionsContext({
			success: true,
			data: {
				templates: [
					{ id: 't1', name: 'Welcome' },
					{ name: 'Draft with no ID' },
					{ id: '', name: 'Empty' },
				],
			},
		});

		await expect(search(context)).resolves.toEqual({
			results: [{ name: 'Welcome', value: 't1' }],
		});
	});

	it('falls back to the ID as the label when a template has no name', async () => {
		const context = loadOptionsContext({ success: true, data: { templates: [{ id: 't2' }] } });

		await expect(search(context)).resolves.toEqual({ results: [{ name: 't2', value: 't2' }] });
	});

	it('returns no results when the payload has no template array', async () => {
		const context = loadOptionsContext({ success: true, data: {} });

		await expect(search(context)).resolves.toEqual({ results: [] });
	});
});

describe('Sent listSearch.getContacts', () => {
	function loadOptionsContext(body: unknown) {
		const httpRequestWithAuthentication = vi
			.fn()
			.mockResolvedValue({ statusCode: 200, headers: {}, body });
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

	it('searches contacts and drops entries that cannot be selected', async () => {
		const context = loadOptionsContext({
			success: true,
			data: {
				contacts: [
					{ id: 'c1', phone_number: '+14155550123' },
					{ phone_number: '+14155550124' },
					{ id: 'c2' },
				],
			},
		});

		await expect(
			new Sent().methods.listSearch.getContacts.call(context as never, '+1415'),
		).resolves.toEqual({
			results: [
				{ name: '+14155550123', value: 'c1', description: 'c1' },
				{ name: 'c2', value: 'c2', description: 'c2' },
			],
		});
		expect(context.helpers.httpRequestWithAuthentication.mock.calls[0][1].qs).toEqual({
			page: 1,
			page_size: 100,
			search: '+1415',
		});
	});
});
