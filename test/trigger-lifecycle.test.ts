import { describe, expect, it, vi } from 'vitest';

import { SentTrigger } from '../nodes/SentTrigger/SentTrigger.node';

interface FakeStaticData {
	webhookId?: string;
	signingSecret?: string;
}

function hookContext(
	data: FakeStaticData,
	responses: Array<{ statusCode: number; headers: Record<string, string>; body?: unknown }> = [],
	parameters: Record<string, unknown> = {},
) {
	const httpRequestWithAuthentication = vi.fn();
	for (const response of responses) httpRequestWithAuthentication.mockResolvedValueOnce(response);
	return {
		getNode: () => ({ name: 'Sent Trigger', type: 'test.sentTrigger', typeVersion: 1, position: [0, 0], parameters: {} }),
		getNodeParameter: (name: string, fallback?: unknown) => parameters[name] ?? fallback,
		getNodeWebhookUrl: () => 'https://n8n.example.com/webhook/sent',
		getWorkflowStaticData: () => data,
		helpers: { httpRequestWithAuthentication },
	};
}

describe('Sent Trigger webhook contract', () => {
	const description = new SentTrigger().description;

	it('declares a production webhook n8n will actually register', () => {
		const webhooks = description.webhooks ?? [];
		expect(webhooks).toHaveLength(1);
		// Load-bearing: `restartWebhook: true` marks a wait/resume webhook, and every
		// caller of getNodeWebhooks() passes ignoreRestartWebhooks=true, so the webhook
		// would never be collected, created at Sent, or routed to.
		expect(webhooks[0]).not.toHaveProperty('restartWebhook');
		expect(webhooks[0]).toMatchObject({
			name: 'default',
			httpMethod: 'POST',
			responseMode: 'onReceived',
			path: 'webhook',
		});
	});

	it('is not offered as an AI tool', () => {
		expect(description.usableAsTool).toBeUndefined();
	});
});

describe('Sent Trigger lifecycle', () => {
	const methods = new SentTrigger().webhookMethods.default;

	it('reports no existing webhook when static data is empty', async () => {
		const context = hookContext({});
		await expect(methods.checkExists.call(context as never)).resolves.toBe(false);
		expect(context.helpers.httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('confirms an existing webhook without creating a duplicate', async () => {
		const data = { webhookId: 'wh-1', signingSecret: 'whsec_dGVzdA==' };
		const context = hookContext(data, [
			{ statusCode: 200, headers: {}, body: { success: true, data: { id: 'wh-1' } } },
		]);
		await expect(methods.checkExists.call(context as never)).resolves.toBe(true);
		expect(context.helpers.httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
	});

	it('clears stale static data when Sent returns 404', async () => {
		const data = { webhookId: 'wh-missing', signingSecret: 'whsec_dGVzdA==' };
		const context = hookContext(data, [
			{ statusCode: 404, headers: {}, body: { success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } } },
		]);
		await expect(methods.checkExists.call(context as never)).resolves.toBe(false);
		expect(data).toEqual({});
	});

	it('creates a webhook and stores only lifecycle secrets in static data', async () => {
		const data: FakeStaticData = {};
		const context = hookContext(
			data,
			[
				{
					statusCode: 201,
					headers: {},
					body: {
						success: true,
						data: { id: 'wh-new', signing_secret: 'whsec_dGVzdA==' },
					},
				},
			],
			{ eventTypes: ['message'], messageSubtypes: ['delivered'], options: {} },
		);
		await expect(methods.create.call(context as never)).resolves.toBe(true);
		expect(data).toEqual({ webhookId: 'wh-new', signingSecret: 'whsec_dGVzdA==' });
		const request = context.helpers.httpRequestWithAuthentication.mock.calls[0][1];
		expect(request).toMatchObject({ method: 'POST', url: 'https://api.sent.dm/v3/webhooks' });
		expect(request.body).toMatchObject({
			endpoint_url: 'https://n8n.example.com/webhook/sent',
			event_types: ['message'],
			event_filters: { message: ['delivered'] },
		});
	});

	it('fails creation when Sent omits the signing secret', async () => {
		const context = hookContext(
			{},
			[{ statusCode: 201, headers: {}, body: { success: true, data: { id: 'wh-new' } } }],
			{ eventTypes: ['message'], messageSubtypes: [], options: {} },
		);
		await expect(methods.create.call(context as never)).rejects.toThrow(/signing secret/);
	});

	it('deletes the exact stored webhook and clears static data', async () => {
		const data = { webhookId: 'wh-delete', signingSecret: 'whsec_dGVzdA==' };
		const context = hookContext(data, [{ statusCode: 204, headers: {} }]);
		await expect(methods.delete.call(context as never)).resolves.toBe(true);
		expect(data).toEqual({});
		const request = context.helpers.httpRequestWithAuthentication.mock.calls[0][1];
		expect(request).toMatchObject({
			method: 'DELETE',
			url: 'https://api.sent.dm/v3/webhooks/wh-delete',
		});
	});

	it('treats an already-cleared webhook as successfully removed', async () => {
		const context = hookContext({});
		await expect(methods.delete.call(context as never)).resolves.toBe(true);
		expect(context.helpers.httpRequestWithAuthentication).not.toHaveBeenCalled();
	});
});
