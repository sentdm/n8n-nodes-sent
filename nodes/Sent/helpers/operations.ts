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
		status: value.status,
		category: value.category,
		is_active: value.isActive,
		is_welcome_playground: value.isWelcomePlayground,
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
		if (operation === 'delete') return baseRequest(context, itemIndex, 'DELETE', `/v3/contacts/${contactId}`, {});
		if (operation === 'get') return baseRequest(context, itemIndex, 'GET', `/v3/contacts/${contactId}`);
	}

	if (resource === 'numberLookup') {
		return baseRequest(context, itemIndex, 'GET', `/v3/numbers/lookup/${identifier(context, itemIndex, 'phoneNumber')}`);
	}

	if (resource === 'campaign') {
		const profileId = identifier(context, itemIndex, 'profileId');
		const root = `/v3/profiles/${profileId}/campaigns`;
		if (operation === 'getMany') return { ...baseRequest(context, itemIndex, 'GET', root), collectionKey: 'campaigns' };
		if (operation === 'delete') return baseRequest(context, itemIndex, 'DELETE', `${root}/${identifier(context, itemIndex, 'campaignId')}`, {});
		const campaign = jsonParameter(context, 'campaignJson', itemIndex, 'Campaign JSON');
		if (operation === 'create') return baseRequest(context, itemIndex, 'POST', root, { campaign });
		if (operation === 'update') return baseRequest(context, itemIndex, 'PUT', `${root}/${identifier(context, itemIndex, 'campaignId')}`, { campaign });
	}

	if (resource === 'profile') {
		if (operation === 'getMany') return { ...baseRequest(context, itemIndex, 'GET', '/v3/profiles'), collectionKey: 'profiles' };
		if (operation === 'create') {
			return baseRequest(context, itemIndex, 'POST', '/v3/profiles', {
				name: parameter(context, 'name', itemIndex),
				...jsonParameter(context, 'additionalFieldsJson', itemIndex, 'Additional Fields JSON'),
			});
		}
		const profileId = identifier(context, itemIndex, 'profileId');
		if (operation === 'delete') return baseRequest(context, itemIndex, 'DELETE', `/v3/profiles/${profileId}`, {});
		if (operation === 'get') return baseRequest(context, itemIndex, 'GET', `/v3/profiles/${profileId}`);
		if (operation === 'complete') return baseRequest(context, itemIndex, 'POST', `/v3/profiles/${profileId}/complete`, { webHookUrl: parameter(context, 'webhookUrl', itemIndex) });
		if (operation === 'update') {
			const fields = compactObject({
				name: parameter(context, 'name', itemIndex),
				...jsonParameter(context, 'additionalFieldsJson', itemIndex, 'Additional Fields JSON'),
			});
			if (Object.keys(fields).length === 0) {
				throw new NodeOperationError(
					context.getNode(),
					'Profile Update needs at least one field to change. Set Name, or add fields to Additional Fields JSON.',
					{ itemIndex },
				);
			}
			return baseRequest(context, itemIndex, 'PATCH', `/v3/profiles/${profileId}`, fields);
		}
	}

	if (resource === 'template') {
		if (operation === 'getMany') return { ...baseRequest(context, itemIndex, 'GET', '/v3/templates'), query: filters(context, itemIndex), collectionKey: 'templates', paginated: true };
		if (operation === 'create') return baseRequest(context, itemIndex, 'POST', '/v3/templates', {
			category: parameter(context, 'category', itemIndex),
			language: parameter(context, 'language', itemIndex),
			definition: jsonParameter(context, 'definitionJson', itemIndex, 'Definition JSON'),
			creation_source: parameter(context, 'creationSource', itemIndex),
			submit_for_review: context.getNodeParameter('submitForReview', itemIndex, false) as boolean,
		});
		const templateId = identifier(context, itemIndex, 'templateId');
		if (operation === 'delete') return baseRequest(context, itemIndex, 'DELETE', `/v3/templates/${templateId}`, {});
		if (operation === 'get') return baseRequest(context, itemIndex, 'GET', `/v3/templates/${templateId}`);
		if (operation === 'update') return baseRequest(context, itemIndex, 'PUT', `/v3/templates/${templateId}`, {
			name: parameter(context, 'name', itemIndex),
			category: parameter(context, 'category', itemIndex),
			language: parameter(context, 'language', itemIndex),
			definition: jsonParameter(context, 'definitionJson', itemIndex, 'Definition JSON'),
			submit_for_review: context.getNodeParameter('submitForReview', itemIndex, false) as boolean,
		});
	}

	if (resource === 'user') {
		if (operation === 'getMany') return { ...baseRequest(context, itemIndex, 'GET', '/v3/users'), collectionKey: 'users' };
		if (operation === 'invite') return baseRequest(context, itemIndex, 'POST', '/v3/users', {
			email: parameter(context, 'email', itemIndex),
			name: parameter(context, 'name', itemIndex),
			role: parameter(context, 'role', itemIndex),
		});
		const userId = identifier(context, itemIndex, 'userId');
		if (operation === 'get') return baseRequest(context, itemIndex, 'GET', `/v3/users/${userId}`);
		if (operation === 'remove') return baseRequest(context, itemIndex, 'DELETE', `/v3/users/${userId}`, {});
		if (operation === 'updateRole') return baseRequest(context, itemIndex, 'PATCH', `/v3/users/${userId}`, { role: parameter(context, 'role', itemIndex) });
	}

	if (resource === 'webhook') {
		if (operation === 'getEventTypes') return baseRequest(context, itemIndex, 'GET', '/v3/webhooks/event-types');
		if (operation === 'getMany') return { ...baseRequest(context, itemIndex, 'GET', '/v3/webhooks'), query: filters(context, itemIndex), collectionKey: 'webhooks', paginated: true };
		if (operation === 'create') return baseRequest(context, itemIndex, 'POST', '/v3/webhooks', webhookBody(context, itemIndex));
		const webhookId = identifier(context, itemIndex, 'webhookId');
		if (operation === 'delete') {
			const request = baseRequest(context, itemIndex, 'DELETE', `/v3/webhooks/${webhookId}`);
			request.body = undefined;
			request.idempotencyKey = undefined;
			return request;
		}
		if (operation === 'get') return baseRequest(context, itemIndex, 'GET', `/v3/webhooks/${webhookId}`);
		if (operation === 'getEvents') return { ...baseRequest(context, itemIndex, 'GET', `/v3/webhooks/${webhookId}/events`), query: filters(context, itemIndex), collectionKey: 'events', paginated: true };
		if (operation === 'rotateSecret') return baseRequest(context, itemIndex, 'POST', `/v3/webhooks/${webhookId}/rotate-secret`, {});
		if (operation === 'test') return baseRequest(context, itemIndex, 'POST', `/v3/webhooks/${webhookId}/test`, { event_type: parameter(context, 'eventType', itemIndex) });
		if (operation === 'toggleStatus') return baseRequest(context, itemIndex, 'PATCH', `/v3/webhooks/${webhookId}/toggle-status`, { is_active: context.getNodeParameter('isActive', itemIndex) as boolean });
		if (operation === 'update') return baseRequest(context, itemIndex, 'PUT', `/v3/webhooks/${webhookId}`, webhookBody(context, itemIndex));
	}

	throw new NodeOperationError(context.getNode(), `Unsupported Sent operation: ${resource}.${operation}`, { itemIndex });
}

function webhookBody(context: IExecuteFunctions, itemIndex: number): IDataObject {
	return compactObject({
		display_name: parameter(context, 'displayName', itemIndex),
		endpoint_url: parameter(context, 'endpointUrl', itemIndex),
		event_types: context.getNodeParameter('eventTypes', itemIndex, ['message']) as string[],
		event_filters: jsonParameter(context, 'eventFiltersJson', itemIndex, 'Event Filters JSON'),
		retry_count: context.getNodeParameter('retryCount', itemIndex, 3) as number,
		timeout_seconds: context.getNodeParameter('timeoutSeconds', itemIndex, 30) as number,
	});
}
