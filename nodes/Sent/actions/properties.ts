import type { INodeProperties } from 'n8n-workflow';

const resourceOptions = [
	{ name: 'Account', value: 'account' },
	{ name: 'Contact', value: 'contact' },
	{ name: 'Message', value: 'message' },
	// Resource names are nouns; the verb belongs to the operation. "Number Lookup" +
	// "Lookup" also repeated itself, which the UX guidelines forbid.
	{ name: 'Phone Number', value: 'numberLookup' },
];

const operations: Record<
	string,
	Array<{ name: string; value: string; action: string; description: string }>
> = {
	account: [
		{
			name: 'Get',
			value: 'get',
			action: 'Get authenticated account',
			description: 'Retrieve the account the API key belongs to',
		},
	],
	contact: [
		// `name` shows under the Resource selector, so it must not repeat the resource
		// (ux-guidelines "Don't repeat the resource"). `action` shows in the node picker
		// with no resource context, where repeating it is explicitly encouraged.
		{
			name: 'Get',
			value: 'get',
			action: 'Get contact',
			description: 'Retrieve a single contact by ID',
		},
		{
			name: 'Get Many',
			value: 'getMany',
			action: 'Get contacts',
			description: 'Retrieve contacts, optionally filtered by channel, phone or search term',
		},
	],
	message: [
		{
			name: 'Get',
			value: 'get',
			action: 'Get message',
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
			action: 'Send message',
			description: 'Send a text or template message over SMS, WhatsApp or RCS',
		},
	],
	numberLookup: [
		{
			name: 'Lookup',
			value: 'lookup',
			action: 'Look up phone number',
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
		displayName: 'Contact',
		name: 'contactId',
		type: 'resourceLocator',
		required: true,
		default: { mode: 'list', value: '' },
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'getContacts', searchable: true },
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 6ba7b810-9dad-11d1-80b4-00c04fd430c8',
			},
		],
		displayOptions: { show: { resource: ['contact'], operation: ['get'] } },
		description: 'Contact to retrieve',
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

export const SENT_OUTPUT_FIELD_OPTIONS: Record<
	'account' | 'contact' | 'message',
	Array<{ name: string; value: string }>
> = {
	account: [
		{ name: 'Channels', value: 'channels' },
		{ name: 'Created At', value: 'created_at' },
		{ name: 'Description', value: 'description' },
		{ name: 'Email', value: 'email' },
		{ name: 'Icon', value: 'icon' },
		{ name: 'ID', value: 'id' },
		{ name: 'Name', value: 'name' },
		{ name: 'Organization ID', value: 'organization_id' },
		{ name: 'Profiles', value: 'profiles' },
		{ name: 'Request Metadata', value: '_meta' },
		{ name: 'Settings', value: 'settings' },
		{ name: 'Short Name', value: 'short_name' },
		{ name: 'Status', value: 'status' },
		{ name: 'Type', value: 'type' },
	],
	contact: [
		{ name: 'Available Channels', value: 'available_channels' },
		{ name: 'Country Code', value: 'country_code' },
		{ name: 'Created At', value: 'created_at' },
		{ name: 'Default Channel', value: 'default_channel' },
		{ name: 'Format E.164', value: 'format_e164' },
		{ name: 'Format International', value: 'format_international' },
		{ name: 'Format National', value: 'format_national' },
		{ name: 'Format RFC', value: 'format_rfc' },
		{ name: 'ID', value: 'id' },
		{ name: 'Is Inherited', value: 'is_inherited' },
		{ name: 'Opt Out', value: 'opt_out' },
		{ name: 'Phone Number', value: 'phone_number' },
		{ name: 'Region Code', value: 'region_code' },
		{ name: 'Request Metadata', value: '_meta' },
		{ name: 'Updated At', value: 'updated_at' },
	],
	message: [
		{ name: 'Active Contact Price', value: 'active_contact_price' },
		{ name: 'Channel', value: 'channel' },
		{ name: 'Contact ID', value: 'contact_id' },
		{ name: 'Created At', value: 'created_at' },
		{ name: 'Customer ID', value: 'customer_id' },
		{ name: 'Direction', value: 'direction' },
		{ name: 'Events', value: 'events' },
		{ name: 'ID', value: 'id' },
		{ name: 'Message Body', value: 'message_body' },
		{ name: 'Phone', value: 'phone' },
		{ name: 'Phone International', value: 'phone_international' },
		{ name: 'Price', value: 'price' },
		{ name: 'Region Code', value: 'region_code' },
		{ name: 'Request Metadata', value: '_meta' },
		{ name: 'Status', value: 'status' },
		{ name: 'Template Category', value: 'template_category' },
		{ name: 'Template ID', value: 'template_id' },
		{ name: 'Template Name', value: 'template_name' },
	],
};

export const SENT_SIMPLIFIED_OUTPUT_FIELDS: Record<'account' | 'contact' | 'message', string[]> = {
	account: [
		'id',
		'type',
		'name',
		'email',
		'short_name',
		'status',
		'channels',
		'settings',
		'profiles',
		'organization_id',
	],
	contact: [
		'id',
		'phone_number',
		'format_e164',
		'format_international',
		'country_code',
		'region_code',
		'available_channels',
		'default_channel',
		'opt_out',
		'is_inherited',
	],
	message: [
		'id',
		'contact_id',
		'phone',
		'channel',
		'status',
		'direction',
		'template_name',
		'message_body',
		'created_at',
		'events',
	],
};

const outputFields: INodeProperties[] = [
	{
		displayName: 'Output',
		name: 'output',
		type: 'options',
		default: 'simple',
		options: [
			{ name: 'Simplified', value: 'simple' },
			{ name: 'Raw', value: 'raw' },
			{ name: 'Selected Fields', value: 'fields' },
		],
		displayOptions: {
			show: {
				resource: ['account', 'contact', 'message'],
				operation: ['get', 'getMany'],
			},
		},
	},
	...Object.entries(SENT_OUTPUT_FIELD_OPTIONS).map(([resource, options]) => ({
		displayName: 'Fields',
		name: 'fields',
		type: 'multiOptions' as const,
		default: [],
		options,
		description: "The fields to add to the output. 'ID' is always included.",
		displayOptions: {
			show: {
				resource: [resource],
				operation: resource === 'contact' ? ['get', 'getMany'] : ['get'],
				output: ['fields'],
			},
		},
	})),
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
		typeOptions: { minValue: 1, maxValue: Number.MAX_SAFE_INTEGER, numberPrecision: 0 },
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
	...outputFields,
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
		description: 'Comma-separated recipient phone numbers, up to 1,000 per request',
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
			"Choose 'Sent (Automatic Routing)' by itself, or choose explicit channels to broadcast separately on each channel",
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
