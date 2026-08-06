import type { IDataObject } from 'n8n-workflow';

export interface SentTriggerStaticData extends IDataObject {
	webhookId?: string;
	signingSecret?: string;
	webhookCreationGeneration?: string;
	/** Legacy fields cleared during lifecycle handling; deterministic creation no longer relies on them. */
	webhookCreationIdempotencyKey?: string;
	webhookCreationFingerprint?: string;
}

export interface SentIncomingEvent extends IDataObject {
	field?: string;
	sub_type?: string;
	/** Compatibility with early Sent payload examples; current deliveries use `sub_type`. */
	event?: string;
	timestamp?: string;
	payload?: IDataObject;
}
