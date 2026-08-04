# Security Policy

## Reporting

Do not disclose suspected vulnerabilities in a public issue. Send a minimal report to the package security/maintainer contact once that address has been confirmed by the repository owner. Until confirmation, contact Sent through [support@sent.dm](mailto:support@sent.dm) and state that the report concerns the n8n community package. Do not send API keys, full webhook secrets, or personal message content by email.

Include affected version, impact, reproduction steps using synthetic data, and suggested mitigation. Maintainers should acknowledge receipt, assess severity, coordinate a fix, and publish an advisory when appropriate.

## Supported versions

No version is published yet. After release, the latest supported minor version will receive security fixes; older versions may require upgrading.

## Security properties

The credential is password-protected by n8n, webhook signatures are verified against the exact raw body with timing-safe comparison and replay-window enforcement, and the package has no runtime dependencies or runtime filesystem/environment access.
