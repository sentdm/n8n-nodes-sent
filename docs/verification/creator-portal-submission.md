# Creator Portal submission handoff

This is a human handoff document, not evidence of publication or verification.

| Submission fact | Value / current result |
| --- | --- |
| Exact Creator Portal URL | `https://creators.n8n.io/nodes` |
| npm package name to submit | `@sentdm/n8n-nodes-sent` |
| Intended public GitHub URL | `https://github.com/sentdm/n8n-nodes-sent` — **not publicly readable on 2026-08-04** |
| Latest published version | **Not published / unavailable** |
| Git tag for published version | **None** |
| npm provenance | **Not available; no publication occurred** |
| Community scanner | **Scanner 0.31.0 returned registry HTTP 404 for `@sentdm/n8n-nodes-sent@0.1.0`; published-package scan pending** |
| Support contact | `support@sent.dm` |
| Maintainer contact | `support@sent.dm` |
| API documentation | `https://docs.sent.dm` |
| Credential/authentication documentation | `https://docs.sent.dm/reference/api/authentication` |

## Node operations summary

The `Sent` action node exposes 27 operations across Account, Message, Contact, Profile, Brand Campaign, Webhook, and Number Lookup. Conversation, Template and User resources, and contact create/update/delete/message-summary, are deliberately excluded; see [API coverage](api-coverage.md) for the reasons. The `Sent Trigger` registers verified `message.*` webhooks, validates HMAC signatures against the exact raw body, enforces a ±300-second replay window, and returns a redelivery-stable deduplication key.

## Known limitations

- Package/repository publication, tag creation, GitHub Actions execution, provenance, public metadata, scanner pass, and Creator Portal submission are external actions still pending.
- Exact public checks currently fail: npm returns E404 and GitHub is not anonymously readable.
- Live Sent credential and webhook tests require a user-authorized API key and a public HTTPS endpoint.
- Sent's current message request schema does not document scheduling.
- Public HTTPS is required for trigger activation.
- Advanced structured API objects are entered as validated JSON where a stable high-quality UI cannot safely infer undocumented fields.

## Public Creator Portal inspection

On 2026-08-04, the public Nodes URL presented a sign-in page. The authenticated **Submit node package** form was not accessible without an account, and no login attempt was made. Therefore no private form-field names are fabricated here.

## Human form checklist

- [ ] Sign in and open **Nodes → Submit node package**.
- [ ] Record every live required field and any attestation displayed by the portal.
- [ ] Enter the exact npm name `@sentdm/n8n-nodes-sent`.
- [ ] Supply the exact public GitHub URL and public npm URL.
- [ ] Supply latest version and its exact non-`v` Git tag.
- [ ] Supply or link the successful GitHub Actions publish run and npm provenance.
- [ ] Supply the passing community scanner result.
- [ ] Supply the support and security contact `support@sent.dm`.
- [ ] Supply API documentation, authentication/credential documentation, README, and operation summary.
- [ ] Describe known limitations accurately.
- [ ] Attach screenshots/evidence only if the live form requests them.
- [ ] Complete any additional authenticated fields or attestations exactly as shown; mark them in this document before submission.
- [ ] Confirm every URL opens without authentication and none returns 404.
- [ ] Have an authorized human review and submit.

## Evidence references to add after publication

- GitHub Actions Publish run URL: **pending**
- npm package/version URL: **pending**
- npm provenance screenshot/link: **pending**
- Git tag/release URL: **pending**
- scanner output artifact: **pending**
- public URL check record: **pending**

**Only n8n can review the submission and grant verified status. This repository must not claim verified status before that decision.**
