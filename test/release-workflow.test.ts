import { describe, expect, it } from 'vitest';

// Vite's raw import keeps this guard compatible with the n8n Cloud lint rules, which ban
// filesystem access even in tests.
import publishWorkflow from '../.github/workflows/publish.yml?raw';
import packageJsonSource from '../package.json?raw';

const packageJson = JSON.parse(packageJsonSource) as {
	'release-it'?: { git?: { tagName?: string } };
};

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

	// `n8n-node release` shells out to release-it without a `--git.tagName` flag, so release-it's
	// own default of `v${version}` applies unless package.json overrides it. That default still
	// matches the `'*.*.*'` trigger glob — `*` matches the leading `v0` — so the workflow starts
	// and then fails the gate below, because the gate compares GITHUB_REF_NAME to the bare
	// version. The two sides must agree, and only this test checks that they do.
	it('tags releases with the bare version the publish gate compares against', () => {
		expect(publishWorkflow).toContain('"$package_version" != "$GITHUB_REF_NAME"');
		expect(publishWorkflow).not.toMatch(/GITHUB_REF_NAME[^\n]*#v|\$\{GITHUB_REF_NAME#v\}/);

		expect(packageJson['release-it']?.git?.tagName).toBe('${version}');
	});
});
