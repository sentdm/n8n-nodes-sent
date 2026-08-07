# Creator Portal submission handoff

This is a human handoff document, not evidence of publication or verification.

Values below were re-verified on 2026-08-07, after publication.

| Submission fact                         | Value / current result                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact Creator Portal URL                | `https://creators.n8n.io/nodes`                                                                                                                                                                                                                                                                                               |
| npm package name to submit              | `@sentdm/n8n-nodes-sent`                                                                                                                                                                                                                                                                                                      |
| Public GitHub URL                       | `https://github.com/sentdm/n8n-nodes-sent` — public, HTTP 200 unauthenticated                                                                                                                                                                                                                                                 |
| Latest published version                | **0.1.0**, published 2026-08-07; `dist-tags.latest` = `0.1.0`                                                                                                                                                                                                                                                                 |
| Git tag for published version           | **`0.1.0`** (no `v` prefix), on commit `1e0f293ab05289977ab3d3a80962d59a0be12749`                                                                                                                                                                                                                                             |
| npm provenance                          | Present — `predicateType: https://slsa.dev/provenance/v1`, published from GitHub Actions run `31163306463`; sigstore transparency log index `2367421819`. npm records `gitHead` `1e0f293`, matching the tagged and CI-verified commit.                                                                                        |
| Community scanner                       | **Passed.** `npx @n8n/scan-community-package@0.31.0 '@sentdm/n8n-nodes-sent@0.1.0'` reports "has passed all security checks"; provenance check passed and source was fetched from `sentdm/n8n-nodes-sent@1e0f293`. At scan time npm tags `latest` and `beta` both resolved to 0.31.0, so the pinned run is the current build. |
| Support contact                         | `support@sent.dm`                                                                                                                                                                                                                                                                                                             |
| Maintainer contact                      | `support@sent.dm`                                                                                                                                                                                                                                                                                                             |
| API documentation                       | `https://docs.sent.dm`                                                                                                                                                                                                                                                                                                        |
| Credential/authentication documentation | `https://docs.sent.dm/reference/api/authentication`                                                                                                                                                                                                                                                                           |

## Node operations summary

The `Sent` action node exposes 7 operations across Account, Message, Contact, and Phone Number. Every administrative resource (Conversation, Template, User, Profile, Brand Campaign, Webhook) is deliberately excluded; see [API coverage](api-coverage.md) for the reasons. The `Sent Trigger` registers `message.*` webhooks, validates HMAC signatures against the exact raw body, enforces a ±300-second replay window, and returns a workflow-side idempotency key. Live lifecycle and delivery checks were run by the maintainer against a live Sent account and n8n 2.33.4 on 2026-08-06 and are attested in [verification readiness](verification-readiness.md); no request/response transcript is stored in this repository, deliberately, because those exchanges carry a real API key, a `whsec_` signing secret, and recipient phone numbers.

## Known limitations

- Creator Portal submission is the one external action still pending. Repository publication, tag creation, the GitHub Actions publish run, provenance, public metadata and the scanner pass are all complete and recorded in [verification readiness](verification-readiness.md).
- Trusted Publishing handoff is in progress: the first publish used a temporary bootstrap `NPM_TOKEN`, as the official n8n starter workflow allows, because npm can only attach a Trusted Publisher after a package exists. Confirm `npm trust list @sentdm/n8n-nodes-sent`, then delete the secret and revoke the token so later releases take the OIDC path.
- Live Sent credential and webhook tests require a user-authorized API key and a public HTTPS endpoint, so they are maintainer-attested rather than reproducible from a clean checkout.
- Sent's current message request schema does not document scheduling.
- Public HTTPS is required for trigger activation.
- A signing secret rotated directly in Sent is not returned by the webhook read endpoint; deactivate and reactivate the workflow to register and store a new secret.
- **Template Parameters** is a JSON field, because template variables are defined by the template rather than by a fixed schema. It accepts literal JSON or an expression that resolves to an object.

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

## Evidence references

Recorded 2026-08-07. Each URL below was checked and returns HTTP 200 unless noted.

- GitHub Actions Publish run: `https://github.com/sentdm/n8n-nodes-sent/actions/runs/31163306463`
- npm package page: `https://www.npmjs.com/package/@sentdm/n8n-nodes-sent` — **confirm in a real browser.** npmjs.com returns 403 to command-line clients even with a browser user agent, which is bot protection and not a missing page; the authoritative machine check is the registry API below.
- npm registry metadata: `https://registry.npmjs.org/@sentdm%2Fn8n-nodes-sent` and `.../@sentdm%2Fn8n-nodes-sent/0.1.0`
- npm provenance attestation: `https://registry.npmjs.org/-/npm/v1/attestations/@sentdm%2fn8n-nodes-sent@0.1.0`
- Sigstore transparency log: `https://search.sigstore.dev/?logIndex=2367421819`
- Git tag: `https://github.com/sentdm/n8n-nodes-sent/releases/tag/0.1.0` — serves a tag page; no GitHub Release object was created, because the Actions publish path runs `npm publish` and never release-it's `--github.release`
- Scanner output: quoted verbatim in the Community scanner row above and in [verification readiness](verification-readiness.md); the workflow's own post-publish scan step failed spuriously on npm packument propagation and the diagnosis is recorded there
- Public URL check record: [verification readiness](verification-readiness.md), _Publication progress_

**Only n8n can review the submission and grant verified status. This repository must not claim verified status before that decision.**
