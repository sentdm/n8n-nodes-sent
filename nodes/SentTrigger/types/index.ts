import type { IDataObject } from 'n8n-workflow';

export interface SentTriggerStaticData extends IDataObject {
	webhookId?: string;
	signingSecret?: string;
}

export interface SentIncomingEvent extends IDataObject {
	field?: string;
	event?: string;
	timestamp?: string;
	payload?: IDataObject;
}
