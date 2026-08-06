import type { INodePropertyOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { sentProperties } from '../nodes/Sent/actions/properties';
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

interface Row {
	resource: string;
	operation: string;
	parameters: Record<string, unknown>;
	expected: {
		method: string;
		path: string;
		collectionKey?: string;
		paginated?: boolean;
	};
}

// One row per operation the node declares. The coverage test below fails if the two
// ever drift apart, so a new operation cannot ship without a method/path assertion.
const matrix: Row[] = [
	{
		resource: 'account',
		operation: 'get',
		parameters: {},
		expected: { method: 'GET', path: '/v3/me' },
	},

	{
		resource: 'message',
		operation: 'get',
		parameters: { messageId: 'm1' },
		expected: { method: 'GET', path: '/v3/messages/m1' },
	},
	{
		resource: 'message',
		operation: 'getActivities',
		parameters: { messageId: 'm1' },
		expected: { method: 'GET', path: '/v3/messages/m1/activities' },
	},
	{
		resource: 'message',
		operation: 'send',
		parameters: {
			recipients: '+14155550123',
			channels: ['sent'],
			messageType: 'text',
			text: 'Hello',
		},
		expected: { method: 'POST', path: '/v3/messages' },
	},

	{
		resource: 'contact',
		operation: 'get',
		parameters: { contactId: { mode: 'list', value: 'c1' } },
		expected: { method: 'GET', path: '/v3/contacts/c1' },
	},
	{
		resource: 'contact',
		operation: 'getMany',
		parameters: {},
		expected: { method: 'GET', path: '/v3/contacts', collectionKey: 'contacts', paginated: true },
	},

	{
		resource: 'numberLookup',
		operation: 'lookup',
		parameters: { phoneNumber: '+14155550123' },
		expected: { method: 'GET', path: '/v3/numbers/lookup/%2B14155550123' },
	},
];

function declaredOperations(): string[] {
	return sentProperties
		.filter((property) => property.name === 'operation')
		.flatMap((property) => {
			const resources = (property.displayOptions?.show?.resource ?? []) as string[];
			return (property.options ?? []).map(
				(option) => `${resources[0]}.${(option as INodePropertyOptions).value as string}`,
			);
		});
}

describe('Sent operation matrix', () => {
	it.each(matrix.map((row) => [`${row.resource}.${row.operation}`, row] as const))(
		'builds %s',
		(_label, row) => {
			const request = buildOperation(
				executeContext(row.parameters) as never,
				0,
				row.resource,
				row.operation,
			);

			expect(request.method).toBe(row.expected.method);
			expect(request.path).toBe(row.expected.path);
			expect(request.collectionKey).toBe(row.expected.collectionKey);
			expect(request.paginated ?? false).toBe(row.expected.paginated ?? false);
		},
	);

	it('covers every declared operation exactly once', () => {
		const covered = matrix.map((row) => `${row.resource}.${row.operation}`);
		expect(new Set(covered).size).toBe(covered.length);
		expect([...covered].sort()).toEqual([...declaredOperations()].sort());
	});

	it.each([
		// Resources and operations removed from the node surface must not resolve.
		['conversation', 'getMany'],
		['conversation', 'getMessages'],
		['contact', 'create'],
		['contact', 'update'],
		['contact', 'delete'],
		['contact', 'getMessageSummary'],
		['template', 'create'],
		['template', 'delete'],
		['template', 'get'],
		['template', 'getMany'],
		['template', 'update'],
		['user', 'get'],
		['user', 'getMany'],
		['user', 'invite'],
		['user', 'remove'],
		['user', 'updateRole'],
		['profile', 'complete'],
		['profile', 'create'],
		['profile', 'delete'],
		['profile', 'get'],
		['profile', 'getMany'],
		['profile', 'update'],
		['campaign', 'create'],
		['campaign', 'delete'],
		['campaign', 'getMany'],
		['campaign', 'update'],
		['webhook', 'create'],
		['webhook', 'delete'],
		['webhook', 'get'],
		['webhook', 'getEventTypes'],
		['webhook', 'getEvents'],
		['webhook', 'getMany'],
		['webhook', 'rotateSecret'],
		['webhook', 'test'],
		['webhook', 'toggleStatus'],
		['webhook', 'update'],
	])('rejects the removed operation %s.%s', (resource, operation) => {
		expect(() =>
			buildOperation(
				executeContext({
					contactId: 'c1',
					conversationId: 'v1',
					phoneNumber: '+1',
					templateId: 't1',
					userId: 'u1',
					profileId: 'p1',
					campaignId: 'cmp1',
					webhookId: 'w1',
				}) as never,
				0,
				resource,
				operation,
			),
		).toThrow(new RegExp(`Unsupported Sent operation: ${resource}\\.${operation}`));
	});
});

describe('Sent operation request bodies', () => {
	it('adds sandbox to the body of a mutation that supports it', () => {
		const request = buildOperation(
			executeContext({
				recipients: '+14155550123',
				channels: ['sent'],
				messageType: 'text',
				text: 'Hello',
				requestOptions: { sandbox: true },
			}) as never,
			0,
			'message',
			'send',
		);

		expect(request.body).toMatchObject({ sandbox: true });
	});

	it('accepts an object-valued expression result for a JSON parameter', () => {
		const request = buildOperation(
			executeContext({
				recipients: '+14155550123',
				channels: ['sent'],
				messageType: 'template',
				messageTemplate: { mode: 'id', value: 't1' },
				// `={{ $json.vars }}` resolves to an object, never to JSON text.
				templateParameters: { first_name: 'Ada' },
			}) as never,
			0,
			'message',
			'send',
		);

		expect(request.body).toMatchObject({
			template: { id: 't1', parameters: { first_name: 'Ada' } },
		});
	});

	it.each([
		[
			'a template locator that resolves empty',
			{
				messageType: 'template',
				messageTemplate: { mode: 'id', value: '' },
				templateParameters: '{}',
			},
			/'Template' is required/,
		],
		['a text body that resolves empty', { messageType: 'text', text: '' }, /'Text' is required/],
	])('refuses to send a message with %s', (_label, extra, message) => {
		// `required: true` is only an editor-time check on the stored value, so an
		// expression resolving to '' would otherwise reach compactObject and post a
		// message carrying neither text nor template.
		expect(() =>
			buildOperation(
				executeContext({ recipients: '+14155550123', channels: ['sent'], ...extra }) as never,
				0,
				'message',
				'send',
			),
		).toThrow(message);
	});

	it('reports a wrong JSON shape as a shape problem, not a parse problem', () => {
		expect(() =>
			buildOperation(
				executeContext({
					recipients: '+1',
					channels: ['sent'],
					messageType: 'template',
					messageTemplate: { mode: 'id', value: 't1' },
					templateParameters: '["not","an","object"]',
				}) as never,
				0,
				'message',
				'send',
			),
		).toThrow(/'Template Parameters' must contain a JSON object/);
	});

	it('reports malformed JSON text as a parse problem', () => {
		expect(() =>
			buildOperation(
				executeContext({
					recipients: '+1',
					channels: ['sent'],
					messageType: 'template',
					messageTemplate: { mode: 'id', value: 't1' },
					templateParameters: '{oops',
				}) as never,
				0,
				'message',
				'send',
			),
		).toThrow(/'Template Parameters' is not valid JSON/);
	});

	it('URL-encodes an identifier that contains path characters', () => {
		const request = buildOperation(
			executeContext({ contactId: { mode: 'id', value: 'a/b?c' } }) as never,
			0,
			'contact',
			'get',
		);

		expect(request.path).toBe('/v3/contacts/a%2Fb%3Fc');
	});

	// The message must name the field as the UI labels it, never the internal parameter.
	it.each([
		['contact', 'get', 'Contact'],
		['message', 'get', 'Message ID'],
		['message', 'getActivities', 'Message ID'],
		['numberLookup', 'lookup', 'Phone Number'],
	])('%s.%s reports the missing field by its display name', (resource, operation, label) => {
		expect(() => buildOperation(executeContext({}) as never, 0, resource, operation)).toThrow(
			`'${label}' is required`,
		);
	});

	it('continues to accept the scalar contact ID stored by version 1 workflows', () => {
		const request = buildOperation(
			executeContext({ contactId: 'legacy-contact-id' }) as never,
			0,
			'contact',
			'get',
		);

		expect(request.path).toBe('/v3/contacts/legacy-contact-id');
	});

	it('does not combine automatic routing with an explicit channel', () => {
		expect(() =>
			buildOperation(
				executeContext({
					recipients: '+14155550123',
					channels: ['sent', 'sms'],
					messageType: 'text',
					text: 'Hello',
				}) as never,
				0,
				'message',
				'send',
			),
		).toThrow(/'Channels' cannot combine 'Sent \(Automatic Routing\)'/);
	});

	it('rejects more than 1,000 recipients before sending', () => {
		const recipients = Array.from({ length: 1_001 }, (_, index) => `+1415555${index}`).join(',');

		expect(() =>
			buildOperation(
				executeContext({
					recipients,
					channels: ['sent'],
					messageType: 'text',
					text: 'Hello',
				}) as never,
				0,
				'message',
				'send',
			),
		).toThrow(/'Recipients' can contain at most 1,000 phone numbers/);
	});
});
