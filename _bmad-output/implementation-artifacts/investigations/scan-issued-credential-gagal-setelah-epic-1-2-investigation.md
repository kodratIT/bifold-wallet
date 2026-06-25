# Investigation: Scan issued credential gagal setelah Epic 1 dan 2

## Hand-off Brief

1. **What happened.** QR scanning succeeds, but OpenID4VCI credential issuance fails after scan when `customCredentialBindingResolver()` rejects an issuer that advertises only plain `jwk` holder binding for `UniverisityDegreev2`.
2. **Where the case stands.** Status: Concluded; root-cause mechanism is confirmed by runtime log, source trace, dependency enum evidence, and an existing unit test that currently expects `JwtVcJson + jwk` to throw.
3. **What's needed next.** Apply a targeted fix in `offerResolve.tsx` to allow plain JWK binding for the issuer's credential format, then update the unit test and rescan the same QR.

## Case Info

| Field            | Value                                                                      |
| ---------------- | -------------------------------------------------------------------------- |
| Ticket           | N/A                                                                        |
| Date opened      | 2026-06-25                                                                 |
| Status           | Concluded                                                                  |
| System           | macOS Darwin 24.3.0; branch `redesain`; React Native wallet repo           |
| Evidence sources | User free-text report; source code; current working-tree diff; git history |

## Problem Statement

User input verbatim: "kenapa setelah pengejaan epci 1 dan 2 scan issud credential malah gak bisa di lakukan"

Interpreted scope: investigate why, after Epic 1 and Epic 2 work, scanning an issued credential / credential offer no longer works. The wording is treated as an initial report, not yet confirmed by runtime evidence.

## Evidence Inventory

| Source | Status | Notes |
| ------ | ------ | ----- |
| User free-text report | Available | Symptom report only; no QR payload, screen, log, or error message yet. |
| Scan screen source | Available | `packages/core/src/screens/Scan.tsx` confirms QR values are passed to `connectFromScanOrDeepLink`. |
| Invitation parser source | Available | `packages/core/src/utils/parsers.tsx` confirms OpenID credential-offer URL recognition rules. |
| Scan/deeplink routing source | Available | `packages/core/src/utils/helpers.ts` confirms OpenID credential offers navigate to `Screens.OpenIDConnection`. |
| Current OpenID-related diff | Partial | Working tree has current changes in `packages/core/src/modules/openid/*`, `samples/app/index.js`, and `samples/app/metro.config.js`; impact not yet fully traced. |
| Runtime logs / device console | Missing | Needed to confirm exact failure point after scanning. |
| Repro QR payload | Missing | Needed to determine whether QR is an OpenID credential offer, OpenID4VP proof request, DIDComm OOB invitation, or malformed payload. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --------------- | -------- | ------ | ----- |
| 1 | Map QR scan routing from `Scan.tsx` through `connectFromScanOrDeepLink` into OpenID credential offer UI | High | Open | Establish whether scan detection or navigation is failing. |
| 2 | Trace `OpenIDConnection` and `OpenIDCredentialOffer` flow for credential offer resolution/acceptance | High | Open | Likely next hop after confirmed route. |
| 3 | Compare Epic 1/2 current diffs against credential-offer flow | High | Open | Determine whether OID4VP changes accidentally affected OID4VCI issuance. |
| 4 | Collect runtime log and QR payload from failing scan | High | Open | Required for confirmed root cause. |
| 5 | Run targeted type/test checks for OpenID modules | Medium | Open | Useful after source perimeter is mapped. |

## Timeline of Events

| Time | Event | Source | Confidence |
| ---- | ----- | ------ | ---------- |
| 2026-06-25 | User reported scan of issued credential / credential offer no longer works after Epic 1 and 2 work. | User message | Confirmed |
| 2026-06-25 | Working tree contains OpenID-related modifications in proof resolver/display/types and Metro/app entry config. | `git diff --name-only` run in investigation | Confirmed |

## Confirmed Findings

### Finding 1: QR scans enter `connectFromScanOrDeepLink`

**Evidence:** `packages/core/src/screens/Scan.tsx:37`-`48`, `packages/core/src/screens/Scan.tsx:63`-`72`

**Detail:** The scan screen passes the raw QR value to `handleInvitation`, which calls `connectFromScanOrDeepLink`; failures are wrapped as `QrCodeScanError` and shown as invalid QR scan errors.

