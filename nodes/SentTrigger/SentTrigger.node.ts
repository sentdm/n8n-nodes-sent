import { createHash, randomUUID } from 'node:crypto';

import type {
	IHookFunctions,
	IDataObject,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { sentApiRequest } from '../Sent/transport';
import type { SentWebhook } from '../Sent/types';
import {
	deriveEventIdempotencyKey,
	isPublicWebhookUrl,
	isValidSentSigningSecret,
	verifySentSignature,
} from './helpers/signature';
import type { SentIncomingEvent, SentTriggerStaticData } from './types';

const WEBHOOK_DISPLAY_NAME = 'n8n Sent Trigger';

interface WebhookConfiguration extends IDataObject {
	display_name: string;
	endpoint_url: string;
	event_types: string[];
	event_filters: Record<string, string[]>;
	retry_count: number;
	timeout_seconds: number;
}

interface RemoteWebhook extends SentWebhook {
	event_filters?: Record<string, string[]> | null;
	retry_count?: number;
	timeout_seconds?: number;
}

const fallbackMessageSubtypes = [
	'blocked',
	'delivered',
	'failed',
	'filtered',
	'queued',
	'read',
	'received',
	'routed',
	'scheduled',
	'sent',
];

function isNotFound(error: unknown): boolean {
	return (
		String((error as { httpCode?: string }).httpCode ?? '').includes('404') ||
		(error instanceof Error && error.message.includes('404'))
	);
}

function statusCodeFromError(error: unknown): number | undefined {
	const value = Number((error as { httpCode?: string }).httpCode);
	if (Number.isInteger(value)) return value;
	if (error instanceof Error) {
		const match = /\b([45]\d{2})\b/.exec(error.message);
		if (match) return Number(match[1]);
	}
	return undefined;
}

function isAuthorizationError(error: unknown): boolean {
	const statusCode = statusCodeFromError(error);
	return statusCode === 401 || statusCode === 403;
}

function isTransientError(error: unknown): boolean {
	const statusCode = statusCodeFromError(error);
	return (
		statusCode === undefined ||
		statusCode === 408 ||
		statusCode === 429 ||
		statusCode >= 500
	);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedInteger(
	context: IHookFunctions,
	value: unknown,
	displayName: string,
	defaultValue: number,
	minimum: number,
	maximum: number,
): number {
	const candidate = value === undefined ? defaultValue : Number(value);
	if (!Number.isInteger(candidate) || candidate < minimum || candidate > maximum) {
		throw new NodeOperationError(
			context.getNode(),
			`'${displayName}' must be an integer from ${minimum} to ${maximum}`,
		);
	}
	return candidate;
}

function stringList(
	context: IHookFunctions,
	value: unknown,
	displayName: string,
	required: boolean,
): string[] {
	if (
		!Array.isArray(value) ||
		value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)
	) {
		throw new NodeOperationError(context.getNode(), `'${displayName}' must contain valid values`);
	}
	const normalized = [...new Set(value.map((entry) => String(entry).trim()))].sort();
	if (required && normalized.length === 0) {
		throw new NodeOperationError(context.getNode(), `'${displayName}' must contain at least one value`);
	}
	return normalized;
}

function desiredWebhookConfiguration(context: IHookFunctions): WebhookConfiguration {
	const webhookUrl = context.getNodeWebhookUrl('default');
	if (!webhookUrl || !isPublicWebhookUrl(webhookUrl)) {
		throw new NodeOperationError(
			context.getNode(),
			'Sent requires a public HTTPS webhook URL. Use an n8n production URL or a secure tunnel.',
		);
	}

	const eventTypes = stringList(
		context,
		context.getNodeParameter('eventTypes', ['message']),
		'Event Categories',
		true,
	);
	const messageSubtypes = stringList(
		context,
		context.getNodeParameter('messageSubtypes', []),
		'Message Subtype Names or IDs',
		false,
	);
	const rawOptionsValue: unknown = context.getNodeParameter('options', {});
	if (!isObject(rawOptionsValue)) {
		throw new NodeOperationError(context.getNode(), "'Options' must contain valid values");
	}
	const rawOptions = rawOptionsValue;
	const eventFilters: Record<string, string[]> = {};
	if (messageSubtypes.length > 0) eventFilters.message = messageSubtypes;

	return {
		display_name: WEBHOOK_DISPLAY_NAME,
		endpoint_url: webhookUrl,
		event_types: eventTypes,
		event_filters: eventFilters,
		retry_count: boundedInteger(
			context,
			rawOptions.retryCount,
			'Retry Count',
			3,
			1,
			5,
		),
		timeout_seconds: boundedInteger(
			context,
			rawOptions.timeoutSeconds,
			'Timeout Seconds',
			30,
			5,
			120,
		),
	};
}

function normalizedStringList(value: unknown): string[] | undefined {
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) return undefined;
	return [...new Set(value)].sort();
}

