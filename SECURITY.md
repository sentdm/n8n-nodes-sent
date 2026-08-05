# Security Policy

## Reporting

Do not disclose suspected vulnerabilities in a public issue. Send a minimal report to [support@sent.dm](mailto:support@sent.dm) and state that the report concerns the `@sentdm/n8n-nodes-sent` n8n community package. Do not send API keys, full webhook secrets, or personal message content by email.

Include the affected version, impact, reproduction steps using synthetic data, and suggested mitigation. Maintainers acknowledge receipt, assess severity, coordinate a fix, and publish an advisory when appropriate.

## Supported versions

The latest published minor version receives security fixes; older versions may require upgrading.

## Security properties

The credential is password-protected by n8n. Webhook signatures are verified against the exact raw body with a timing-safe comparison and replay-window enforcement, and verification fails closed. The package has no runtime dependencies and no runtime filesystem or environment access.

Webhook signing secrets are stored in n8n workflow static data, which n8n persists unencrypted and copies into saved execution records. See the README's *Webhook security* section for the reasoning and the mitigation.
