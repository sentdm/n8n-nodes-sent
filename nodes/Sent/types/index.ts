import type { IDataObject } from 'n8n-workflow';

export interface SentMeta extends IDataObject {
	request_id?: string;
	timestamp?: string;
	version?: string;
}

export interface SentError extends IDataObject {
	code?: string;
	message?: string;
	details?: IDataObject | string[] | null;
	doc_url?: string;
}

export interface SentEnvelope<T extends IDataObject | IDataObject[] = IDataObject> extends IDataObject {
	success?: boolean;
	data?: T | null;
	error?: SentError | null;
	meta?: SentMeta;
}

export interface SentPagination extends IDataObject {
	page?: number;
	page_size?: number;
	total_count?: number;
	total_pages?: number;
	has_more?: boolean;
	cursors?: IDataObject | null;
}

export interface SentListData extends IDataObject {
	pagination?: SentPagination;
}

export interface SentRequestOptions {
	method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
	path: string;
	query?: IDataObject;
	body?: IDataObject;
	idempotencyKey?: string;
	profileId?: string;
	itemIndex?: number;
}

export interface SentHttpResponse {
	body: unknown;
	headers: Record<string, string | string[] | undefined>;
	statusCode: number;
}

export interface SentAccount extends IDataObject {
	id?: string;
	name?: string;
	type?: 'organization' | 'profile' | 'user';
}

export interface SentMessage extends IDataObject {
	id?: string;
	message_id?: string;
	status?: string;
	channel?: string;
	to?: string;
}

export interface SentTemplateReference extends IDataObject {
	id?: string;
	name?: string;
	parameters?: IDataObject;
}

export interface SentMessageRequest extends IDataObject {
	to: string[];
	channel?: string[];
	template?: SentTemplateReference;
	text?: string;
	sandbox?: boolean;
}

export interface SentContact extends IDataObject {
	id?: string;
	phone_number?: string;
	default_channel?: string;
	opt_out?: boolean;
}

export interface SentTemplate extends IDataObject {
	id?: string;
	name?: string;
	category?: string;
	status?: string;
}

export interface SentProfile extends IDataObject {
	id?: string;
	name?: string;
	short_name?: string;
	status?: string;
}

export interface SentCampaign extends IDataObject {
	id?: string;
	name?: string;
	status?: string;
}

export interface SentUser extends IDataObject {
	id?: string;
	email?: string;
	name?: string;
	role?: string;
}

export interface SentWebhook extends IDataObject {
	id?: string;
	display_name?: string;
	endpoint_url?: string;
	signing_secret?: string | null;
	is_active?: boolean;
	event_types?: string[];
}

export interface SentWebhookEvent extends IDataObject {
	field?: string;
	event?: string;
	timestamp?: string;
	payload?: IDataObject;
}

export interface SentNumberLookup extends IDataObject {
	phone_number?: string;
	valid?: boolean;
	line_type?: string;
	carrier?: string;
}
