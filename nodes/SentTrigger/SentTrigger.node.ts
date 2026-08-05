import type {
	IHookFunctions,
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
	verifySentSignature,
} from './helpers/signature';
import type { SentIncomingEvent, SentTriggerStaticData } from './types';

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
				} catch {
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
				if (!data.webhookId) return false;
				const webhookId = data.webhookId;
				try {
					await sentApiRequest.call(this, {
						method: 'GET',
						path: `/v3/webhooks/${encodeURIComponent(webhookId)}`,
					});
					return true;
				} catch (error) {
					if (isNotFound(error)) {
						delete data.webhookId;
						delete data.signingSecret;
						return false;
					}
					throw new NodeOperationError(this.getNode(), error as Error);
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl || !isPublicWebhookUrl(webhookUrl)) {
					throw new NodeOperationError(
						this.getNode(),
						'Sent requires a public HTTPS webhook URL. Use an n8n production URL or a secure tunnel.',
					);
				}
				const eventTypes = this.getNodeParameter('eventTypes') as string[];
				const messageSubtypes = this.getNodeParameter('messageSubtypes', []) as string[];
				const options = this.getNodeParameter('options', {}) as {
					retryCount?: number;
					timeoutSeconds?: number;
				};
				const eventFilters: Record<string, string[]> = {};
				if (messageSubtypes.length > 0) eventFilters.message = messageSubtypes;

				const envelope = await sentApiRequest.call(this, {
					method: 'POST',
					path: '/v3/webhooks',
					body: {
						display_name: 'n8n Sent Trigger',
						endpoint_url: webhookUrl,
						event_types: eventTypes,
						event_filters: eventFilters,
						retry_count: options.retryCount ?? 3,
						timeout_seconds: options.timeoutSeconds ?? 30,
					},
				});
				const webhook = envelope.data as SentWebhook | undefined;
				if (!webhook?.id || !webhook.signing_secret) {
					throw new NodeOperationError(
						this.getNode(),
						'Sent did not return a webhook ID and signing secret',
					);
				}
				const data = staticData(this);
				data.webhookId = webhook.id;
				data.signingSecret = webhook.signing_secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const data = staticData(this);
				if (!data.webhookId) return true;
				const webhookId = data.webhookId;
				try {
					await sentApiRequest.call(this, {
						method: 'DELETE',
						path: `/v3/webhooks/${encodeURIComponent(webhookId)}`,
					});
				} catch (error) {
					if (!isNotFound(error)) {
						throw new NodeOperationError(this.getNode(), error as Error);
					}
				}
				delete data.webhookId;
				delete data.signingSecret;
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

		let event: SentIncomingEvent;
		try {
			event = JSON.parse(rawBody.toString('utf8')) as SentIncomingEvent;
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error as Error, {
				message: 'Sent webhook body is not valid JSON',
			});
		}
		const eventName = event.event ?? webhookEventType;
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
