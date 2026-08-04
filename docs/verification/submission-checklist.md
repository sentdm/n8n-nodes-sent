# Human publication and Creator Portal checklist

Do these steps in order. They require account ownership/authorization and were not performed during repository implementation.

## 1. Confirm identities and ownership

- [ ] Confirm control of the `sentdm` GitHub organization and authorization to publish this integration there.
- [ ] Confirm the exact repository name `n8n-nodes-sent`.
- [ ] Confirm control of the `@sentdm` npm scope and permission to publish `@sentdm/n8n-nodes-sent` publicly.
- [x] Confirm the MIT license holder as Sent.dm, matching the repository's existing license.
- [ ] Confirm the maintainer name/email, support address, security-reporting address, and Code of Conduct enforcement address.
- [ ] Replace placeholder icons with approved Sent SVG assets and review brand usage.

## 2. Make source public

- [ ] Create or transfer the repository to `https://github.com/sentdm/n8n-nodes-sent`.
- [ ] Make it public and confirm the URL opens in a private browser without authentication.
- [ ] Push the reviewed `main` branch.
- [ ] Enable GitHub Actions and required branch protections.
- [ ] Confirm package `repository`, `homepage`, `bugs`, author, and maintainer metadata point to that exact repository/identity.

## 3. Prepare npm and Trusted Publisher

- [ ] If npm requires the scoped package to exist before Trusted Publisher setup, create the initial public package entry using npm's authorized workflow; do not publish a different build manually.
- [ ] In npm package settings, set access to public.
- [ ] Add a Trusted Publisher: provider **GitHub Actions**, owner **sentdm**, repository **n8n-nodes-sent**, workflow **publish.yml**, environment blank unless the workflow is updated to use one.
- [ ] Prefer OIDC; do not add a long-lived `NPM_TOKEN` when Trusted Publisher is available.
- [ ] Reconfirm `.github/workflows/publish.yml` has `id-token: write`, Node 22, quality checks, exact tag/version verification, and provenance publication.

## 4. Release through GitHub Actions

- [ ] Run all checks in `docs/verification/verification-readiness.md` on a clean checkout.
- [ ] Ensure `git status --short` is empty.
- [ ] Update `CHANGELOG.md` and choose a semantic version.
- [ ] Run `npm run release` as an authorized maintainer to create the version commit/tag using the documented non-`v` tag format (for example `0.1.0`).
- [ ] Push the release commit and tag.
- [ ] Confirm the **Publish** GitHub Actions run succeeded; do not publish from a pull request or local uncommitted tree.
- [ ] Confirm the npm package version exactly matches `package.json` and the Git tag.
- [ ] Confirm npm displays provenance linking to the exact public GitHub workflow, repository, commit, and tag.
- [ ] Confirm `npm view @sentdm/n8n-nodes-sent repository version --json` returns the exact metadata.
- [ ] Run `npx --yes @n8n/scan-community-package@0.31.0 @sentdm/n8n-nodes-sent@<version>` (or the then-current documented syntax/version) against the published package and save the passing output.
- [ ] Re-check the current scanner version and behavior immediately before running it; the current 0.31.0 CLI has no functional `--help` option and treats its positional argument as an npm package.

## 5. Verify public evidence

- [ ] Open the GitHub repository, npm package, README links, issues URL, API docs, and credential docs without authentication.
- [ ] Confirm none returns 404.
- [ ] Confirm npm tarball contents contain no secrets or unnecessary development files.
- [ ] Save links/screenshots for the successful publish workflow, npm provenance, package version, Git tag, and scanner output.

## 6. Creator Portal

- [ ] Sign in to [Creator Portal → Nodes](https://creators.n8n.io/nodes).
- [ ] Choose **Submit node package**.
- [ ] Enter the exact published npm name: `@sentdm/n8n-nodes-sent`.
- [ ] Complete every authenticated form field using the published/public evidence; do not guess fields that differ from this checklist.
- [ ] Provide repository, npm, documentation, API/credential docs, operations, support, maintainer, security, provenance, tag/version, and scanner information where the live form requests it.
- [ ] Confirm all URLs are public before submitting.
- [ ] Submit only after an authorized human reviews the information and accepts any portal attestations.
- [ ] Record the submission/review identifier and respond to n8n review feedback.

Only n8n can approve the application and grant verified status.