### Finding 2: Credential-offer QR recognition is string-rule based

**Evidence:** `packages/core/src/utils/parsers.tsx:29`-`42`

**Detail:** A QR is considered an OpenID credential offer if it starts with `openid-initiate-issuance://` or `openid-credential-offer://`, or contains `credential_offer_uri=` / `credential_offer=`.

### Finding 3: Credential-offer scans route to `OpenIDConnection`

**Evidence:** `packages/core/src/utils/helpers.ts:1191`-`1199`

**Detail:** When `isOpenIdCredentialOffer(uri)` returns true, the app navigates to `Stacks.ConnectionStack` / `Screens.OpenIDConnection` with `openIDUri`.

## Deduced Conclusions

### Deduction 1: The first confirmed decision point is scan classification, not credential storage

**Based on:** Finding 1, Finding 2, Finding 3

**Reasoning:** The scan screen treats all QR payloads uniformly until `connectFromScanOrDeepLink`; credential-offer-specific behavior begins only after `isOpenIdCredentialOffer(uri)` matches.

**Conclusion:** If the failure appears immediately as an invalid QR, the likely area is parser/classification or an exception thrown inside `connectFromScanOrDeepLink`; if it navigates but fails later, the likely area is `OpenIDConnection` / credential offer resolution.

## Hypothesized Paths

### Hypothesis 1: Epic 1/2 changes broke issued credential scan flow

**Status:** Open

**Theory:** Recent Epic 1/2 changes may have modified OpenID-related modules, Metro resolution, or app entry shims in a way that affects credential-offer scanning or the OpenID credential issuance flow.

**Supporting indicators:** The current working tree has OpenID-related diffs and new package wiring, while the user reports regression after Epic 1/2.

**Would confirm:** A trace showing the failing scan enters a modified path and fails due to that change; or a targeted test/repro that passes before the diff and fails after it.

**Would refute:** A runtime log showing the QR payload is not recognized by pre-existing parser rules, camera permission fails before OpenID code runs, or issuer-side/QR data is invalid independent of the Epic 1/2 changes.

**Resolution:** Open.

### Hypothesis 2: OID4VP proof resolver changes accidentally affected OID4VCI credential issuance

**Status:** Open

**Theory:** The new `@bifold/openid4vp` imports and Metro/package resolution changes may have affected module resolution or runtime polyfills used by OpenID credential issuance.

**Supporting indicators:** Current diffs include `samples/app/index.js`, `samples/app/metro.config.js`, and OpenID proof files; these can affect bundling/runtime globally even if scan routing code is unchanged.

**Would confirm:** Metro/runtime error mentioning `@bifold/openid4vp`, `@openid4vc/*`, `jose`, crypto APIs, or module resolution during credential-offer scan.

**Would refute:** Runtime logs showing scan reaches `OpenIDCredentialOffer` and fails in credential offer parsing/token/credential request unrelated to module resolution.

**Resolution:** Open.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | ------ | ------------- |
| Exact QR payload or issuer link | Determines expected parser branch and whether payload is credential offer vs proof request vs DIDComm. | Copy/paste QR content or provide issuer page/link. |
| Runtime/device logs from failed scan | Identifies the first thrown error and exact code path. | Run app with Metro/device logs and reproduce scan. |
| Definition of Epic 1 and Epic 2 changes | Determines intended scope and likely regression boundary. | Provide story docs/epic names or authorize source/diff perimeter mapping. |
| Screenshot/video of failure point | Distinguishes camera scan failure, invalid QR toast, navigation failure, offer resolution error, and accept-credential failure. | Capture screen during failed scan. |

## Source Code Trace

| Element | Detail |
| ------- | ------ |
| Error origin | `packages/core/src/modules/openid/offerResolve.tsx:217`-`233`, inside `customCredentialBindingResolver()`, where plain JWK binding is allowed only for `SdJwtVc` and `MsoMdoc`, then throws `No supported binding method could be found...`. |
| Trigger | User scans an OpenID credential offer QR; scan routes through `Scan` → `connectFromScanOrDeepLink` → `OpenIDConnection` → `useOpenID` → `receiveCredentialFromOpenId4VciOffer`. |
| Condition | Issuer credential configuration `UniverisityDegreev2` advertises `supportsJwk=true` but no `did:key` / `did:jwk`; credential format is expected to be `jwt_vc_json` based on the requested degree credential and supported enum/test evidence. Current resolver rejects `JwtVcJson + jwk`. |
| Related files | `packages/core/src/screens/Scan.tsx`; `packages/core/src/utils/parsers.tsx`; `packages/core/src/utils/helpers.ts`; `packages/core/src/modules/openid/screens/OpenIDConnection.tsx`; `packages/core/src/modules/openid/hooks/openid.tsx`; `packages/core/src/modules/openid/offerResolve.tsx`; `packages/core/__tests__/modules/openid/offerResolve.test.ts`; `_bmad-output/planning-artifacts/epics.md`. |

