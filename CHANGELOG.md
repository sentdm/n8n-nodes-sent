# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic Versioning.

## [0.1.0] - 2026-08-05

Initial release.

### Added

- Sent API credential with `x-api-key` authentication and a `GET /v3/me` credential test.
- Sent action node covering 21 stable public Sent API v3 method/path operations across Account, Message, Contact, Brand Campaign, Webhook, and Number Lookup.
- Sent Trigger for `message.*` events, with webhook registration, raw-body HMAC-SHA256 verification, a ±300-second replay window, and deregistration on deactivation.
- Shared typed transport with page-number pagination, redacted error reporting, sandbox, and idempotency support.
- Square Sent brand icons for the light and dark n8n themes, on the nodes and on the credential.
- 146 unit tests, importable example workflows, CI quality gates, and a provenance publishing workflow.

[0.1.0]: https://github.com/sentdm/n8n-nodes-sent/releases/tag/0.1.0
