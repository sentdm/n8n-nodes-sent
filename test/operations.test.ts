import type { INodePropertyOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { sentProperties } from '../nodes/Sent/actions/properties';
import { buildOperation } from '../nodes/Sent/helpers/operations';

function executeContext(parameters: Record<string, unknown>) {
	return {
		getNode: () => ({ name: 'Sent', type: 'test.sent', typeVersion: 1, position: [0, 0], parameters: {} }),
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

const templateFields = {
	category: 'UTILITY',
	language: 'en_US',
	definitionJson: '{"body":{"text":"hi"}}',
	creationSource: 'from-api',
	submitForReview: false,
};

const webhookFields = {
	displayName: 'n8n',
	endpointUrl: 'https://n8n.example.com/webhook/sent',
	eventTypes: ['message'],
	eventFiltersJson: '{}',
	retryCount: 3,
	timeoutSeconds: 30,
};

// One row per operation the node declares. The coverage test below fails if the two
// ever drift apart, so a new operation cannot ship without a method/path assertion.
const matrix: Row[] = [
	{ resource: 'account', operation: 'get', parameters: {}, expected: { method: 'GET', path: '/v3/me' } },

	{ resource: 'message', operation: 'get', parameters: { messageId: 'm1' }, expected: { method: 'GET', path: '/v3/messages/m1' } },
	{ resource: 'message', operation: 'getActivities', parameters: { messageId: 'm1' }, expected: { method: 'GET', path: '/v3/messages/m1/activities' } },
	{ resource: 'message', operation: 'send', parameters: { recipients: '+14155550123', channels: ['sent'], messageType: 'text', text: 'Hello' }, expected: { method: 'POST', path: '/v3/messages' } },

	{ resource: 'contact', operation: 'delete', parameters: { contactId: 'c1' }, expected: { method: 'DELETE', path: '/v3/contacts/c1' } },
	{ resource: 'contact', operation: 'get', parameters: { contactId: 'c1' }, expected: { method: 'GET', path: '/v3/contacts/c1' } },
	{ resource: 'contact', operation: 'getMany', parameters: {}, expected: { method: 'GET', path: '/v3/contacts', collectionKey: 'contacts', paginated: true } },

	{ resource: 'numberLookup', operation: 'lookup', parameters: { phoneNumber: '+14155550123' }, expected: { method: 'GET', path: '/v3/numbers/lookup/%2B14155550123' } },

	{ resource: 'campaign', operation: 'create', parameters: { profileId: 'p1', campaignJson: '{"name":"c"}' }, expected: { method: 'POST', path: '/v3/profiles/p1/campaigns' } },
	{ resource: 'campaign', operation: 'delete', parameters: { profileId: 'p1', campaignId: 'cmp1' }, expected: { method: 'DELETE', path: '/v3/profiles/p1/campaigns/cmp1' } },
	{ resource: 'campaign', operation: 'getMany', parameters: { profileId: 'p1' }, expected: { method: 'GET', path: '/v3/profiles/p1/campaigns', collectionKey: 'campaigns' } },
	{ resource: 'campaign', operation: 'update', parameters: { profileId: 'p1', campaignId: 'cmp1', campaignJson: '{"name":"c"}' }, expected: { method: 'PUT', path: '/v3/profiles/p1/campaigns/cmp1' } },

	{ resource: 'profile', operation: 'complete', parameters: { profileId: 'p1', webhookUrl: 'https://n8n.example.com/done' }, expected: { method: 'POST', path: '/v3/profiles/p1/complete' } },
	{ resource: 'profile', operation: 'create', parameters: { name: 'Acme', additionalFieldsJson: '{}' }, expected: { method: 'POST', path: '/v3/profiles' } },
	{ resource: 'profile', operation: 'delete', parameters: { profileId: 'p1' }, expected: { method: 'DELETE', path: '/v3/profiles/p1' } },
	{ resource: 'profile', operation: 'get', parameters: { profileId: 'p1' }, expected: { method: 'GET', path: '/v3/profiles/p1' } },
	{ resource: 'profile', operation: 'getMany', parameters: {}, expected: { method: 'GET', path: '/v3/profiles', collectionKey: 'profiles' } },
	{ resource: 'profile', operation: 'update', parameters: { profileId: 'p1', name: 'Acme', additionalFieldsJson: '{}' }, expected: { method: 'PATCH', path: '/v3/profiles/p1' } },

	{ resource: 'template', operation: 'create', parameters: templateFields, expected: { method: 'POST', path: '/v3/templates' } },
	{ resource: 'template', operation: 'delete', parameters: { templateId: 't1' }, expected: { method: 'DELETE', path: '/v3/templates/t1' } },
	{ resource: 'template', operation: 'get', parameters: { templateId: 't1' }, expected: { method: 'GET', path: '/v3/templates/t1' } },
	{ resource: 'template', operation: 'getMany', parameters: {}, expected: { method: 'GET', path: '/v3/templates', collectionKey: 'templates', paginated: true } },
	{ resource: 'template', operation: 'update', parameters: { templateId: 't1', name: 'Welcome', ...templateFields }, expected: { method: 'PUT', path: '/v3/templates/t1' } },

	{ resource: 'user', operation: 'get', parameters: { userId: 'u1' }, expected: { method: 'GET', path: '/v3/users/u1' } },
	{ resource: 'user', operation: 'getMany', parameters: {}, expected: { method: 'GET', path: '/v3/users', collectionKey: 'users' } },
	{ resource: 'user', operation: 'invite', parameters: { email: 'person@example.com', name: 'Person', role: 'developer' }, expected: { method: 'POST', path: '/v3/users' } },
	{ resource: 'user', operation: 'remove', parameters: { userId: 'u1' }, expected: { method: 'DELETE', path: '/v3/users/u1' } },
	{ resource: 'user', operation: 'updateRole', parameters: { userId: 'u1', role: 'admin' }, expected: { method: 'PATCH', path: '/v3/users/u1' } },

	{ resource: 'webhook', operation: 'create', parameters: webhookFields, expected: { method: 'POST', path: '/v3/webhooks' } },
	{ resource: 'webhook', operation: 'delete', parameters: { webhookId: 'w1' }, expected: { method: 'DELETE', path: '/v3/webhooks/w1' } },
	{ resource: 'webhook', operation: 'get', parameters: { webhookId: 'w1' }, expected: { method: 'GET', path: '/v3/webhooks/w1' } },
	{ resource: 'webhook', operation: 'getEventTypes', parameters: {}, expected: { method: 'GET', path: '/v3/webhooks/event-types' } },
	{ resource: 'webhook', operation: 'getEvents', parameters: { webhookId: 'w1' }, expected: { method: 'GET', path: '/v3/webhooks/w1/events', collectionKey: 'events', paginated: true } },
	{ resource: 'webhook', operation: 'getMany', parameters: {}, expected: { method: 'GET', path: '/v3/webhooks', collectionKey: 'webhooks', paginated: true } },
	{ resource: 'webhook', operation: 'rotateSecret', parameters: { webhookId: 'w1' }, expected: { method: 'POST', path: '/v3/webhooks/w1/rotate-secret' } },
	{ resource: 'webhook', operation: 'test', parameters: { webhookId: 'w1', eventType: 'message.sent' }, expected: { method: 'POST', path: '/v3/webhooks/w1/test' } },
	{ resource: 'webhook', operation: 'toggleStatus', parameters: { webhookId: 'w1', isActive: true }, expected: { method: 'PATCH', path: '/v3/webhooks/w1/toggle-status' } },
	{ resource: 'webhook', operation: 'update', parameters: { webhookId: 'w1', ...webhookFields }, expected: { method: 'PUT', path: '/v3/webhooks/w1' } },
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
		['contact', 'getMessageSummary'],
	])('rejects the removed operation %s.%s', (resource, operation) => {
		expect(() =>
			buildOperation(
				executeContext({ contactId: 'c1', conversationId: 'v1', phoneNumber: '+1' }) as never,
				0,
				resource,
				operation,
			),
		).toThrow(new RegExp(`Unsupported Sent operation: ${resource}\\.${operation}`));
	});
});

