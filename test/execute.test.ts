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
		getNode: () => ({ name: 'Sent', type: 'test.sent', typeVersion: 1, position: [0, 0], parameters: {} }),
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
			items: [{ resource: 'message', operation: 'get', messageId: 'm1' }],
			responses: [ok({ success: true, data: { id: 'm1', status: 'DELIVERED' }, meta: { request_id: 'r1' } })],
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
			items: [{ resource: 'message', operation: 'get', messageId: 'm1' }],
			responses: [{ statusCode: 204, headers: {}, body: undefined }],
		});

		expect(items[0].json).toEqual({ deleted: true, _meta: {} });
	});

	it('uses the same _meta key when the envelope carries no object data', async () => {
		// `data: null` is the only path through unwrapEnvelope's non-object branch — a 204
		// is normalized to `{deleted: true}`, which is an object and takes the other branch.
		const { items } = await execute({
			items: [{ resource: 'account', operation: 'get' }],
			responses: [ok({ success: true, data: null, meta: { request_id: 'r9' } })],
		});

		expect(items[0].json).toEqual({ success: true, _meta: { request_id: 'r9' } });
		expect(items[0].json).not.toHaveProperty('meta');
	});


	it('walks pages and truncates at the requested limit', async () => {
		const { items, context } = await execute({
			items: [{ resource: 'contact', operation: 'getMany', returnAll: false, limit: 3 }],
			responses: [
				ok({ success: true, data: { contacts: [{ id: '1' }, { id: '2' }], pagination: { has_more: true } } }),
				ok({ success: true, data: { contacts: [{ id: '3' }, { id: '4' }], pagination: { has_more: true } } }),
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
			responses: [ok({ success: true, data: { id: 'm1' } }), ok({ success: true, data: { id: 'm2' } })],
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
					{ statusCode: 404, headers: {}, body: { success: false, error: { code: 'NOT_FOUND', message: 'Message not found' } } },
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
				{ statusCode: 404, headers: {}, body: { success: false, error: { code: 'NOT_FOUND', message: 'Message not found' } } },
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
});

describe('Sent listSearch.getTemplates', () => {
	function loadOptionsContext(body: unknown) {
		const httpRequestWithAuthentication = vi.fn().mockResolvedValue({ statusCode: 200, headers: {}, body });
		return {
			getNode: () => ({ name: 'Sent', type: 'test.sent', typeVersion: 1, position: [0, 0], parameters: {} }),
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
			data: { templates: [{ id: 't1', name: 'Welcome' }, { name: 'Draft with no ID' }, { id: '', name: 'Empty' }] },
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