## Conclusion

**Confidence:** High for the failing mechanism; Medium for the exact issuer metadata because the full `UniverisityDegreev2` credential-offer metadata payload was not captured.

The scanner is not the failing component. The runtime log confirms the app reaches OpenID4VCI issuance and fails after `[OpenID] Requesting credential for configuration: UniverisityDegreev2`. The root-cause mechanism is holder-binding selection in `packages/core/src/modules/openid/offerResolve.tsx:217`-`233`: plain `jwk` binding is allowed only for `SdJwtVc` and `MsoMdoc`, while the issuer advertises only `jwk` and the failing configuration is expected to be `JwtVcJson` / `jwt_vc_json`. Existing unit coverage at `packages/core/__tests__/modules/openid/offerResolve.test.ts:277`-`289` confirms the current code intentionally throws for `JwtVcJson + supportsJwk=true`, matching the observed production error.

## Recommended Next Steps

### Fix direction

Update `customCredentialBindingResolver()` in `packages/core/src/modules/openid/offerResolve.tsx` so plain `jwk` holder binding is allowed for `OpenId4VciCredentialFormatProfile.JwtVcJson` when the issuer advertises `supportsJwk=true`. Consider including `OpenId4VciCredentialFormatProfile.JwtVcJsonLd` if the wallet needs JSON-LD VC issuer compatibility. Then update `packages/core/__tests__/modules/openid/offerResolve.test.ts:277`-`289` from expecting a throw to expecting `{ method: 'jwk', keys: [publicJwk] }`, while keeping a separate negative test for genuinely unsupported combinations.

### Diagnostic

If more certainty is required before patching, log the `credentialFormat`, `supportsJwk`, `supportedDidMethods`, and `supportsAllDidMethods` arguments inside `customCredentialBindingResolver()` during the failing scan. The expected confirming output is `credentialFormat: "jwt_vc_json"`, `supportsJwk: true`, and no usable DID methods.

## Reproduction Plan

1. Launch the Android sample app on the same device/environment.
2. Scan the same `UniverisityDegreev2` OpenID credential-offer QR.
3. Confirm current failure: log shows `[OpenID] Requesting credential for configuration: UniverisityDegreev2`, then `No supported binding method could be found... Issuer supports jwk,`.
4. Apply the targeted holder-binding fix and update the unit test.
5. Run the OpenID offer resolver test file.
6. Relaunch and rescan the same QR.
7. Expected result after fix: no `No supported binding method...` error; the app either logs credential received or shows the credential offer/acceptance success path.

## Side Findings

- The repo search found current scan localization entries and OpenID package resolution entries, but no broad repository evidence yet that scan classification code itself was modified in the current diff.

## Follow-up: 2026-06-25

### New Evidence

- Runtime log confirms scan reaches OpenID issuance flow and fails while requesting credential configuration `UniverisityDegreev2`: `[OpenID] Requesting credential for configuration: UniverisityDegreev2` followed by `[OpenID] Credential offer failed: No supported binding method could be found... Issuer supports jwk,`.
- Source trace confirms this log is emitted immediately before `receiveCredentialFromOpenId4VciOffer()` in `packages/core/src/modules/openid/hooks/openid.tsx:71`-`77`, and the failure is logged in `packages/core/src/modules/openid/hooks/openid.tsx:110`-`123`.
- The thrown error text matches `customCredentialBindingResolver()` in `packages/core/src/modules/openid/offerResolve.tsx:217`-`233`, where plain JWK binding is only accepted for `SdJwtVc` or `MsoMdoc`; other credential formats throw even when issuer supports `jwk`.
- Epic requirements explicitly state `OpenId4VcModule` is still needed for OIDC4VCI issuance and must not be removed/affected: `_bmad-output/planning-artifacts/epics.md:64` and `_bmad-output/planning-artifacts/epics.md:299`-`302`.

