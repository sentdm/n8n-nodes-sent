import type { INodePropertyOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { sentProperties } from '../nodes/Sent/actions/properties';
import { SentTrigger } from '../nodes/SentTrigger/SentTrigger.node';

// Vite's eager glob, not node:fs — the n8n Cloud ruleset bans fs/path in every .ts file.
const workflows = import.meta.glob('../examples/workflows/*.json', { eager: true }) as Record<
	string,
	{ default: Workflow }
>;

interface WorkflowNode {
	name: string;
	type: string;
	typeVersion: number;
	parameters: Record<string, unknown>;
}
interface Workflow {
	name: string;
	nodes: WorkflowNode[];
	connections: Record<string, { main?: Array<Array<{ node: string }> | null> }>;
}

const ACTION_TYPE = '@sentdm/n8n-nodes-sent.sent';
const TRIGGER_TYPE = '@sentdm/n8n-nodes-sent.sentTrigger';

const actionParameters = new Set(sentProperties.map((property) => property.name));
const triggerParameters = new Set(
	new SentTrigger().description.properties.map((property) => property.name),
);
const operationsByResource = new Map<string, Set<string>>(
	sentProperties
		.filter((property) => property.name === 'operation')
		.map((property) => [
			(property.displayOptions?.show?.resource as string[])[0],
			new Set((property.options ?? []).map((o) => (o as INodePropertyOptions).value as string)),
		]),
);

const cases = Object.entries(workflows)
	.map(([path, module]) => [path.split('/').pop() as string, module.default] as const)
	.sort(([a], [b]) => a.localeCompare(b));

describe('example workflows', () => {
	it('ships at least one example', () => {
		expect(cases.length).toBeGreaterThan(0);
	});

	it.each(cases)('%s only uses resources and operations the node declares', (_file, workflow) => {
		for (const node of workflow.nodes.filter((n) => n.type === ACTION_TYPE)) {
			const resource = node.parameters.resource as string;
			const operation = node.parameters.operation as string;
			expect(operationsByResource.has(resource), `unknown resource "${resource}"`).toBe(true);
			expect(
				operationsByResource.get(resource)?.has(operation),
				`unknown operation "${resource}.${operation}"`,
			).toBe(true);
		}
	});

	it.each(cases)('%s only sets parameters the node declares', (_file, workflow) => {
		for (const node of workflow.nodes) {
			const known =
				node.type === ACTION_TYPE
					? actionParameters
					: node.type === TRIGGER_TYPE
						? triggerParameters
						: undefined;
			if (!known) continue;
			for (const key of Object.keys(node.parameters)) {
				expect(known.has(key), `${node.name} sets unknown parameter "${key}"`).toBe(true);
			}
		}
	});

	it.each(cases)('%s connects only nodes that exist', (_file, workflow) => {
		const names = new Set(workflow.nodes.map((node) => node.name));
		for (const [from, spec] of Object.entries(workflow.connections ?? {})) {
			expect(names.has(from), `connection from missing node "${from}"`).toBe(true);
			for (const branch of spec.main ?? []) {
				for (const connection of branch ?? []) {
					expect(
						names.has(connection.node),
						`connection to missing node "${connection.node}"`,
					).toBe(true);
				}
			}
		}
	});

	it.each(cases)('%s carries no credential IDs and no live phone numbers', (_file, workflow) => {
		const json = JSON.stringify(workflow);
		expect(json).not.toMatch(/"credentials"\s*:/);
		// Only ranges reserved for fiction may appear: NANP 555-01xx and Ofcom 020 7946 0xxx.
		for (const number of json.match(/\+\d{8,15}/g) ?? []) {
			expect(number, `${number} is not in a reserved-for-fiction range`).toMatch(
				/^\+1\d{3}5550\d{3}$|^\+4420794 ?60\d{3}$/,
			);
		}
	});

	it.each(cases)('%s sends only in sandbox mode', (_file, workflow) => {
		for (const node of workflow.nodes.filter(
			(n) => n.type === ACTION_TYPE && n.parameters.operation === 'send',
		)) {
			const options = (node.parameters.requestOptions ?? {}) as { sandbox?: boolean };
			expect(options.sandbox, `${node.name} would send for real on import`).toBe(true);
		}
	});
});
