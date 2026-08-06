import type {
	IExecuteFunctions,
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	SENT_OUTPUT_FIELD_OPTIONS,
	SENT_SIMPLIFIED_OUTPUT_FIELDS,
	sentProperties,
} from './actions/properties';
import { buildOperation } from './helpers/operations';
import { compactObject, sentApiRequest, sentApiRequestAllItems, unwrapEnvelope } from './transport';

type SentOutputResource = keyof typeof SENT_OUTPUT_FIELD_OPTIONS;
type OutputMode = 'simple' | 'raw' | 'fields';

interface OutputSelection {
	resource: SentOutputResource;
	mode: OutputMode;
	fields: string[];
}

function supportsOutputSelection(
	resource: string,
	operation: string,
): resource is SentOutputResource {
	return (
		(resource === 'account' && operation === 'get') ||
		(resource === 'contact' && (operation === 'get' || operation === 'getMany')) ||
		(resource === 'message' && operation === 'get')
	);
}

function readOutputSelection(
	context: IExecuteFunctions,
	itemIndex: number,
	resource: string,
	operation: string,
): OutputSelection | undefined {
	if (!supportsOutputSelection(resource, operation)) return undefined;

	const mode = String(context.getNodeParameter('output', itemIndex, 'simple'));
	if (mode !== 'simple' && mode !== 'raw' && mode !== 'fields') {
		throw new NodeOperationError(
			context.getNode(),
			"'Output' must be 'Simplified', 'Raw', or 'Selected Fields'",
			{ itemIndex },
		);
	}

	if (mode !== 'fields') return { resource, mode, fields: [] };

	const fieldsValue = context.getNodeParameter('fields', itemIndex, []);
	if (!Array.isArray(fieldsValue)) {
		throw new NodeOperationError(context.getNode(), "'Fields' must contain a list", {
			itemIndex,
		});
	}
	const fields = [...new Set(fieldsValue.map((field) => String(field).trim()).filter(Boolean))];
	const allowedFields = new Set(SENT_OUTPUT_FIELD_OPTIONS[resource].map(({ value }) => value));
	const unknownField = fields.find((field) => !allowedFields.has(field));
	if (unknownField) {
		throw new NodeOperationError(
			context.getNode(),
			`'Fields' contains the unsupported value '${unknownField}'`,
			{ itemIndex },
		);
	}

	return { resource, mode, fields };
}

function selectFields(record: IDataObject, fields: string[]): IDataObject {
	const selected: IDataObject = {};
	for (const field of new Set(['id', ...fields])) {
		if (Object.prototype.hasOwnProperty.call(record, field)) selected[field] = record[field];
	}
	return selected;
}

function shapeOutput(records: IDataObject[], selection?: OutputSelection): IDataObject[] {
	if (!selection || selection.mode === 'raw') return records;
	const fields =
		selection.mode === 'simple'
			? SENT_SIMPLIFIED_OUTPUT_FIELDS[selection.resource]
			: selection.fields;
	return records.map((record) => selectFields(record, fields));
}

function requestedLimit(context: IExecuteFunctions, itemIndex: number): number {
	const value = context.getNodeParameter('limit', itemIndex, 50);
	const limit = typeof value === 'number' ? value : Number(value);
	if (!Number.isSafeInteger(limit) || limit < 1) {
		throw new NodeOperationError(
			context.getNode(),
			`'Limit' must be a whole number between 1 and ${Number.MAX_SAFE_INTEGER}`,
			{ itemIndex },
		);
	}
	return limit;
}

function continueOnFailOutput(error: unknown): IDataObject {
	const output: IDataObject = {
		error: error instanceof Error ? error.message : 'Sent request did not complete',
	};
	if (error instanceof NodeApiError || error instanceof NodeOperationError) {
		if (error.description) output.description = error.description;
		if (error instanceof NodeApiError) {
			if (error.httpCode) output.httpCode = error.httpCode;
			const errorCode = error.errorResponse?.name;
			if (typeof errorCode === 'string' && errorCode) output.errorCode = errorCode;

			const description = error.description ?? '';
			const requestId = description.match(/Request ID:\s*([^.]+)\./)?.[1]?.trim();
			if (requestId && requestId !== 'not provided') output.requestId = requestId;
			const retryAfter = description.match(/Retry-After:\s*([^.]+)\./)?.[1]?.trim();
			if (retryAfter) output.retryAfter = retryAfter;
			const documentationMarker = 'Documentation:';
			const documentationIndex = description.lastIndexOf(documentationMarker);
			if (documentationIndex >= 0) {
				const documentationUrl = description
					.slice(documentationIndex + documentationMarker.length)
					.trim()
					.replace(/\.$/, '');
				if (documentationUrl) output.documentationUrl = documentationUrl;
			}
		}
	}
	return output;
}

export class Sent implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Sent',
		name: 'sent',
		icon: {
			// Named by glyph colour, not by theme: n8n's `light`/`dark` keys are the theme the
			// icon renders in, so the dark glyph belongs to the light theme and vice versa.
			light: 'file:../../icons/sent-dark-icon.svg',
			dark: 'file:../../icons/sent-light-icon.svg',
		},
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Work with the Sent API v3',
		defaults: { name: 'Sent' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'sentApi', required: true }],
		properties: sentProperties,
	};

	methods = {
		listSearch: {
			async getContacts(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const envelope = await sentApiRequest.call(this, {
					method: 'GET',
					path: '/v3/contacts',
					query: compactObject({ page: 1, page_size: 100, search: filter }),
				});
				const data = envelope.data as IDataObject | undefined;
				const contacts = Array.isArray(data?.contacts) ? (data.contacts as IDataObject[]) : [];
				return {
					results: contacts
						.filter((contact) => typeof contact.id === 'string' && contact.id !== '')
						.map((contact) => ({
							name: String(contact.phone_number ?? contact.format_international ?? contact.id),
							value: String(contact.id),
							description: String(contact.id),
						})),
				};
			},
			async getTemplates(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const envelope = await sentApiRequest.call(this, {
					method: 'GET',
					path: '/v3/templates',
					query: compactObject({ page: 1, page_size: 100, search: filter }),
				});
				const data = envelope.data as IDataObject | undefined;
				const templates = Array.isArray(data?.templates) ? (data.templates as IDataObject[]) : [];
				return {
					results: templates
						// A template without an ID cannot be selected, and an empty value would
						// silently send `template: {}`.
						.filter((template) => typeof template.id === 'string' && template.id !== '')
						.map((template) => ({
							name: String(template.name ?? template.id),
							value: String(template.id),
						})),
				};
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const outputSelection = readOutputSelection(this, itemIndex, resource, operation);
				const request = buildOperation(this, itemIndex, resource, operation);
				let records: IDataObject[];

				if (request.paginated && request.collectionKey) {
					const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
					const limit = returnAll ? Number.MAX_SAFE_INTEGER : requestedLimit(this, itemIndex);
					records = await sentApiRequestAllItems.call(
						this,
						request,
						request.collectionKey,
						returnAll,
						limit,
					);
				} else {
					// Every operation that sets `collectionKey` also sets `paginated`, so the
					// branch above is the only collection unwrapper.
					records = unwrapEnvelope(await sentApiRequest.call(this, request));
				}
				records = shapeOutput(records, outputSelection);

				returnData.push(...records.map((json) => ({ json, pairedItem: { item: itemIndex } })));
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: continueOnFailOutput(error),
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				if (error instanceof NodeApiError || error instanceof NodeOperationError) {
					return Promise.reject(error);
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
