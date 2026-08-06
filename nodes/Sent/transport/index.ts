import type {
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	IDataObject,
	INode,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import type { SentEnvelope, SentHttpResponse, SentListData, SentRequestOptions } from '../types';

export const SENT_API_BASE_URL = 'https://api.sent.dm';

type SentFunctions = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions | IWebhookFunctions;

function isObject(value: unknown): value is IDataObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asEnvelope(value: unknown): SentEnvelope {
	return isObject(value) ? (value as SentEnvelope) : {};
}

function headerValue(
	headers: Record<string, string | string[] | undefined>,
	name: string,
): string | undefined {
	const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
	return Array.isArray(value) ? value[0] : value;
}

function redactErrorDetails(value: unknown): unknown {
	if (Array.isArray(value)) return value.map((entry) => redactErrorDetails(entry));
	if (!isObject(value)) return value;
	return Object.fromEntries(
		Object.entries(value).map(([key, entry]) => [
			key,
			/(api.?key|authorization|secret|token|password|phone|recipient|^to$|body|content)/i.test(key)
				? '[REDACTED]'
				: redactErrorDetails(entry),
		]),
	);
}

export function parseJsonInput(value: unknown, fieldName: string, node: INode): IDataObject {
	// An expression such as `={{ $json.vars }}` resolves to a real object, not to JSON
	// text, so a JSON field is not guaranteed to arrive as a string.
	if (isObject(value)) return value;
	if (value === undefined || value === null) return {};

	let parsed: unknown = value;
	if (typeof value === 'string') {
		if (!value.trim()) return {};
		try {
			parsed = JSON.parse(value);
		} catch (error) {
			throw new NodeOperationError(node, error as Error, {
				message: `${fieldName} is not valid JSON`,
			});
		}
	}

	// Deliberately outside the try: a wrong shape is not a parse failure, and reporting
	// it as one hides the actual problem from the user.
	if (!isObject(parsed)) {
		throw new NodeOperationError(node, `${fieldName} must contain a JSON object`);
	}
	return parsed;
}

// Classifies a transport-level failure into the error the node should surface. Returning
// rather than throwing keeps `sentApiRequest` readable and makes the two cases explicit.
function asTransportError(node: INode, error: unknown, itemIndex?: number): Error {
	// n8n raises its own typed errors from httpRequestWithAuthentication — a missing
	// credential, for example. Those already carry the right message and context, so
	// relabelling them as a network failure would hide the real cause.
	if (error instanceof NodeApiError || error instanceof NodeOperationError) return error;

	const timedOut = error instanceof Error && /timeout|timed out|ETIMEDOUT/i.test(error.message);
	return new NodeApiError(
		node,
		{
			message: timedOut ? 'Sent API request timed out' : 'Network request failed',
			name: timedOut ? 'SentTimeoutError' : 'SentNetworkError',
		},
		{
			itemIndex,
			message: timedOut ? 'Sent API request timed out' : 'Sent API request failed',
			description: timedOut
				? 'The request exceeded its configured timeout. Confirm service health before retrying a mutation.'
				: 'Check network connectivity and the Sent service status, then try again.',
		},
	);
}

export function compactObject(value: IDataObject): IDataObject {
	return Object.fromEntries(
		Object.entries(value).filter(([, entry]) => entry !== '' && entry !== undefined),
	);
}

export async function sentApiRequest(
	this: SentFunctions,
	request: SentRequestOptions,
): Promise<SentEnvelope> {
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (request.idempotencyKey) headers['Idempotency-Key'] = request.idempotencyKey;

	const options: IHttpRequestOptions = {
		method: request.method,
		url: `${SENT_API_BASE_URL}${request.path}`,
		headers,
		qs: request.query,
		body: request.body,
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};

	let response: SentHttpResponse;
	try {
		// Keep the credential's declarative authentication for the required API key (the
		// verified-node linter requires it), and add this optional header only when a parent
		// organization explicitly selects a child profile. Sending an empty x-profile-id can
		// change API validation semantics, so it must be omitted rather than rendered as ''.
		if (typeof this.getCredentials === 'function') {
			const credentials = await this.getCredentials<{ profileId?: unknown }>(
				'sentApi',
				request.itemIndex,
			);
			const profileId =
				typeof credentials.profileId === 'string' ? credentials.profileId.trim() : '';
			if (profileId) headers['x-profile-id'] = profileId;
		}
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'sentApi',
			options,
		)) as SentHttpResponse;
	} catch (error) {
		throw asTransportError(this.getNode(), error, request.itemIndex);
	}

	if (response.statusCode === 204) {
		return { success: true, data: { deleted: true } };
	}

	const envelope = asEnvelope(response.body);
	if (response.statusCode >= 400 || envelope.success === false) {
		const sentError = envelope.error;
		const requestId =
			envelope.meta?.request_id ?? headerValue(response.headers, 'x-request-id') ?? 'not provided';
		const retryAfter = headerValue(response.headers, 'retry-after');
		const safeMessage = sentError?.message ?? `Sent API returned HTTP ${response.statusCode}`;
		const details = sentError?.details
			? ` Details: ${JSON.stringify(redactErrorDetails(sentError.details))}.`
			: '';
		const retry = retryAfter ? ` Retry-After: ${retryAfter}.` : '';
		const documentation = sentError?.doc_url ? ` Documentation: ${sentError.doc_url}.` : '';

		throw new NodeApiError(
			this.getNode(),
			{
				message: safeMessage,
				name: sentError?.code ?? 'SentApiError',
				httpCode: String(response.statusCode),
				description: `Request ID: ${requestId}.${details}${retry}${documentation}`,
			},
			{
				itemIndex: request.itemIndex,
				message: sentError?.code ? `${sentError.code}: ${safeMessage}` : safeMessage,
				description: `HTTP ${response.statusCode}. Request ID: ${requestId}.${details}${retry}${documentation}`,
				httpCode: String(response.statusCode),
			},
		);
	}

	return envelope;
}

export async function sentApiRequestAllItems(
	this: SentFunctions,
	request: Omit<SentRequestOptions, 'query'> & { query?: IDataObject },
	collectionKey: string,
	returnAll: boolean,
	limit: number,
): Promise<IDataObject[]> {
	const output: IDataObject[] = [];
	// Sent paginates by page number, so page_size has to stay constant for the whole
	// run: shrinking it between requests redefines the offset `page` points at and
	// re-fetches rows already returned. Over-fetching is discarded by the slices below.
	const pageSize = returnAll ? 100 : Math.min(100, Math.max(1, limit));
	let page = 1;

	do {
		const envelope = await sentApiRequest.call(this, {
			...request,
			query: { ...request.query, page, page_size: pageSize },
		});
		const data = isObject(envelope.data) ? (envelope.data as SentListData) : {};
		const records = Array.isArray(data[collectionKey])
			? (data[collectionKey] as IDataObject[])
			: [];
		output.push(...records);

		if (!returnAll && output.length >= limit) return output.slice(0, limit);
		if (!data.pagination?.has_more || records.length === 0) break;
		page += 1;
		if (page > 10_000) {
			throw new NodeOperationError(this.getNode(), 'Sent pagination exceeded the safety limit');
		}
	} while (returnAll || output.length < limit);

	return returnAll ? output : output.slice(0, limit);
}

export function unwrapEnvelope(envelope: SentEnvelope): IDataObject[] {
	const data = envelope.data;
	if (Array.isArray(data)) return data;
	if (!isObject(data)) return [{ success: envelope.success ?? true, _meta: envelope.meta ?? {} }];
	return [{ ...data, _meta: envelope.meta ?? {} }];
}
