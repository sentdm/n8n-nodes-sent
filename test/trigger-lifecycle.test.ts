import { describe, expect, it, vi } from 'vitest';
import { NodeOperationError } from 'n8n-workflow';

import { SentTrigger } from '../nodes/SentTrigger/SentTrigger.node';

interface FakeStaticData {
	webhookId?: string;
	signingSecret?: string;
	webhookCreationGeneration?: string;
	webhookCreationIdempotencyKey?: string;
	webhookCreationFingerprint?: string;
}

function remoteWebhook(overrides: Record<string, unknown> = {}) {
	return {
		id: 'wh-1',
		display_name: 'n8n Sent Trigger',
		endpoint_url: 'https://n8n.example.com/webhook/sent',
		is_active: true,
		event_types: ['message'],
		event_filters: {},
		retry_count: 3,
		timeout_seconds: 30,
		...overrides,
	};
}

function hookContext(
	data: FakeStaticData,
	responses: Array<{ statusCode: number; headers: Record<string, string>; body?: unknown }> = [],
	parameters: Record<string, unknown> = {},
) {
	const httpRequestWithAuthentication = vi.fn();
	for (const response of responses) httpRequestWithAuthentication.mockResolvedValueOnce(response);
	return {
		getNode: () => ({
			id: 'node-1',
			name: 'Sent Trigger',
			type: 'test.sentTrigger',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getNodeParameter: (name: string, fallback?: unknown) => parameters[name] ?? fallback,
		getNodeWebhookUrl: () => 'https://n8n.example.com/webhook/sent',
		getWorkflow: () => ({ id: 'workflow-1', name: 'Workflow', active: true }),
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
		const data: FakeStaticData = {
			webhookId: 'wh-1',
			signingSecret: 'whsec_dGVzdA==',
			webhookCreationGeneration: 'stale-generation',
			webhookCreationIdempotencyKey: 'legacy-key',
			webhookCreationFingerprint: 'legacy-fingerprint',
		};
		const context = hookContext(data, [
			{ statusCode: 200, headers: {}, body: { success: true, data: remoteWebhook() } },
		]);
		await expect(methods.checkExists.call(context as never)).resolves.toBe(true);
		expect(context.helpers.httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
		expect(data).toEqual({ webhookId: 'wh-1', signingSecret: 'whsec_dGVzdA==' });
	});

	it.each([
		['is missing', undefined],
		['is malformed', 'not-a-valid-signing-value'],
	])('deletes an existing webhook when its local signing secret %s', async (_label, value) => {
		const data: FakeStaticData = { webhookId: 'wh-1', signingSecret: value };
		const context = hookContext(data, [
			{ statusCode: 200, headers: {}, body: { success: true, data: remoteWebhook() } },
			{ statusCode: 204, headers: {} },
		]);

		await expect(methods.checkExists.call(context as never)).resolves.toBe(false);
		expect(data).toEqual({ webhookCreationGeneration: 'wh-1' });
		expect(context.helpers.httpRequestWithAuthentication.mock.calls[1][1]).toMatchObject({
			method: 'DELETE',
			url: 'https://api.sent.dm/v3/webhooks/wh-1',
		});
	});

	it('reactivates separate disable episodes without reusing a cached mutation key', async () => {
		const data = { webhookId: 'wh-1', signingSecret: 'whsec_dGVzdA==' };
		const context = hookContext(data, [
			{
				statusCode: 200,
				headers: {},
				body: { success: true, data: remoteWebhook({ is_active: false }) },
			},
			{ statusCode: 200, headers: {}, body: { success: true, data: remoteWebhook() } },
			{
				statusCode: 200,
				headers: {},
				body: { success: true, data: remoteWebhook({ is_active: false }) },
			},
			{ statusCode: 200, headers: {}, body: { success: true, data: remoteWebhook() } },
		]);

		await expect(methods.checkExists.call(context as never)).resolves.toBe(true);
		await expect(methods.checkExists.call(context as never)).resolves.toBe(true);
		const firstActivation = context.helpers.httpRequestWithAuthentication.mock.calls[1][1];
		const secondActivation = context.helpers.httpRequestWithAuthentication.mock.calls[3][1];
		expect(firstActivation).toMatchObject({
			method: 'PATCH',
			url: 'https://api.sent.dm/v3/webhooks/wh-1/toggle-status',
			body: { is_active: true },
		});
		expect(secondActivation).toMatchObject({
			method: 'PATCH',
			url: 'https://api.sent.dm/v3/webhooks/wh-1/toggle-status',
			body: { is_active: true },
		});
		expect(firstActivation.headers).not.toHaveProperty('Idempotency-Key');
		expect(secondActivation.headers).not.toHaveProperty('Idempotency-Key');
	});

	it('repairs endpoint and delivery configuration drift', async () => {
		const data = { webhookId: 'wh-1', signingSecret: 'whsec_dGVzdA==' };
		const context = hookContext(
			data,
			[
				{
					statusCode: 200,
					headers: {},
					body: {
						success: true,
						data: remoteWebhook({
							endpoint_url: 'https://old.example.com/hook',
							event_filters: { message: ['failed'] },
							retry_count: 1,
						}),
					},
				},
				{ statusCode: 200, headers: {}, body: { success: true, data: remoteWebhook() } },
			],
			{
				eventTypes: ['message'],
				messageSubtypes: ['delivered'],
				options: { retryCount: 4, timeoutSeconds: 45 },
			},
		);

		await expect(methods.checkExists.call(context as never)).resolves.toBe(true);
		expect(context.helpers.httpRequestWithAuthentication.mock.calls[1][1]).toMatchObject({
			method: 'PUT',
			url: 'https://api.sent.dm/v3/webhooks/wh-1',
			body: {
				display_name: 'n8n Sent Trigger',
				endpoint_url: 'https://n8n.example.com/webhook/sent',
				event_types: ['message'],
				event_filters: { message: ['delivered'] },
				retry_count: 4,
				timeout_seconds: 45,
			},
		});
	});

	it('retains a new creation generation when Sent returns 404', async () => {
		const data = { webhookId: 'wh-missing', signingSecret: 'whsec_dGVzdA==' };
		const context = hookContext(data, [
			{
				statusCode: 404,
				headers: {},
				body: { success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
			},
		]);
		await expect(methods.checkExists.call(context as never)).resolves.toBe(false);
		expect(data).toEqual({ webhookCreationGeneration: 'wh-missing' });
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
		expect(request.headers['Idempotency-Key']).toMatch(/^n8n_webhook_create_/);
		expect(request.body).toMatchObject({
			endpoint_url: 'https://n8n.example.com/webhook/sent',
			event_types: ['message'],
			event_filters: { message: ['delivered'] },
		});
	});

	it('reuses a deterministic creation key when failed activation static data was not saved', async () => {
		const parameters = { eventTypes: ['message'], messageSubtypes: [], options: {} };
		const failedData: FakeStaticData = {};
		const failedContext = hookContext(
			failedData,
			[
				{
					statusCode: 500,
					headers: {},
					body: { success: false, error: { code: 'INTERNAL_001', message: 'Try again' } },
				},
			],
			parameters,
		);

		await expect(methods.create.call(failedContext as never)).rejects.toThrow(/Try again/);
		const failedKey =
			failedContext.helpers.httpRequestWithAuthentication.mock.calls[0][1].headers[
				'Idempotency-Key'
			];
		expect(failedKey).toMatch(/^n8n_webhook_create_/);
		expect(failedData).toEqual({});

		// A failed activation is rebuilt from database state, so this deliberately uses a
		// fresh object rather than reusing the mutation from the failed in-memory attempt.
		const recoveredData: FakeStaticData = {};
		const recoveredContext = hookContext(
			recoveredData,
			[
				{
					statusCode: 201,
					headers: {},
					body: {
						success: true,
						data: { id: 'wh-recovered', signing_secret: 'whsec_dGVzdA==' },
					},
				},
			],
			parameters,
		);
		await expect(methods.create.call(recoveredContext as never)).resolves.toBe(true);
		const recoveredKey =
			recoveredContext.helpers.httpRequestWithAuthentication.mock.calls[0][1].headers[
				'Idempotency-Key'
			];
		expect(recoveredKey).toBe(failedKey);
		expect(recoveredData).toEqual({
			webhookId: 'wh-recovered',
			signingSecret: 'whsec_dGVzdA==',
		});
	});

	it('changes the deterministic creation key when the desired configuration changes', async () => {
		const data: FakeStaticData = {};
		const parameters: Record<string, unknown> = {
			eventTypes: ['message'],
			messageSubtypes: [],
			options: {},
		};
		const context = hookContext(
			data,
			[
				{
					statusCode: 500,
					headers: {},
					body: { success: false, error: { code: 'INTERNAL_001', message: 'Try again' } },
				},
				{
					statusCode: 500,
					headers: {},
					body: { success: false, error: { code: 'INTERNAL_001', message: 'Try again' } },
				},
			],
			parameters,
		);

		await expect(methods.create.call(context as never)).rejects.toThrow();
		const firstKey =
			context.helpers.httpRequestWithAuthentication.mock.calls[0][1].headers['Idempotency-Key'];
		parameters.messageSubtypes = ['delivered'];
		await expect(methods.create.call(context as never)).rejects.toThrow();
		const secondKey =
			context.helpers.httpRequestWithAuthentication.mock.calls[1][1].headers['Idempotency-Key'];
		expect(secondKey).not.toBe(firstKey);
	});

	it.each([
		['Retry Count', { retryCount: 0 }],
		['Retry Count', { retryCount: 2.5 }],
		['Timeout Seconds', { timeoutSeconds: 121 }],
		['Timeout Seconds', { timeoutSeconds: 'not-a-number' }],
	])('validates expression-derived %s values at runtime', async (displayName, options) => {
		const context = hookContext({}, [], {
			eventTypes: ['message'],
			messageSubtypes: [],
			options,
		});

		await expect(methods.create.call(context as never)).rejects.toThrow(`'${displayName}'`);
		expect(context.helpers.httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('fails creation when Sent omits the signing secret', async () => {
		const data: FakeStaticData = {};
		const context = hookContext(
			data,
			[
				{ statusCode: 201, headers: {}, body: { success: true, data: { id: 'wh-new' } } },
				{ statusCode: 204, headers: {} },
			],
			{ eventTypes: ['message'], messageSubtypes: [], options: {} },
		);
		await expect(methods.create.call(context as never)).rejects.toThrow(/signing secret/);
		expect(context.helpers.httpRequestWithAuthentication.mock.calls[1][1]).toMatchObject({
			method: 'DELETE',
			url: 'https://api.sent.dm/v3/webhooks/wh-new',
		});
		expect(data).toEqual({ webhookCreationGeneration: 'wh-new' });
	});

	it('rotates the creation key after deleting and recreating a webhook', async () => {
		const data: FakeStaticData = {};
		const firstCreate = hookContext(
			data,
			[
				{
					statusCode: 201,
					headers: {},
					body: { success: true, data: { id: 'wh-delete', signing_secret: 'whsec_dGVzdA==' } },
				},
			],
			{ eventTypes: ['message'], messageSubtypes: [], options: {} },
		);
		await expect(methods.create.call(firstCreate as never)).resolves.toBe(true);
		const firstKey =
			firstCreate.helpers.httpRequestWithAuthentication.mock.calls[0][1].headers['Idempotency-Key'];

		const deletion = hookContext(data, [{ statusCode: 204, headers: {} }]);
		await expect(methods.delete.call(deletion as never)).resolves.toBe(true);
		expect(data).toEqual({ webhookCreationGeneration: 'wh-delete' });
		expect(deletion.helpers.httpRequestWithAuthentication.mock.calls[0][1]).toMatchObject({
			method: 'DELETE',
			url: 'https://api.sent.dm/v3/webhooks/wh-delete',
		});

		const secondCreate = hookContext(
			data,
			[
				{
					statusCode: 201,
					headers: {},
					body: { success: true, data: { id: 'wh-next', signing_secret: 'whsec_dGVzdA==' } },
				},
			],
			{ eventTypes: ['message'], messageSubtypes: [], options: {} },
		);
		await expect(methods.create.call(secondCreate as never)).resolves.toBe(true);
		const secondKey =
			secondCreate.helpers.httpRequestWithAuthentication.mock.calls[0][1].headers[
				'Idempotency-Key'
			];
		expect(secondKey).not.toBe(firstKey);
		expect(data).toEqual({ webhookId: 'wh-next', signingSecret: 'whsec_dGVzdA==' });
	});

	it('treats an already-cleared webhook as removed while retaining its next generation', async () => {
		const pendingAttemptKey = ['n8n_webhook_create', 'pending'].join('_');
		const data: FakeStaticData = {
			webhookCreationGeneration: 'wh-prior',
			webhookCreationIdempotencyKey: pendingAttemptKey,
			webhookCreationFingerprint: 'fingerprint',
		};
		const context = hookContext(data);
		await expect(methods.delete.call(context as never)).resolves.toBe(true);
		expect(data).toEqual({ webhookCreationGeneration: 'wh-prior' });
		expect(context.helpers.httpRequestWithAuthentication).not.toHaveBeenCalled();
	});
});

describe('Sent Trigger dynamic event loading', () => {
	const loadSubtypes = new SentTrigger().methods.loadOptions.getMessageSubtypes;

	it.each([401, 403])('surfaces a credential response with status %s', async (statusCode) => {
		const context = hookContext({}, [
			{
				statusCode,
				headers: {},
				body: { success: false, error: { code: 'AUTH', message: 'Credential rejected' } },
			},
		]);

		await expect(loadSubtypes.call(context as never)).rejects.toThrow(/Credential rejected/);
	});

	it('surfaces a locally missing credential instead of returning fallback options', async () => {
		const context = hookContext({});
		context.helpers.httpRequestWithAuthentication.mockRejectedValueOnce(
			new NodeOperationError(context.getNode() as never, 'Sent credential is not configured'),
		);

		await expect(loadSubtypes.call(context as never)).rejects.toThrow(/not configured/);
	});

	it('uses the documented fallback during a transient API response', async () => {
		const context = hookContext({}, [
			{
				statusCode: 503,
				headers: {},
				body: { success: false, error: { code: 'UNAVAILABLE', message: 'Unavailable' } },
			},
		]);

		await expect(loadSubtypes.call(context as never)).resolves.toEqual([
			{ name: 'Delivered', value: 'delivered' },
			{ name: 'Failed', value: 'failed' },
			{ name: 'Queued', value: 'queued' },
			{ name: 'Read', value: 'read' },
			{ name: 'Received', value: 'received' },
			{ name: 'Routed', value: 'routed' },
			{ name: 'Sent', value: 'sent' },
		]);
	});

	it('surfaces a non-transient client response instead of hiding it behind the fallback', async () => {
		const context = hookContext({}, [
			{
				statusCode: 400,
				headers: {},
				body: { success: false, error: { code: 'VALIDATION', message: 'Request rejected' } },
			},
		]);

		await expect(loadSubtypes.call(context as never)).rejects.toThrow(/Request rejected/);
	});
});
