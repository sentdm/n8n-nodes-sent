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
	itemIndex?: number;
}

export interface SentHttpResponse {
	body: unknown;
	headers: Record<string, string | string[] | undefined>;
	statusCode: number;
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

export interface SentWebhook extends IDataObject {
	id?: string;
	display_name?: string;
	endpoint_url?: string;
	signing_secret?: string | null;
	is_active?: boolean;
	event_types?: string[];
}

