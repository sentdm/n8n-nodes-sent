import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SentApi implements ICredentialType {
	name = 'sentApi';

	displayName = 'Sent API';

	// Named by glyph colour, not by theme: n8n's `light`/`dark` keys are the theme the
	// icon renders in, so the dark glyph belongs to the light theme and vice versa.
	icon = {
		light: 'file:../icons/sent-dark-icon.svg',
		dark: 'file:../icons/sent-light-icon.svg',
	} as const;

	documentationUrl = 'https://docs.sent.dm/reference/api/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'Sent API key used in the x-api-key request header',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.sent.dm',
			url: '/v3/me',
			method: 'GET',
		},
	};
}