describe('Sent operation request bodies', () => {
	it('sends no body or idempotency key for Webhook Delete', () => {
		const request = buildOperation(
			executeContext({ webhookId: 'w1', requestOptions: { sandbox: true, idempotencyKey: 'k1' } }) as never,
			0,
			'webhook',
			'delete',
		);

		expect(request.body).toBeUndefined();
		expect(request.idempotencyKey).toBeUndefined();
	});

	it('adds sandbox to the body of a mutation that supports it', () => {
		const request = buildOperation(
			executeContext({ templateId: 't1', requestOptions: { sandbox: true } }) as never,
			0,
			'template',
			'delete',
		);

		expect(request.body).toEqual({ sandbox: true });
	});

	it('refuses an empty Profile Update rather than sending an empty PATCH', () => {
		expect(() =>
			buildOperation(
				executeContext({ profileId: 'p1', name: '', additionalFieldsJson: '{}' }) as never,
				0,
				'profile',
				'update',
			),
		).toThrow(/at least one field to change/);
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
			{ messageType: 'template', messageTemplate: { mode: 'id', value: '' }, templateParameters: '{}' },
			/Template is required/,
		],
		[
			'a text body that resolves empty',
			{ messageType: 'text', text: '' },
			/Text is required/,
		],
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
				executeContext({ profileId: 'p1', campaignId: 'c1', campaignJson: '["not","an","object"]' }) as never,
				0,
				'campaign',
				'update',
			),
		).toThrow(/Campaign JSON must contain a JSON object/);
	});

	it('reports malformed JSON text as a parse problem', () => {
		expect(() =>
			buildOperation(
				executeContext({ profileId: 'p1', campaignId: 'c1', campaignJson: '{oops' }) as never,
				0,
				'campaign',
				'update',
			),
		).toThrow(/Campaign JSON is not valid JSON/);
	});

	it('URL-encodes an identifier that contains path characters', () => {
		const request = buildOperation(
			executeContext({ contactId: 'a/b?c' }) as never,
			0,
			'contact',
			'get',
		);

		expect(request.path).toBe('/v3/contacts/a%2Fb%3Fc');
	});

	it.each(['contactId', 'messageId', 'templateId', 'userId', 'webhookId'])(
		'requires %s before making a request',
		(field) => {
			const byField: Record<string, [string, string]> = {
				contactId: ['contact', 'get'],
				messageId: ['message', 'get'],
				templateId: ['template', 'get'],
				userId: ['user', 'get'],
				webhookId: ['webhook', 'get'],
			};
			const [resource, operation] = byField[field];
			expect(() => buildOperation(executeContext({}) as never, 0, resource, operation)).toThrow(
				new RegExp(`${field} is required`),
			);
		},
	);
});