### Additional Findings

- The failure is not camera scanning itself. Camera closes normally, then OpenID credential issuance proceeds until credential request/binding selection.
- The issuer supports plain `jwk` binding but does not advertise `did:key` or `did:jwk`, so resolver branch `didMethod` stays undefined and falls through to the plain-JWK format gate.
- The requested credential configuration name `UniverisityDegreev2` strongly suggests a W3C/JWT VC style credential rather than SD-JWT or mdoc; if `credentialFormat` is `jwt_vc_json`, current code will reject plain JWK binding.

### Updated Hypotheses

- Hypothesis 1 status: Confirmed in mechanism, Medium confidence in regression boundary. The scan reaches issuance but fails because holder-binding method selection rejects the issuer's only advertised binding (`jwk`) for this credential format.
- Hypothesis 2 status: Refuted for direct OID4VP resolver involvement. The failing call path is OIDC4VCI issuance (`useOpenID` → `receiveCredentialFromOpenId4VciOffer`), not OID4VP proof resolver (`resolverProof.tsx`). However, Epic 2 integration risk remains relevant because requirements said OIDC4VCI issuance should stay unaffected.

### Backlog Changes

- Done: identify first failing runtime point.
- Open: confirm actual `credentialFormat` and issuer metadata for `UniverisityDegreev2`.
- Open: compare behavior before/after Epic branch or prior known-good commit for `customCredentialBindingResolver` and dependency versions.

### Updated Conclusion

**Confidence:** High for failing mechanism; Medium for exact credential metadata because the full issuer metadata payload was not captured.

The log confirms the QR scan itself works; the app reaches OpenID credential issuance and fails during credential request holder-binding resolution. The immediate cause is `customCredentialBindingResolver()` rejecting an issuer that supports only plain `jwk` binding unless the credential format is `SdJwtVc` or `MsoMdoc`. Dependency evidence confirms Credo supports `OpenId4VciCredentialFormatProfile.JwtVcJson = "jwt_vc_json"`, and the existing unit test `packages/core/__tests__/modules/openid/offerResolve.test.ts:277`-`289` explicitly asserts that `JwtVcJson + supportsJwk=true` throws this same error. Therefore a W3C/JWT VC credential offer such as `UniverisityDegreev2` from an issuer that only advertises `jwk` will fail deterministically in the current code.

### Source Trace Outcome 4 Notes

- Exact error string search found only the resolver throw site, the OpenID hook logs, and the existing test coverage.
- Parallel implementation/history scan found the relevant code path was already present before the Epic 1/2 OID4VP integration; Epic requirements explicitly warned that OIDC4VCI issuance must remain supported.
- Resolved dependency enum confirms valid formats include `JwtVcJson`, `JwtVcJsonLd`, `LdpVc`, `SdJwtVc`, `SdJwtDc`, and `MsoMdoc`; current local allowlist covers only `SdJwtVc` and `MsoMdoc` for plain JWK.
- The existing test currently encodes the failing behavior as expected behavior: `customCredentialBindingResolver({ supportsJwk: true, credentialFormat: OpenId4VciCredentialFormatProfile.JwtVcJson })` rejects with `No supported binding method could be found.`

### Diagnosis

Root-cause area: holder binding selection for OIDC4VCI issuance in `packages/core/src/modules/openid/offerResolve.tsx:157`-`234`.

The scanner is not broken. The QR offer is accepted far enough to request `UniverisityDegreev2`, but the wallet refuses the issuer's advertised proof-of-possession method because plain JWK is format-gated too narrowly.

### Fix Direction

Update `customCredentialBindingResolver()` to support plain `jwk` for the credential format used by this issuer, most likely `OpenId4VciCredentialFormatProfile.JwtVcJson`. The existing unit test at `packages/core/__tests__/modules/openid/offerResolve.test.ts:277`-`289` should be changed from expecting a throw to expecting `{ method: 'jwk', keys: [publicJwk] }`, and a separate negative test should remain for truly unsupported formats/method combinations.

### Verification Plan

1. Add/adjust unit test for `JwtVcJson + supportsJwk=true`.
2. Run the OpenID offer resolver test file.
3. Rebuild/relaunch app and scan the same `UniverisityDegreev2` QR.
4. Expected log after fix: no `No supported binding method...`; app should log credential received or move to the credential offer confirmation screen.
