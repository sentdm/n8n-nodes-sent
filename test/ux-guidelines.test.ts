import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { sentProperties } from '../nodes/Sent/actions/properties';

// n8n's own parameter lint rules cannot see these operations: twelve of them, including
// every get-many and option-naming rule, return early on
// `options.hasPropertyPointingToIdentifier`, and this file builds each Operation
// property's options from a factory rather than an inline literal. A deliberately
// non-compliant operation therefore passes `n8n-node lint` with exit 0. These assertions
// encode the rules from
// docs.n8n.io/connect/create-nodes/build-your-node/reference/ux-guidelines, which the
// page states a node "must conform to" to be a verified community node candidate.

interface Operation {
	resource: string;
	resourceLabel: string;
	name: string;
	value: string;
	action?: string;
	description?: string;
}

const resourceLabels = new Map(
	((sentProperties.find((p) => p.name === 'resource') as INodeProperties).options ?? []).map(
		(o) => [(o as INodePropertyOptions).value as string, (o as INodePropertyOptions).name],
	),
);

const operations: Operation[] = sentProperties
	.filter((property) => property.name === 'operation')
	.flatMap((property) => {
		const resource = (property.displayOptions?.show?.resource as string[])[0];
		return (property.options ?? []).map((option) => {
			const o = option as INodePropertyOptions & { action?: string };
			return {
				resource,
				resourceLabel: resourceLabels.get(resource) ?? resource,
				name: o.name,
				value: o.value as string,
				action: o.action,
				description: o.description,
			};
		});
	});

const cases = operations.map((o) => [`${o.resource}.${o.value}`, o] as const);

describe('operation naming conforms to the n8n UX guidelines', () => {
	it('found the operations to check', () => {
		expect(operations.length).toBeGreaterThan(0);
	});

	// "Don't repeat the resource (if the resource selection is above): The resource is
	// often displayed above the operation, so it's not necessary to repeat it."
	it.each(cases)('%s name does not repeat the resource', (_label, operation) => {
		const resourceWords = operation.resourceLabel.toLowerCase().split(/\s+/);
		const nameWords = operation.name.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
		for (const word of nameWords) {
			const singular = word.replace(/s$/, '');
			expect(
				resourceWords.includes(singular) || resourceWords.includes(word),
				`operation name "${operation.name}" repeats resource "${operation.resourceLabel}"`,
			).toBe(false);
		}
	});

	// "Omit articles: To keep the text shorter, get rid of articles (a, an, the...)."
	it.each(cases)('%s action omits articles', (_label, operation) => {
		expect(operation.action, 'every operation needs an action').toBeTruthy();
		expect(
			operation.action,
			`action "${operation.action}" contains an article`,
		).not.toMatch(/\b(a|an|the)\b/i);
	});

	// "Case: Title Case" for `name`.
	it.each(cases)('%s name is Title Case', (_label, operation) => {
		for (const word of operation.name.split(/\s+/)) {
			expect(word[0], `"${operation.name}" is not Title Case`).toBe(word[0].toUpperCase());
		}
	});

	// The description is the subtext under the name in the operation dropdown; core n8n
	// nodes ship one for every operation and an empty dropdown row reads as unfinished.
	it.each(cases)('%s has a description for the dropdown subtext', (_label, operation) => {
		expect(operation.description, 'operation is missing a description').toBeTruthy();
	});

	// Vocabulary section: a list-of-resources operation is named "Get Many".
	it.each(cases.filter(([, o]) => o.value === 'getMany' || o.value === 'getAll'))(
		'%s uses the standard "Get Many" label',
		(_label, operation) => {
			expect(operation.name).toBe('Get Many');
		},
	);
});
