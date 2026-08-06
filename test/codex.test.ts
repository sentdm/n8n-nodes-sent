import { describe, expect, it } from 'vitest';

import sentCodex from '../nodes/Sent/Sent.node.json';

// n8n only accepts its published codex category literals. A category can be valid JSON and
// still be rejected during human verification, so keep the integration's intended categories
// exact rather than relying on the build to validate them.
describe('Sent codex metadata', () => {
	it('uses the supported communication and marketing categories', () => {
		expect(sentCodex.categories).toEqual(['Communication', 'Marketing & Content']);
	});
});
