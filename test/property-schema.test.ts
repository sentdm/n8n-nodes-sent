import { getNodeParameters } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { SENT_SIMPLIFIED_OUTPUT_FIELDS, sentProperties } from '../nodes/Sent/actions/properties';

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

	it.each([['message', 'send']])(
		'displays the shared Options collection for %s.%s',
		(resource, operation) => {
			const resolved = getNodeParameters(
				sentProperties,
				{ resource, operation, requestOptions: { sandbox: true } },
				true,
				false,
				{ typeVersion: 1 },
				null,
			);

			expect(resolved?.requestOptions).toEqual({ sandbox: true });
		},
	);

	it.each([
		['account', 'get'],
		['contact', 'get'],
		['contact', 'getMany'],
		['message', 'get'],
		['numberLookup', 'lookup'],
	])('hides the Options collection for the read operation %s.%s', (resource, operation) => {
		const resolved = getNodeParameters(
			sentProperties,
			{ resource, operation },
			true,
			false,
			{ typeVersion: 1 },
			null,
		);

		expect(resolved).not.toHaveProperty('requestOptions');
	});

	it("uses a searchable 'From List' Resource Locator for contacts", () => {
		const contact = sentProperties.find((property) => property.name === 'contactId');

		expect(contact).toMatchObject({
			type: 'resourceLocator',
			default: { mode: 'list', value: '' },
			required: true,
		});
		expect(contact?.modes?.[0]).toMatchObject({
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: { searchListMethod: 'getContacts', searchable: true },
		});
	});

	it('offers the three required AI-tool output modes', () => {
		const output = sentProperties.find((property) => property.name === 'output');

		expect(output?.default).toBe('simple');
		expect(output?.options).toEqual([
			{ name: 'Simplified', value: 'simple' },
			{ name: 'Raw', value: 'raw' },
			{ name: 'Selected Fields', value: 'fields' },
		]);
		expect(output?.displayOptions?.show).toEqual({
			resource: ['account', 'contact', 'message'],
			operation: ['get', 'getMany'],
		});
	});

	it('limits every simplified entity shape to 10 fields and always includes ID', () => {
		for (const fields of Object.values(SENT_SIMPLIFIED_OUTPUT_FIELDS)) {
			expect(fields).toContain('id');
			expect(fields.length).toBeLessThanOrEqual(10);
		}
	});

	it("shows resource-specific field selectors only for 'Selected Fields' output", () => {
		const selectors = sentProperties.filter((property) => property.name === 'fields');

		expect(selectors).toHaveLength(3);
		expect(
			selectors.map((selector) => ({
				resource: selector.displayOptions?.show?.resource,
				operation: selector.displayOptions?.show?.operation,
				output: selector.displayOptions?.show?.output,
			})),
		).toEqual([
			{ resource: ['account'], operation: ['get'], output: ['fields'] },
			{ resource: ['contact'], operation: ['get', 'getMany'], output: ['fields'] },
			{ resource: ['message'], operation: ['get'], output: ['fields'] },
		]);
	});
});
