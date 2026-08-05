import type { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { compactObject, parseJsonInput } from '../transport';
import type { SentMessageRequest, SentRequestOptions } from '../types';

export interface BuiltOperation extends SentRequestOptions {
	collectionKey?: string;
	paginated?: boolean;
}

function parameter(context: IExecuteFunctions, name: string, itemIndex: number): string {
	return String(context.getNodeParameter(name, itemIndex, ''));
}

function requestOptions(context: IExecuteFunctions, itemIndex: number): IDataObject {
	return context.getNodeParameter('requestOptions', itemIndex, {}) as IDataObject;
}

// Reads a JSON-typed parameter unstringified, so an expression resolving to an object
// reaches parseJsonInput as an object rather than as "[object Object]".
function jsonParameter(
	context: IExecuteFunctions,
	name: string,
	itemIndex: number,
	fieldName: string,
): IDataObject {
	return parseJsonInput(context.getNodeParameter(name, itemIndex, ''), fieldName, context.getNode());
}

function baseRequest(
	context: IExecuteFunctions,
	itemIndex: number,
	method: SentRequestOptions['method'],
	path: string,
	body?: IDataObject,
): BuiltOperation {
	const options = requestOptions(context, itemIndex);
	const sandbox = options.sandbox === true;
	const idempotencyKey = String(options.idempotencyKey ?? '');
	if (
		idempotencyKey &&
		(idempotencyKey.length > 255 || !/^[A-Za-z0-9_-]+$/.test(idempotencyKey))
	) {
		throw new NodeOperationError(
			context.getNode(),
			'Idempotency Key must be 1-255 letters, numbers, hyphens, or underscores',
			{ itemIndex },
		);
	}
	return {
		method,
		path,
		body: body ? compactObject({ ...body, ...(sandbox ? { sandbox: true } : {}) }) : undefined,
		idempotencyKey,
		itemIndex,
	};
}

function identifier(context: IExecuteFunctions, itemIndex: number, name: string): string {
	const value = parameter(context, name, itemIndex).trim();
	if (!value) throw new NodeOperationError(context.getNode(), `${name} is required`, { itemIndex });
	return encodeURIComponent(value);
}

function filters(context: IExecuteFunctions, itemIndex: number): IDataObject {
	const value = context.getNodeParameter('filters', itemIndex, {}) as IDataObject;
	return compactObject({
		search: value.search,
		channel: value.channel,
		phone: value.phone,
	});
}

export function buildOperation(
	context: IExecuteFunctions,
	itemIndex: number,
	resource: string,
	operation: string,
): BuiltOperation {
	if (resource === 'account') return baseRequest(context, itemIndex, 'GET', '/v3/me');

	if (resource === 'message') {
		if (operation === 'get') {
			return baseRequest(context, itemIndex, 'GET', `/v3/messages/${identifier(context, itemIndex, 'messageId')}`);
		}
		if (operation === 'getActivities') {
			return baseRequest(context, itemIndex, 'GET', `/v3/messages/${identifier(context, itemIndex, 'messageId')}/activities`);
		}
		if (operation === 'send') {
			const recipients = parameter(context, 'recipients', itemIndex)
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean);
			if (recipients.length === 0) {
				throw new NodeOperationError(context.getNode(), 'At least one recipient is required', { itemIndex });
			}
			const messageType = parameter(context, 'messageType', itemIndex);
			const selectedChannels = context.getNodeParameter('channels', itemIndex, ['sent']) as string[];
			const body: SentMessageRequest = {
				to: recipients,
				channel: selectedChannels.length > 0 ? selectedChannels : ['sent'],
			};
			// `required: true` is an editor-time check on the stored value, so an expression
			// that resolves to '' still reaches here. compactObject would then strip the
			// field and post a message with no content at all.
			if (messageType === 'text') {
				const text = parameter(context, 'text', itemIndex);
				if (!text) {
					throw new NodeOperationError(context.getNode(), 'Text is required', { itemIndex });
				}
				body.text = text;
			} else {
				const locator = context.getNodeParameter('messageTemplate', itemIndex) as {
					mode: 'id' | 'list' | 'name';
					value: string;
				};
				const template = String(locator.value ?? '').trim();
				if (!template) {
					throw new NodeOperationError(context.getNode(), 'Template is required', { itemIndex });
				}
				body.template = compactObject({
					[locator.mode === 'name' ? 'name' : 'id']: template,
					parameters: jsonParameter(context, 'templateParameters', itemIndex, 'Template Parameters'),
				});
			}
			return baseRequest(context, itemIndex, 'POST', '/v3/messages', body);
		}
	}

	if (resource === 'contact') {
		// `getMany` renders no Contact ID field, so it must resolve before identifier().
		if (operation === 'getMany') return { ...baseRequest(context, itemIndex, 'GET', '/v3/contacts'), query: filters(context, itemIndex), collectionKey: 'contacts', paginated: true };
		const contactId = identifier(context, itemIndex, 'contactId');
		if (operation === 'get') return baseRequest(context, itemIndex, 'GET', `/v3/contacts/${contactId}`);
	}

	if (resource === 'numberLookup') {
		return baseRequest(context, itemIndex, 'GET', `/v3/numbers/lookup/${identifier(context, itemIndex, 'phoneNumber')}`);
	}

	throw new NodeOperationError(context.getNode(), `Unsupported Sent operation: ${resource}.${operation}`, { itemIndex });
}

