# Human publication and Creator Portal checklist

Do these steps in order. They require account ownership and authorization, and cannot be performed from inside this repository.

## 1. Confirm identities and ownership

- [ ] Confirm control of the `sentdm` GitHub organization and authorization to publish this integration there.
- [ ] Confirm the exact repository name `n8n-nodes-sent`.
- [ ] Confirm control of the `@sentdm` npm scope and permission to publish `@sentdm/n8n-nodes-sent` publicly.
- [x] MIT license holder is Sent.dm, matching `LICENSE.md`.
- [x] Support, security, and Code of Conduct contact is `support@sent.dm` across README, `SECURITY.md`, and `CODE_OF_CONDUCT.md`.
- [x] Icons are the Sent chevron mark, square (`viewBox="0 0 64 64"`), in light and dark variants, on both nodes and the credential.

## 2. Make source public

- [ ] Create or transfer the repository to `https://github.com/sentdm/n8n-nodes-sent`.
- [ ] Make it public and confirm the URL opens in a private browser without authentication.

  This is **required before publishing**, not after. The n8n community scanner fetches attested source through npm provenance to `codeload.github.com` and hard-fails when that URL is unreachable.
- [ ] Push the reviewed `main` branch.
- [ ] Enable GitHub Actions and required branch protections.
- [ ] Confirm `repository`, `homepage`, `bugs`, and `author` in `package.json` point to that exact repository and identity.

## 3. Bootstrap npm, then hand publishing to OIDC

`.github/workflows/publish.yml` is OIDC-only and has no `NPM_TOKEN`. npm can attach a Trusted Publisher **only to a package that already exists** ([npm/cli#8544](https://github.com/npm/cli/issues/8544)), so the first publish cannot come from the workflow. Do these four in order.

- [ ] **Publish a `0.0.0` placeholder from an authorized maintainer machine** so the package name exists. `publish.yml` gates on the tag matching `package.json`'s version, not on the package being new, so this placeholder does not block the real release.
- [ ] In npm package settings, set access to **public**.
- [ ] Add a Trusted Publisher: provider **GitHub Actions**, owner **sentdm**, repository **n8n-nodes-sent**, workflow **publish.yml**, environment blank unless the workflow is updated to use one.
- [ ] Confirm no long-lived `NPM_TOKEN` secret exists on the repository.

## 4. Release through GitHub Actions

- [ ] Run every command in `docs/verification/verification-readiness.md` on a clean checkout and confirm the recorded results still hold.
- [ ] Ensure `git status --short` is empty.
- [ ] Confirm `CHANGELOG.md` describes the version being released.
- [ ] Run `npm run release` as an authorized maintainer to create the version commit and tag, using the documented non-`v` tag format (for example `0.1.0`).
- [ ] Push the release commit and tag.
- [ ] Confirm the **Publish** workflow run succeeded; do not publish from a pull request or a local uncommitted tree.
- [ ] Confirm the npm version exactly matches `package.json` and the Git tag.
- [ ] Confirm npm shows provenance linking to the exact public workflow, repository, commit, and tag: `npm view @sentdm/n8n-nodes-sent dist.attestations`.
- [ ] Confirm `npm view @sentdm/n8n-nodes-sent repository version --json` returns the exact metadata.
- [ ] Run the scanner against the published version and save the passing output. Run **both** `npx --yes @n8n/scan-community-package@0.31.0 @sentdm/n8n-nodes-sent@<version>` and the same command with `@beta`; the Portal has been observed running a build ahead of `latest`.
- [ ] Re-check the scanner's current version and behavior immediately before running it. The 0.31.0 CLI has no functional `--help` and treats its positional argument as an npm package name, so a typo returns an npm 404 rather than a usage error.

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
