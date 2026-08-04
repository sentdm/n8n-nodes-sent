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

Use `npm run lint:fix` for safe automated lint fixes and `npm run dev` for local n8n testing. Tests must mock Sent responses. Add a regression test for each bug fix and update API/readiness documentation when behavior changes.

## Pull requests

Keep changes focused, explain the Sent/n8n source for behavior, list commands run, and call out any manual checks. Do not change package identity, release metadata, legal identity, or branding without maintainer approval. A merge does not authorize npm publication.

## Releases

Only an authorized maintainer may run `npm run release` and push a version tag. Publication must occur through `.github/workflows/publish.yml`, and the version/tag, provenance, metadata, scanner, and public URLs must be verified afterward.
