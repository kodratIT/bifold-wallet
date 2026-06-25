---
title: 'OpenID4VCI JWT VC JSON Plain JWK Holder Binding'
type: 'bugfix'
created: '2026-06-25'
status: 'done'
baseline_commit: '105b11b53cf105ae4463b24a5ad809cf34f0f4ce'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/investigations/scan-issued-credential-gagal-setelah-epic-1-2-investigation.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Scanning an OpenID4VCI credential offer for `UniverisityDegreev2` succeeds, but credential issuance fails when `customCredentialBindingResolver()` rejects an issuer that advertises only plain `jwk` holder binding. Current behavior blocks `OpenId4VciCredentialFormatProfile.JwtVcJson` even though Credo exposes that format and the issuer can only proceed through plain JWK proof-of-possession.

**Approach:** Extend holder-binding selection so plain `jwk` is accepted for JWT VC JSON credential offers when the issuer advertises `supportsJwk=true`. Update the existing unit test that currently encodes the failing behavior, and keep a negative-path assertion for unsupported binding combinations.

## Boundaries & Constraints

**Always:** Keep the fix scoped to OIDC4VCI issuance holder-binding behavior. Preserve existing preference order: use DID binding when `did:jwk`, `did:key`, or all DID methods are supported; use plain JWK only when no DID method is selected and the issuer explicitly supports JWK. Maintain hardware-backed holder binding behavior and existing signature algorithm selection.

**Ask First:** If supporting `JwtVcJson` requires changing credential request payload shape, token/DPoP behavior, Metro config, package versions, or issuer metadata parsing, halt and ask before expanding scope. If test failures point outside `offerResolve.tsx` or `offerResolve.test.ts`, report the finding before broadening the patch.

**Never:** Do not modify QR scanning, navigation, OID4VP proof resolver code, issuer metadata, or user-facing screens. Do not disable holder-binding validation globally. Do not treat unsupported issuer binding metadata as success.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| JWT VC JSON plain JWK | `supportsJwk=true`, no selected DID method, `credentialFormat=OpenId4VciCredentialFormatProfile.JwtVcJson` | Resolver returns `{ method: 'jwk', keys: [credentialBindingKey.publicJwk] }` | N/A |
| Existing SD-JWT plain JWK | `supportsJwk=true`, no selected DID method, `credentialFormat=SdJwtVc` | Existing `{ method: 'jwk', keys: [...] }` behavior remains unchanged | N/A |
| DID method available | `supportedDidMethods` includes `did:jwk` or `did:key` | Resolver returns `{ method: 'did', didUrls: [...] }` and does not use plain JWK fallback | DID creation failure still throws `DID creation failed.` |
| Unsupported binding | `supportsJwk=false` and no usable DID method, or unsupported plain-JWK credential format | Resolver throws `No supported binding method could be found.` | Existing error path remains covered by tests |

</frozen-after-approval>

## Code Map

- `packages/core/src/modules/openid/offerResolve.tsx` -- Defines `customCredentialBindingResolver()` and the plain-JWK credential format allowlist that currently excludes `JwtVcJson`.
- `packages/core/src/modules/openid/hooks/openid.tsx` -- Logs `[OpenID] Requesting credential for configuration: ...` before calling `receiveCredentialFromOpenId4VciOffer()`; confirms runtime failure point.
- `packages/core/__tests__/modules/openid/offerResolve.test.ts` -- Existing tests cover DID preference, SD-JWT plain JWK success, hardware binding, DPoP pass-through, and the current `JwtVcJson + supportsJwk=true` rejection.
- `_bmad-output/implementation-artifacts/investigations/scan-issued-credential-gagal-setelah-epic-1-2-investigation.md` -- Evidence-graded diagnosis and reproduction notes for the failing scan.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/__tests__/modules/openid/offerResolve.test.ts` -- Change the current `JwtVcJson + supportsJwk=true` test from rejection to success -- establishes red/green coverage for the reported failure.
- [x] `packages/core/__tests__/modules/openid/offerResolve.test.ts` -- Add or preserve a negative test for no supported binding method -- prevents accidentally accepting unsupported issuer metadata.
- [x] `packages/core/src/modules/openid/offerResolve.tsx` -- Add `OpenId4VciCredentialFormatProfile.JwtVcJson` to the plain-JWK fallback allowlist -- enables the failing credential offer path without changing DID preference order.
- [x] `packages/core/src/modules/openid/offerResolve.tsx` -- Update the error message if needed so supported plain-JWK formats are accurately described -- keeps diagnostics aligned with behavior.

**Acceptance Criteria:**
- Given an OpenID4VCI issuer advertises `supportsJwk=true` for a `JwtVcJson` credential and no usable DID binding method, when `customCredentialBindingResolver()` runs, then it returns a plain JWK binding instead of throwing `No supported binding method could be found.`
- Given a DID binding method is available, when `customCredentialBindingResolver()` runs, then existing DID binding behavior remains preferred over plain JWK.
- Given no DID binding method and no supported plain JWK path exist, when `customCredentialBindingResolver()` runs, then it still throws `No supported binding method could be found.`
- Given the OpenID offer resolver unit tests run, when the patch is applied, then the targeted test file passes without requiring QR scanner, navigation, OID4VP resolver, or Metro changes.

## Spec Change Log

## Verification

**Commands:**
- `yarn workspace @bifold/core test --runTestsByPath __tests__/modules/openid/offerResolve.test.ts --runInBand` -- expected: targeted OpenID offer resolver tests pass.

**Manual checks (if device is available):**
- Rebuild/relaunch the Android app, scan the same `UniverisityDegreev2` QR, and confirm the log no longer contains `No supported binding method could be found... Issuer supports jwk,`.

## Suggested Review Order

- Start at the holder-binding gate; `JwtVcJson` joins the minimal plain-JWK allowlist.
  [`offerResolve.tsx:217`](../../packages/core/src/modules/openid/offerResolve.tsx#L217)

- Check diagnostics still explain every supported binding route.
  [`offerResolve.tsx:230`](../../packages/core/src/modules/openid/offerResolve.tsx#L230)

- Verify the reported issuer shape now returns plain JWK without DID creation.
  [`offerResolve.test.ts:277`](../../packages/core/__tests__/modules/openid/offerResolve.test.ts#L277)

- Verify unsupported metadata still throws rather than silently accepting.
  [`offerResolve.test.ts:296`](../../packages/core/__tests__/modules/openid/offerResolve.test.ts#L296)