function normalizedFilters(value: unknown): Record<string, string[]> | undefined {
	if (value === null || value === undefined) return {};
	if (!isObject(value)) return undefined;
	const result: Record<string, string[]> = {};
	for (const [key, entries] of Object.entries(value)) {
		const normalized = normalizedStringList(entries);
		if (!normalized) return undefined;
		if (normalized.length > 0) result[key] = normalized;
	}
	return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function webhookConfigurationMatches(
	remote: RemoteWebhook,
	desired: WebhookConfiguration,
): boolean {
	return (
		remote.display_name === desired.display_name &&
		remote.endpoint_url === desired.endpoint_url &&
		JSON.stringify(normalizedStringList(remote.event_types)) ===
			JSON.stringify(normalizedStringList(desired.event_types)) &&
		JSON.stringify(normalizedFilters(remote.event_filters)) ===
			JSON.stringify(normalizedFilters(desired.event_filters)) &&
		remote.retry_count === desired.retry_count &&
		remote.timeout_seconds === desired.timeout_seconds
	);
}

function configurationFingerprint(configuration: WebhookConfiguration): string {
	return createHash('sha256').update(JSON.stringify(configuration)).digest('hex');
}

function mutationIdempotencyKey(prefix: string, value: unknown): string {
	const digest = createHash('sha256').update(JSON.stringify(value)).digest('hex');
	return `n8n_webhook_${prefix}_${digest}`;
}

function clearRegistration(data: SentTriggerStaticData, clearCreationAttempt = false): void {
	delete data.webhookId;
	delete data.signingSecret;
	if (clearCreationAttempt) {
		delete data.webhookCreationIdempotencyKey;
		delete data.webhookCreationFingerprint;
	}
}

function invalidEnvelopeResponse(
	context: IWebhookFunctions,
	message: string,
): IWebhookResponseData {
	const response = context.getResponseObject();
	response.writeHead(400, { 'Content-Type': 'application/json' });
	response.end(JSON.stringify({ message }));
	return { noWebhookResponse: true };
}

function staticData(context: IHookFunctions | IWebhookFunctions): SentTriggerStaticData {
	return context.getWorkflowStaticData('node') as SentTriggerStaticData;
}

export class SentTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Sent Trigger',
		name: 'sentTrigger',
		icon: {
			// Named by glyph colour, not by theme: n8n's `light`/`dark` keys are the theme the
			// icon renders in, so the dark glyph belongs to the light theme and vice versa.
			light: 'file:../../icons/sent-dark-icon.svg',
			dark: 'file:../../icons/sent-light-icon.svg',
		},
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["eventTypes"].join(", ")}}',
		description: 'Starts a workflow from a verified Sent webhook event',
		defaults: { name: 'Sent Trigger' },
		// A trigger must not be exposed as an AI tool: n8n filters tool candidates on
		// Boolean(usableAsTool) with no trigger guard, and the type forbids `false`.
		usableAsTool: undefined,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'sentApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event Categories',
				name: 'eventTypes',
				type: 'multiOptions',
				options: [{ name: 'Message', value: 'message' }],
				default: ['message'],
				required: true,
				description: 'Parent categories to register with Sent',
			},
			{
				displayName: 'Message Subtype Names or IDs',
				name: 'messageSubtypes',
				type: 'multiOptions',
				typeOptions: { loadOptionsMethod: 'getMessageSubtypes' },
				default: [],
				displayOptions: { show: { eventTypes: ['message'] } },
				description:
					'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Retry Count',
						name: 'retryCount',
						type: 'number',
						typeOptions: { minValue: 1, maxValue: 5 },
						default: 3,
						description: 'Number of Sent delivery attempts per event',
					},
					{
						displayName: 'Timeout Seconds',
						name: 'timeoutSeconds',
						type: 'number',
						typeOptions: { minValue: 5, maxValue: 120 },
						default: 30,
						description: 'Maximum time Sent waits for the webhook response',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getMessageSubtypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const envelope = await sentApiRequest.call(this, {
						method: 'GET',
						path: '/v3/webhooks/event-types',
					});
					const data = envelope.data as
						| { event_types?: Array<{ name?: string; display_name?: string; is_active?: boolean }> }
						| undefined;
					const eventTypes = data?.event_types ?? [];
					const activeMessageTypes = eventTypes.filter(
						(item) => item.is_active !== false && item.name?.startsWith('message.'),
					);
					if (activeMessageTypes.length > 0) {
						return activeMessageTypes.map((item) => ({
							name: item.display_name ?? item.name ?? 'Message Event',
							value: String(item.name).replace(/^message\./, ''),
						}));
					}
				} catch (error) {
					if (
						error instanceof NodeOperationError ||
						isAuthorizationError(error) ||
						!isTransientError(error)
					) {
						throw new NodeOperationError(this.getNode(), error as Error);
					}
					// The documented static fallback keeps activation usable during a temporary API outage.
				}
				return fallbackMessageSubtypes.map((value) => ({
					name: value.charAt(0).toUpperCase() + value.slice(1),
					value,
				}));
			},
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = staticData(this);
				if (!data.webhookId) {
					delete data.signingSecret;
					return false;
				}
				const webhookId = data.webhookId;
				const desired = desiredWebhookConfiguration(this);
				try {
					const envelope = await sentApiRequest.call(this, {
						method: 'GET',
						path: `/v3/webhooks/${encodeURIComponent(webhookId)}`,
					});
					const remote = envelope.data as RemoteWebhook | undefined;
					if (!remote || remote.id !== webhookId) {
						throw new NodeOperationError(
							this.getNode(),
							'Sent returned an incomplete webhook configuration',
						);
					}

					if (!isValidSentSigningSecret(data.signingSecret)) {
						await sentApiRequest.call(this, {
							method: 'DELETE',
							path: `/v3/webhooks/${encodeURIComponent(webhookId)}`,
							idempotencyKey: mutationIdempotencyKey('delete', webhookId),
						});
						clearRegistration(data, true);
						return false;
					}

					if (!webhookConfigurationMatches(remote, desired)) {
						await sentApiRequest.call(this, {
							method: 'PUT',
							path: `/v3/webhooks/${encodeURIComponent(webhookId)}`,
							body: desired,
						});
					}

					if (remote.is_active !== true) {
						await sentApiRequest.call(this, {
							method: 'PATCH',
							path: `/v3/webhooks/${encodeURIComponent(webhookId)}/toggle-status`,
							body: { is_active: true },
						});
					}

					delete data.webhookCreationIdempotencyKey;
					delete data.webhookCreationFingerprint;
					return true;
				} catch (error) {
					if (isNotFound(error)) {
						clearRegistration(data, true);
						return false;
					}
					throw new NodeOperationError(this.getNode(), error as Error);
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const desired = desiredWebhookConfiguration(this);
				const data = staticData(this);
				const fingerprint = configurationFingerprint(desired);
				if (
					!data.webhookCreationIdempotencyKey ||
					data.webhookCreationFingerprint !== fingerprint
				) {
					data.webhookCreationIdempotencyKey = `n8n_webhook_create_${randomUUID()}`;
					data.webhookCreationFingerprint = fingerprint;
				}

				const envelope = await sentApiRequest.call(this, {
					method: 'POST',
					path: '/v3/webhooks',
					body: desired,
					idempotencyKey: data.webhookCreationIdempotencyKey,
				});
				const webhook = envelope.data as SentWebhook | undefined;
				if (webhook?.id) data.webhookId = webhook.id;
				if (!webhook?.id || !isValidSentSigningSecret(webhook.signing_secret)) {
					throw new NodeOperationError(
						this.getNode(),
						'Sent did not return a webhook ID and signing secret',
					);
				}
				data.webhookId = webhook.id;
				data.signingSecret = webhook.signing_secret;
				delete data.webhookCreationIdempotencyKey;
				delete data.webhookCreationFingerprint;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const data = staticData(this);
				if (!data.webhookId) {
					clearRegistration(data, true);
					return true;
				}
				const webhookId = data.webhookId;
				try {
					await sentApiRequest.call(this, {
						method: 'DELETE',
						path: `/v3/webhooks/${encodeURIComponent(webhookId)}`,
						idempotencyKey: mutationIdempotencyKey('delete', webhookId),
					});
				} catch (error) {
					if (!isNotFound(error)) {
						throw new NodeOperationError(this.getNode(), error as Error);
					}
				}
				clearRegistration(data, true);
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		if (!request.rawBody) await request.readRawBody();
		const rawBody = Buffer.isBuffer(request.rawBody)
			? request.rawBody
			: Buffer.from(request.rawBody ?? '', 'utf8');
		const headers = request.headers;
		const value = (name: string): string | undefined => {
			const header = headers[name];
			return Array.isArray(header) ? header[0] : header;
		};
		const webhookId = value('x-webhook-id');
		const webhookTimestamp = value('x-webhook-timestamp');
		const webhookEventType = value('x-webhook-event-type');
		const verification = verifySentSignature({
			webhookId,
			timestamp: webhookTimestamp,
			signature: value('x-webhook-signature'),
			rawBody,
			secret: staticData(this).signingSecret,
		});

		if (!verification.valid) {
			const response = this.getResponseObject();
			response.writeHead(401, { 'Content-Type': 'application/json' });
			response.end(JSON.stringify({ error: 'Invalid Sent webhook signature' }));
			return { noWebhookResponse: true };
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(rawBody.toString('utf8'));
		} catch {
			return invalidEnvelopeResponse(this, 'Sent webhook body is not valid JSON');
		}
		if (
			!isObject(parsed) ||
			typeof parsed.field !== 'string' ||
			parsed.field.trim().length === 0 ||
			typeof parsed.timestamp !== 'string' ||
			Number.isNaN(Date.parse(parsed.timestamp)) ||
			!isObject(parsed.payload) ||
			(parsed.event !== undefined &&
				(typeof parsed.event !== 'string' || parsed.event.trim().length === 0))
		) {
			return invalidEnvelopeResponse(this, 'Sent webhook body has an invalid event envelope');
		}
		const event = parsed as SentIncomingEvent;
		const eventName = event.event ?? webhookEventType ?? event.field;
		if (event.field === 'message' && !eventName?.startsWith('message.')) {
			return invalidEnvelopeResponse(this, 'Sent webhook body has an invalid message event');
		}
		const eventSubtype =
			typeof eventName === 'string' && eventName.includes('.')
				? eventName.split('.').slice(1).join('.')
				: undefined;

		return {
			workflowData: [
				[
					{
						json: {
							field: event.field,
							event: eventName,
							subtype: eventSubtype,
							timestamp: event.timestamp,
							payload: event.payload ?? {},
							webhookId,
							webhookTimestamp,
							headers: {
								'x-webhook-event-type': webhookEventType,
								'x-webhook-id': webhookId,
								'x-webhook-timestamp': webhookTimestamp,
							},
							idempotencyKey: deriveEventIdempotencyKey(event, rawBody),
							rawEvent: event,
						},
					},
				],
			],
		};
	}
}
