import type { INodeProperties } from 'n8n-workflow';

const resourceOptions = [
	{ name: 'Account', value: 'account' },
	{ name: 'Contact', value: 'contact' },
	{ name: 'Message', value: 'message' },
	{ name: 'Number Lookup', value: 'numberLookup' },
];

const operations: Record<
	string,
	Array<{ name: string; value: string; action: string; description: string }>
> = {
	account: [{
			name: 'Get',
			value: 'get',
			action: 'Get authenticated account',
			description: 'Retrieve the account the API key belongs to',
		}],
	contact: [
		// The UX guidelines allow dropping "Many" ("Get Many Rows" can be "Get Rows"), so
		// the two stay distinct operations without the redundant word.
		{
			name: 'Get Contact',
			value: 'get',
			action: 'Get contact',
			description: 'Retrieve a single contact by ID',
		},
		{
			name: 'Get Contacts',
			value: 'getMany',
			action: 'Get contacts',
			description: 'Retrieve contacts, optionally filtered by channel, phone or search term',
		},
	],
	message: [
		{
			name: 'Get',
			value: 'get',
			action: 'Get a message',
			description: 'Retrieve a single message and its current status',
		},
		{
			name: 'Get Activities',
			value: 'getActivities',
			action: 'Get message activities',
			description: 'Retrieve the delivery timeline for a message',
		},
		{
			name: 'Send',
			value: 'send',
			action: 'Send a message',
			description: 'Send text or a template over SMS, WhatsApp or RCS',
		},
	],
	numberLookup: [
		{
			name: 'Lookup',
			value: 'lookup',
			action: 'Look up a phone number',
			description: 'Check whether a phone number is valid and which channels can reach it',
		},
	],
};

const mutationOptions: INodeProperties[] = [
	{
		displayName: 'Idempotency Key',
		name: 'idempotencyKey',
		type: 'string',
		default: '',
		description:
			'1-255 letters, numbers, hyphens, or underscores. Reuse the same key when retrying.',
	},
	{
		displayName: 'Sandbox',
		name: 'sandbox',
		type: 'boolean',
		default: false,
		description:
			'Whether Sent should validate and simulate the send without delivering anything or spending credit',
	},
];

const idFields: INodeProperties[] = [
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['contact'], operation: ['get'] } },
	},
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['get', 'getActivities'] } },
	},
];

const paginationFields: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['contact'],
				operation: ['getMany'],
			},
		},
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: {
			show: {
				resource: ['contact'],
				operation: ['getMany'],
				returnAll: [false],
			},
		},
		description: 'Max number of results to return',
	},
];

export const sentProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: resourceOptions,
		default: 'message',
	},
	...Object.entries(operations).map(([resource, resourceOperations]) => ({
		displayName: 'Operation',
		name: 'operation',
		type: 'options' as const,
		noDataExpression: true,
		options: resourceOperations,
		default: resourceOperations[0].value,
		displayOptions: { show: { resource: [resource] } },
	})),
	...idFields,
	{
		displayName: 'Phone Number',
		name: 'phoneNumber',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. +14155550123',
		displayOptions: { show: { resource: ['numberLookup'], operation: ['lookup'] } },
		description: 'Phone number in an international format accepted by Sent',
	},
	{
		displayName: 'Recipients',
		name: 'recipients',
		type: 'string',
		required: true,
		default: '',
		// Both numbers are reserved for fiction: NANP 555-01xx and Ofcom's 020 7946 0xxx
		// drama range. Never put an allocatable number in a copy-pasteable placeholder.
		placeholder: 'e.g. +14155550123,+442079460123',
		displayOptions: { show: { resource: ['message'], operation: ['send'] } },
		description: 'Comma-separated recipient phone numbers',
	},
	{
		displayName: 'Channels',
		name: 'channels',
		type: 'multiOptions',
		options: [
			{ name: 'Sent (Automatic Routing)', value: 'sent' },
			{ name: 'RCS', value: 'rcs' },
			{ name: 'SMS', value: 'sms' },
			{ name: 'WhatsApp', value: 'whatsapp' },
		],
		default: ['sent'],
		displayOptions: { show: { resource: ['message'], operation: ['send'] } },
		description:
			'Sent uses automatic routing. Several explicit channels create a broadcast, not a fallback order.',
	},
	{
		displayName: 'Message Type',
		name: 'messageType',
		type: 'options',
		options: [
			{ name: 'Template', value: 'template' },
			{ name: 'Text', value: 'text' },
		],
		default: 'template',
		displayOptions: { show: { resource: ['message'], operation: ['send'] } },
	},
	{
		displayName: 'Template',
		name: 'messageTemplate',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'getTemplates', searchable: true },
			},
			{ displayName: 'ID', name: 'id', type: 'string' },
			{ displayName: 'Name', name: 'name', type: 'string' },
		],
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['template'] },
		},
		description: 'Template name or ID to use',
	},
	{
		displayName: 'Template Parameters',
		name: 'templateParameters',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: { resource: ['message'], operation: ['send'], messageType: ['template'] },
		},
		description: 'JSON object whose keys match the template variables',
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['message'], operation: ['send'], messageType: ['text'] } },
	},
	...paginationFields,
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['contact'], operation: ['getMany'] } },
		options: [
			{
				displayName: 'Channel',
				name: 'channel',
				type: 'options',
				options: [
					{ name: 'SMS', value: 'sms' },
					{ name: 'WhatsApp', value: 'whatsapp' },
				],
				default: 'sms',
			},
			{ displayName: 'Phone', name: 'phone', type: 'string', default: '' },
			{ displayName: 'Search', name: 'search', type: 'string', default: '' },
		],
	},
	// Message → Send is the only mutation the node exposes.
	{
		displayName: 'Options',
		name: 'requestOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				operation: ['send'],
			},
		},
		options: mutationOptions,
	},
];
