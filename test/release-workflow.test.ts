import { describe, expect, it } from 'vitest';

// Vite's raw import keeps this guard compatible with the n8n Cloud lint rules, which ban
// filesystem access even in tests.
import publishWorkflow from '../.github/workflows/publish.yml?raw';

describe('npm publication workflow', () => {
	it('keeps both bootstrap-token and normal OIDC publishes in GitHub Actions with provenance', () => {
		expect(publishWorkflow).toContain('id-token: write');
		expect(publishWorkflow).toContain('NPM_TOKEN: ${{ secrets.NPM_TOKEN }}');
		expect(publishWorkflow).toContain('if [ -n "$NPM_TOKEN" ]; then');
		expect(publishWorkflow).toContain("NPM_CONFIG_PROVENANCE: 'true'");
		expect(publishWorkflow).toContain('NPM_CONFIG_ACCESS: public');
		expect(publishWorkflow).toContain('npm run release');
	});

	it('keeps the post-publish scanner deterministic', () => {
		expect(publishWorkflow).toContain('@n8n/scan-community-package@0.31.0');
	});
});
