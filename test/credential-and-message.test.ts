import { describe, expect, it } from 'vitest';

import { SentApi } from '../credentials/SentApi.credentials';
import { buildOperation } from '../nodes/Sent/helpers/operations';

function executeContext(parameters: Record<string, unknown>) {
	return {
		getNode: () => ({
			name: 'Sent',
			type: 'test.sent',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getNodeParameter: (name: string, _index: number, fallback?: unknown) =>
			parameters[name] ?? fallback,
	};
}

describe('Sent API credential', () => {
	it('injects the API key in x-api-key', () => {
		const credential = new SentApi();
		expect(credential.authenticate.properties.headers).toEqual({
			'x-api-key': '={{$credentials.apiKey}}',
		});
	});

	it('tests credentials against GET /v3/me', () => {
		const credential = new SentApi();
		expect(credential.test.request).toMatchObject({
			baseURL: 'https://api.sent.dm',
			url: '/v3/me',
			method: 'GET',
		});
	});

	it('marks the API key as a password and required', () => {
		const credential = new SentApi();
		expect(credential.properties[0]).toMatchObject({
			name: 'apiKey',
			required: true,
			typeOptions: { password: true },
		});
		expect(credential.properties[1]).toMatchObject({
			name: 'profileId',
			default: '',
		});
		expect(credential.properties[1]).not.toHaveProperty('required');
	});
});

describe('Send Message request construction', () => {
	it('defaults to Sent automatic routing', () => {
		const context = executeContext({
			recipients: '+14155550123',
			channels: ['sent'],
			messageType: 'template',
			messageTemplate: { mode: 'name', value: 'welcome' },
			templateParameters: '{}',
			requestOptions: {},
		});
		const request = buildOperation(context as never, 0, 'message', 'send');
		expect(request.body).toMatchObject({ to: ['+14155550123'], channel: ['sent'] });
	});

	it('restores Sent routing when the multi-option selection is empty', () => {
		const context = executeContext({
			recipients: '+14155550123',
			channels: [],
			messageType: 'text',
			text: 'Hello',
			requestOptions: {},
		});
		expect(buildOperation(context as never, 0, 'message', 'send').body).toMatchObject({
			channel: ['sent'],
		});
	});

	it('creates one broadcast channel entry for every explicit channel selection', () => {
		const context = executeContext({
			recipients: '+14155550123,+442079460123',
			channels: ['whatsapp', 'sms'],
			messageType: 'template',
			messageTemplate: { mode: 'id', value: 'template-id' },
			templateParameters: '{"name":"Test"}',
			requestOptions: { sandbox: true, idempotencyKey: 'send-1' },
		});
		const request = buildOperation(context as never, 0, 'message', 'send');
		expect(request.body).toMatchObject({
			to: ['+14155550123', '+442079460123'],
			channel: ['whatsapp', 'sms'],
			template: { id: 'template-id', parameters: { name: 'Test' } },
			sandbox: true,
		});
		expect(request.idempotencyKey).toBe('send-1');
	});

	it('supports documented free-form text', () => {
		const context = executeContext({
			recipients: '+14155550123',
			channels: ['sms'],
			messageType: 'text',
			text: 'Hello',
			requestOptions: {},
		});
		expect(buildOperation(context as never, 0, 'message', 'send').body).toMatchObject({
			text: 'Hello',
		});
	});

	it('rejects a send with no recipients', () => {
		const context = executeContext({ recipients: '', requestOptions: {} });
		expect(() => buildOperation(context as never, 0, 'message', 'send')).toThrow(
			/At least one recipient/,
		);
	});

	it('rejects an invalid idempotency key before making a request', () => {
		const context = executeContext({
			recipients: '+14155550123',
			channels: ['sent'],
			messageType: 'text',
			text: 'Hello',
			requestOptions: { idempotencyKey: 'spaces are not allowed' },
		});
		expect(() => buildOperation(context as never, 0, 'message', 'send')).toThrow(/Idempotency Key/);
	});
});
