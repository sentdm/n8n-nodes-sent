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

	// `registry-url` on actions/setup-node writes an .npmrc with
	// `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}` and sets NODE_AUTH_TOKEN to the literal
	// placeholder `XXXXX-XXXXX-XXXXX-XXXXX` when no real token is given. npm then believes it has a
	// credential, never attempts OIDC, and the registry rejects the junk token with
	// `404 Not Found - PUT`. It broke the first Trusted Publishing release and was invisible while a
	// bootstrap NPM_TOKEN was overwriting the placeholder, so it must not come back.
	// Assert against the workflow with comment lines removed: the comments deliberately name both
	// `registry-url` and NODE_AUTH_TOKEN to explain why neither is configured, and a raw-text check
	// matches that explanation. This is the same self-matching trap `ci.yml` documents for its grep.
	it('does not let setup-node inject a placeholder npm auth token', () => {
		const directives = publishWorkflow
			.split('\n')
			.filter((line) => !/^\s*#/.test(line))
			.join('\n');

		expect(directives).not.toMatch(/^\s*registry-url:/m);
		expect(directives).not.toContain('NODE_AUTH_TOKEN');
		// The explanation must survive, so the input is not reintroduced by someone reading only YAML.
		expect(publishWorkflow).toContain('Deliberately no `registry-url`');
	});

	// The scanner reads the npm packument, which lags the publish. A bare 404 surfaces as
	// "Analysis failed" and is indistinguishable from a real security failure, so the workflow must
	// wait before scanning. The wait has to check that the packument *lists this version*: on a
	// second release the packument already returns 200 immediately, so a status-code-only check
	// would wait for nothing. Asserting the order matters as much as asserting the poll exists.
	it('waits for the published version to appear in the packument before scanning', () => {
		const waitIndex = publishWorkflow.indexOf('registry.npmjs.org/@sentdm%2Fn8n-nodes-sent');
		const scanIndex = publishWorkflow.indexOf('@n8n/scan-community-package@');

		expect(waitIndex).toBeGreaterThan(-1);
		expect(scanIndex).toBeGreaterThan(-1);
		expect(waitIndex).toBeLessThan(scanIndex);

		// Presence of the version in `versions`, not just a 200, and a bounded retry.
		expect(publishWorkflow).toContain('.versions?.[process.argv[1]]');
		expect(publishWorkflow).toMatch(/for attempt in \$\(seq 1 \d+\); do/);
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
