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
});
