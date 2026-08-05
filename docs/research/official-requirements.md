# Official requirements research

> **Point-in-time research snapshot, 2026-08-04.** Toolchain versions and the node surface recorded
> below were true when the package was first built. The node has since been trimmed to 4 resources /
> 7 operations, and the licence holder and contacts are confirmed. For the package as it stands, read
> `../verification/verification-readiness.md`. This file is kept for its record of *which official
> sources were consulted*, not as a current status report.

Research date: **2026-08-04** (Europe/Belgrade).

## Toolchain observed

| Check | Result |
| --- | --- |
| Installed Node.js | `v24.9.0` |
| Installed npm | `11.6.0` |
| Current starter requirement | Node.js 22 or later |
| Requirement satisfied | Yes (`24.9.0 >= 22`) |
| npm `latest` for `@n8n/node-cli` | `0.42.0` |
| Repository-local CLI | `@n8n/node-cli/0.42.0 darwin-arm64 node-v24.9.0` |
| Official starter commit inspected | `3308a8eca314e388c40b29c9b6cefc49a8cf9115` |
| n8n source commit inspected for webhook APIs | `73841560ad76a5ffc7b7a9d9d368713358667bc6` |

The local CLI version is pinned exactly in `devDependencies`; no global CLI is required. `npx n8n-node <command>` resolves the repository copy.

## CLI inspection

The current scaffold was invoked with `npm create @n8n/node`. Before use, `npm create @n8n/node@latest -- --help` was read. It documented `n8n-node new [NAME]`, templates, and scaffold options. The generated project was created with the programmatic example template and then migrated without discarding the legitimate starter configuration.

The generator banner reported `0.43.0`, while the npm package/CLI installed as current `latest` was `0.42.0`; this discrepancy is recorded rather than silently treating the banner as the installed CLI version.

Repository-local help was read for:

- `npx n8n-node --help`: `build`, `cloud-support`, `dev`, `lint`, `new`, `release`.
- `npx n8n-node build --help`
- `npx n8n-node lint --help`
- `npx n8n-node prerelease --help` (internal publish guard)
- `npx n8n-node release --help`

## Source-of-truth matrix

| Requirement | Source | Implementation/evidence | Status |
| --- | --- | --- | --- |
| Use official scaffold/CLI | [Build an n8n node](https://docs.n8n.io/connect/create-nodes/build-your-node/using-the-n8n-node-tool) | Scaffold created via `npm create @n8n/node`; local CLI pinned | Met |
| Node.js 22+ | [Official starter](https://github.com/n8n-io/n8n-nodes-starter) | Node `v24.9.0`, `engines.node >=22`, CI Node 22 | Met |
| Local CLI scripts | Official starter/package scripts | `dev`, `lint`, `lint:fix`, `build`, `release`; direct use via `npx` | Met |
| MIT license | n8n verification guidance | `license: MIT`, `LICENSE.md`, holder Sent.dm | Met |
| No runtime dependencies | n8n verification guidance | No `dependencies`; only dev/peer dependencies | Met |
| Public source and exact npm metadata | [Creator Portal](https://creators.n8n.io/nodes) | Metadata targets `https://github.com/sentdm/n8n-nodes-sent`; public existence pending | External action |
| GitHub Actions publication/provenance | Current starter publication workflow | `.github/workflows/publish.yml`, `id-token: write`, Trusted Publisher | Configured, not executed |
| Raw-body webhook verification | Current public `IWebhookFunctions`/request API | Uses `request.rawBody` and supported `request.readRawBody()` | Met locally |
| Creator Portal submission | [Creator Portal Nodes](https://creators.n8n.io/nodes) | Public page presented authentication only; no private form fields inferred | Not submitted |

## Migration record

The workspace started empty. A fresh official scaffold was generated outside the repository, copied without its temporary `.git`, and initialized on branch `main`. Starter scripts and local CLI conventions were preserved. The example node/credential were replaced with Sent implementations, tests and documentation were added, CI Node was pinned to 22, and the generated workflow interpolation defects (`ci-$` and `NPM_TOKEN: $`) were corrected. No prior business implementation existed to migrate.

## Primary references

- [n8n Creator Portal](https://creators.n8n.io/nodes)
- [Official node CLI documentation](https://docs.n8n.io/connect/create-nodes/build-your-node/using-the-n8n-node-tool)
- [Official starter repository](https://github.com/n8n-io/n8n-nodes-starter)
- [n8n community-node verification guidance](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes)
- [Sent API documentation](https://docs.sent.dm)
