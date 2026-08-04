import type {
	IExecuteFunctions,
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { sentProperties } from './actions/properties';
import { buildOperation } from './helpers/operations';
import { sentApiRequest, sentApiRequestAllItems, unwrapEnvelope } from './transport';

export class Sent implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Sent',
		name: 'sent',
		icon: {
			light: 'file:../../icons/sent-logo.svg',
			dark: 'file:../../icons/sent-logo.dark.svg',
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
			async getTemplates(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
				const envelope = await sentApiRequest.call(this, {
					method: 'GET',
					path: '/v3/templates',
					query: { page: 1, page_size: 100 },
				});
				const data = envelope.data as IDataObject | undefined;
				const templates = Array.isArray(data?.templates) ? (data.templates as IDataObject[]) : [];
				return {
					results: templates.map((template) => ({
						name: String(template.name ?? template.id ?? 'Unnamed template'),
						value: String(template.id ?? ''),
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
				const request = buildOperation(this, itemIndex, resource, operation);
				let records: IDataObject[];

				if (request.paginated && request.collectionKey) {
					const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
					const limit = returnAll
						? Number.MAX_SAFE_INTEGER
						: (this.getNodeParameter('limit', itemIndex, 50) as number);
					records = await sentApiRequestAllItems.call(
						this,
						request,
						request.collectionKey,
						returnAll,
						limit,
					);
				} else {
					const envelope = await sentApiRequest.call(this, request);
					if (request.collectionKey && envelope.data && !Array.isArray(envelope.data)) {
						const collection = (envelope.data as IDataObject)[request.collectionKey];
						records = Array.isArray(collection) ? (collection as IDataObject[]) : unwrapEnvelope(envelope);
					} else {
						records = unwrapEnvelope(envelope);
					}
				}

				returnData.push(
					...records.map((json) => ({ json, pairedItem: { item: itemIndex } })),
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error instanceof Error ? error.message : 'Unknown Sent error' },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
