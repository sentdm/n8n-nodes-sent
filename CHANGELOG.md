# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic Versioning.

## [0.1.1] - 2026-08-07

Release tooling only. The node code is unchanged from 0.1.0: every compiled file, type declaration and
icon in `dist/` is byte-identical to 0.1.0, and the only differences in the published tarball are the
version string and this changelog entry. This release adds no features and changes no node behaviour.

### Changed

- Release tags are created as the bare version (`0.1.1`) rather than release-it's default `v0.1.1`, which the publish workflow's tag/version check rejects.
- The publish workflow now waits for the published version to appear in the npm packument before running the community scanner. The scanner reads the packument, which lags the publish, and reported that lag as a scan failure on 0.1.0.
- Published through npm Trusted Publishing (OIDC) rather than the temporary bootstrap token that npm requires for a package's first release.
- The publish workflow no longer passes `registry-url` to `actions/setup-node`. That input writes an `.npmrc` pointing at a placeholder `NODE_AUTH_TOKEN`, which made npm skip OIDC entirely and fail with `404 Not Found - PUT`. The problem was masked while a bootstrap token was overwriting the placeholder.

## [0.1.0] - 2026-08-07

Initial release.

### Added

- Sent API credential with `x-api-key` authentication, optional child-profile routing through `x-profile-id`, and a `GET /v3/me` credential test.
- Sent action node covering 7 stable public Sent API v3 method/path operations across Account, Message, Contact, and Phone Number.
- Searchable contact selection, bounded inputs, safe channel routing, and simplified, raw, or selected-field output modes for broad read responses.
- Sent Trigger for `message.*` events, with idempotent webhook creation, registration repair/reactivation, raw-body HMAC-SHA256 verification, a ±300-second replay window, occurrence-aware deduplication keys, and deregistration on deactivation.
- Shared typed transport with page-number pagination, redacted error reporting, sandbox, and idempotency support.
- Square Sent brand icons for the light and dark n8n themes, on both nodes and the credential.
- 283 unit tests, importable example workflows, CI quality gates, and a provenance publishing workflow with an Actions-only first-publish path and npm Trusted Publishing handoff.

[0.1.1]: https://github.com/sentdm/n8n-nodes-sent/releases/tag/0.1.1
[0.1.0]: https://github.com/sentdm/n8n-nodes-sent/releases/tag/0.1.0
