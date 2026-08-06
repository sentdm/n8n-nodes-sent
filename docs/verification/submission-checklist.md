# Human publication and Creator Portal checklist

Do these steps in order. They require account ownership and authorization, and cannot be performed from inside this repository.

## 1. Confirm identities and ownership

- [ ] Confirm control of the `sentdm` GitHub organization and authorization to publish this integration there.
- [ ] Confirm the exact repository name `n8n-nodes-sent`.
- [ ] Confirm control of the `@sentdm` npm scope and permission to publish `@sentdm/n8n-nodes-sent` publicly.
- [x] MIT license holder is Sent.dm, matching `LICENSE.md`.
- [x] Support, security, and Code of Conduct contact is `support@sent.dm` across README, `SECURITY.md`, and `CODE_OF_CONDUCT.md`.
- [x] Icons are the supplied Sent chevron mark, square (`viewBox="0 0 24 24"`), in both theme variants, on both nodes and the credential.

## 2. Make source public

- [ ] Create or transfer the repository to `https://github.com/sentdm/n8n-nodes-sent`.
- [ ] Make it public and confirm the URL opens in a private browser without authentication.

  This is **required before publishing**, not after. The n8n community scanner fetches attested source through npm provenance to `codeload.github.com` and hard-fails when that URL is unreachable.
- [ ] Push the reviewed `main` branch.
- [ ] Enable GitHub Actions and required branch protections.
- [ ] Confirm `repository`, `homepage`, `bugs`, and `author` in `package.json` point to that exact repository and identity.

## 3. Prepare a provenance-compliant first release

[npm can attach a Trusted Publisher only after the package exists](https://docs.npmjs.com/cli/v11/commands/npm-trust/). Do not solve that bootstrap constraint with a local or placeholder publish: [n8n requires every community-node publish from 1 May 2026 onward to come from GitHub Actions with npm provenance](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines/). The repository's `publish.yml` follows the official n8n starter's optional token fallback so the first real version can still meet that requirement.

- [ ] Run every command in `docs/verification/verification-readiness.md` on a clean checkout and confirm the recorded results still hold.
- [ ] Ensure `git status --short` is empty.
- [ ] Confirm `CHANGELOG.md` describes the version being released.
- [ ] Complete the live Sent and n8n checks still marked pending in `verification-readiness.md`; mocked tests are not a substitute for these checks.
- [ ] Create a short-lived npm **Granular Access Token** with read/write permission, bypass 2FA enabled, and access limited as narrowly as npm permits to the `@sentdm` scope. Use the shortest practical expiry because the individual package does not exist yet.
- [ ] Store it temporarily as the GitHub Actions repository secret `NPM_TOKEN`. Do not place it in a local `.npmrc`, source file, release artifact, or log.

## 4. Publish through GitHub Actions, then hand publishing to OIDC

- [ ] Push the reviewed release commit to `main`, then create and push the exact non-`v` tag that matches `package.json`. This repository already has version/changelog metadata prepared for `0.1.0`, so an authorized maintainer should tag that release commit directly (`git tag -a 0.1.0 -m 'Release 0.1.0'`, then `git push origin 0.1.0`). For later version bumps, `npm run release` creates and pushes the release metadata. In both cases, the tag-triggered GitHub workflow performs the actual npm publish.
- [ ] Confirm the **Publish** workflow ran from the public `sentdm/n8n-nodes-sent` repository and succeeded. It must publish the scoped package with public access and provenance; never run `npm publish` locally.
- [ ] Confirm the npm version exactly matches `package.json` and the Git tag.
- [ ] Confirm npm shows provenance linking to the exact public workflow, repository, commit, and tag: `npm view @sentdm/n8n-nodes-sent dist.attestations`.
- [ ] Confirm `npm view @sentdm/n8n-nodes-sent repository version --json` returns the exact metadata.
- [ ] In npm package settings, add a Trusted Publisher: provider **GitHub Actions**, owner **sentdm**, repository **n8n-nodes-sent**, workflow **publish.yml**, environment blank, allowed action **npm publish**.
- [ ] Delete the GitHub `NPM_TOKEN` secret, revoke the Granular Access Token on npm, and confirm neither remains usable. Future releases must take the workflow's OIDC path.
- [ ] After OIDC is configured, set npm publishing access to disallow traditional tokens if the package settings offer that control; Trusted Publishing continues to work.
- [ ] Re-check scanner dist-tags immediately before submission with `npm view @n8n/scan-community-package dist-tags --json`. On 2026-08-06, `latest` and `beta` both resolved to 0.31.0 while `stable` resolved to 0.29.1; do not assume those tags remain unchanged.
- [ ] Run the scanner against the exact published version and save the passing output. Run the workflow-pinned command `npx --yes @n8n/scan-community-package@0.31.0 '@sentdm/n8n-nodes-sent@<version>'`, then repeat with the current `@latest` and `@beta` when either resolves to a different build. The workflow must keep a deterministic pin rather than attempting to work around unpublished-package or scanner behavior.

## 5. Verify public evidence

- [ ] Open the GitHub repository, npm package, README links, issues URL, Sent API docs, and credential docs without authentication.
- [ ] Confirm none returns 404.
- [ ] Confirm the npm tarball contains no secrets and no unnecessary development files.
- [ ] Save links or screenshots for the successful publish run, npm provenance, package version, Git tag, and scanner output.

## 6. Creator Portal

- [ ] Sign in to [Creator Portal → Nodes](https://creators.n8n.io/nodes).
- [ ] Choose **Submit node package**.
- [ ] Enter the exact published npm name: `@sentdm/n8n-nodes-sent`.
- [ ] Complete every authenticated form field from the published, public evidence; do not guess at fields that differ from this checklist.
- [ ] Provide repository, npm, documentation, API and credential docs, operations, support, maintainer, security, provenance, tag/version, and scanner information where the live form asks for it.
- [ ] Confirm every URL is public before submitting.
- [ ] Submit only after an authorized human reviews the information and accepts any portal attestations.
- [ ] Record the submission identifier and respond to n8n review feedback.

Only n8n can approve the application and grant verified status.
