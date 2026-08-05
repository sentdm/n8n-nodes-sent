import { getNodeParameters } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { sentProperties } from '../nodes/Sent/actions/properties';

describe('Sent action parameter schema', () => {
	it('contains no display dependencies inside collection children', () => {
		const invalidChildren = sentProperties.flatMap((property) => {
			if (property.type !== 'collection' && property.type !== 'fixedCollection') return [];
			return (property.options ?? [])
				.filter((option) => option.displayOptions !== undefined)
				.map((option) => `${property.name}.${option.name}`);
		});

		expect(invalidChildren).toEqual([]);
	});

	it('resolves Send Message parameters with request options', () => {
		expect(() =>
			getNodeParameters(
				sentProperties,
				{
					resource: 'message',
					operation: 'send',
					requestOptions: { sandbox: true, idempotencyKey: 'schema-smoke-test' },
				},
				true,
				true,
				{ typeVersion: 1 },
				null,
			),
		).not.toThrow();
	});

	it.each([
		['message', 'send'],
		['contact', 'delete'],
		['template', 'update'],
		['user', 'remove'],
		['webhook', 'rotateSecret'],
	])('displays the shared Options collection for %s.%s', (resource, operation) => {
		const resolved = getNodeParameters(
			sentProperties,
			{ resource, operation, requestOptions: { sandbox: true } },
			true,
			false,
			{ typeVersion: 1 },
			null,
		);

		expect(resolved?.requestOptions).toEqual({ sandbox: true });
	});

	it('hides the Options collection for Webhook Delete, which supports neither field', () => {
		const resolved = getNodeParameters(
			sentProperties,
			{ resource: 'webhook', operation: 'delete', webhookId: 'wh-1' },
			true,
			false,
			{ typeVersion: 1 },
			null,
		);

		expect(resolved).not.toHaveProperty('requestOptions');
	});
});
