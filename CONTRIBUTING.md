# Contributing

## Before opening a change

Open an issue for user-visible behavior or API coverage changes. Never include API keys, webhook secrets, real phone numbers, private webhook payloads, or personal data.

## Development

Use Node.js 22 or later and the repository-local `@n8n/node-cli`.

```bash
npm install
npm run lint
npm test
npm run build
npm pack --dry-run
```

`npm run lint` runs eslint only and does not type-check, so run `npm run build` before assuming a change compiles. Use `npm run lint:fix` for safe automated fixes and `npm run dev` for local n8n testing.

`package-lock.json` is the committed lockfile and is what CI installs from. pnpm works locally, but do not commit a second lockfile.

Tests must mock Sent responses. Adding an operation requires a matching row in `test/operations.test.ts`; the suite fails if the node and that table disagree. Add a regression test for each bug fix and update `docs/verification/api-coverage.md` when coverage changes.

## Pull requests

Keep changes focused, explain the Sent/n8n source for behavior, list commands run, and call out any manual checks. Do not change package identity, release metadata, legal identity, or branding without maintainer approval. A merge does not authorize npm publication.

## Releases

Only an authorized maintainer may run `npm run release` and push a version tag. Publication must occur through `.github/workflows/publish.yml`, and the version/tag, provenance, metadata, scanner, and public URLs must be verified afterward. See `docs/verification/submission-checklist.md` for the required ordering: the first release uses a short-lived granular npm token in GitHub Actions, then publishing moves to npm Trusted Publishing and the token is removed and revoked.
