# OID4VP Hybrid Module — Implementation Plan

> **Pendekatan:** Hybrid — protocol layer dari `@openid4vc/openid4vp@0.5.1`, crypto & DCQL evaluator tulis manual, adapter untuk bifold wallet.
> **Estimasi:** ~10 jam
> **Target:** OID4VP 1.0 Final — kompatibel dengan acapy-plugins

---

## 1. Arsitektur

```
┌──────────────────────────────────────────────────────────────────┐
│                        BIFOLD WALLET                            │
│  packages/core/src/modules/openid/                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  SEBELUM:                                                 │ │
│  │  resolverProof.tsx → agent.modules.openid4vc.holder.*    │ │
│  │  types.tsx        → extends OpenId4VpResolvedAuthRequest  │ │
│  │                  (via @credo-ts/openid4vc)                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  SESUDAH (▲ minimal change):                              │ │
│  │  resolverProof.tsx → resolveAuthorizationRequest()        │ │
│  │  types.tsx        → extends ResolvedAuthorizationRequest  │ │
│  │                  (via @bifold/openid4vp)                   │ │
│  └──────────────────────────┬─────────────────────────────────┘ │
│                             │ import                            │
└─────────────────────────────┼───────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────┐
│  @bifold/openid4vp          │                                   │
│                             ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  holder.ts          → panggil library resolve/submit     │  │
│  │                       + inject crypto (did:jwk, x509)   │  │
│  └──────────┬───────────────────────────────────────────────┘  │
│             │                                                  │
│  ┌──────────▼──────────────────┐  ┌─────────────────────────┐ │
│  │  crypto.ts  (KITA TULIS)   │  │  dcql.ts  (KITA TULIS)  │ │
│  │  • did:jwk resolve         │  │  • evaluator: match      │ │
│  │  • x509 chain verify       │  │    credentials wallet    │ │
│  └─────────────────────────────┘  └─────────────────────────┘ │
│             │                                                  │
│  ┌──────────▼───────────────────────────────────────────────┐  │
│  │  @openid4vc/openid4vp v0.5.1 (from openwallet-foundation)│  │
│  │  ✅ resolveOpenid4vpAuthorizationRequest()               │  │
│  │  ✅ submitOpenid4vpAuthorizationResponse()               │  │
│  │  ✅ version detection (draft 8 → v1)                    │  │
│  │  ✅ JWT verify, client_id schemes, dcql/pes parsing     │  │
│  │  ✅ transaction_data, client_metadata, error format      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Boundary: Library vs Kita Tulis

### ✅ Dari `@openid4vc/openid4vp` (gratis)
| Fitur | Kenapa Kita Pakai |
|-------|------------------|
| `resolveOpenid4vpAuthorizationRequest()` | Resolve JAR — fetch, verify JWT, version detection, cari `dcql_query` atau `presentation_definition` |
| `submitOpenid4vpAuthorizationResponse()` | Build & submit vp_token + presentation_submission via direct_post |
| `parseAuthorizationRequestVersion()` | Deteksi draft version dari fitur payload |
| `parseDcqlVpToken()` / `parsePexVpToken()` | Parse response format |
| Validasi payload (nonce, state, response_type, dll) | Sesuai standard mandatory |
| `client_id` scheme detection (`did:`, `x509_san_dns:`, dll) | Built-in |
| Error response format | Sesuai OAuth2 error spec |

### ✏️ Kita Tulis Manual
| Komponen | Alasan |
|----------|--------|
| **did:jwk resolver** | Library hanya detect scheme, tidak resolve public key dari did:jwk. Kita perlu konversi `kid` → JWK → `jose` verify |
| **x509 chain trust verification** | Wallet-specific — akar kepercayaan tergantung trust store wallet |
| **DCQL evaluator** | Library parse DCQL query TAPI tidak match ke credentials wallet. Format mapping (vc+sd-jwt → SdJwtVcRecord, dll) adalah domain wallet |
| **HTTP fetch utilities** | Library pake Node.js fetch — perlu disesuaikan dengan RN environment |
| **Bifold adapter** | Types + resolverProof integration |

---

## 3. Dependencies

```json
{
  "dependencies": {
    "@openid4vc/openid4vp": "^0.5.1",
    "jose": "^5.x",
    "did-resolver": "^4.x"
  }
}
```

**Catatan:**
- `@openid4vc/openid4vp@0.5.1` adalah **ESM-only** — perlu verifikasi dengan Metro bundler di awal
- `jose` adalah pure JS JWT library — zero native dependency, works di RN
- `did-resolver` untuk resolve did:jwk → public key

---

## 4. Struktur File

```
packages/openid4vp/
├── package.json                    → @bifold/openid4vp
├── tsconfig.json
├── src/
│   ├── index.ts                    → Public API: 2 fungsi + types
│   ├── types.ts                    → extends library types + wallet-specific
│   ├── holder.ts                   → resolve + submit + orchestration
│   ├── crypto.ts                   → did:jwk resolve + x509 verify
│   ├── dcql.ts                     → evaluator: match credentials wallet
│   └── utils.ts                    → HTTP fetch, URL parser
│
├── __tests__/
│   ├── fixtures/
│   │   ├── acapy-jwt-samples.ts    → JWT from acapy (did:jwk + x509)
│   │   └── dcql-queries.ts         → DCQL query samples
│   ├── crypto.test.ts
│   ├── dcql.test.ts
│   ├── holder.test.ts
│   ├── utils.test.ts
│   └── integration/
│       └── acapy-flow.test.ts
│
└── README.md
```

---

## 5. API Design

```typescript
// ==================== PUBLIC API ====================

/**
 * Step 1: Resolve authorization request dari verifier.
 * Menerima raw invitation URL atau JWT string.
 * - Parse URL, fetch JAR dari request_uri
 * - Verify JWT signature (did:jwk / x509)
 * - Extract dcql_query dan match ke credentials wallet
 * - Return resolved request + available credentials
 */
async function resolveAuthorizationRequest(
  options: ResolveAuthorizationRequestOptions
): Promise<ResolvedAuthorizationRequest>

/**
 * Step 2: Accept (submit) authorization response.
 * Menerima pilihan credentials user.
 * - Build vp_token sesuai format DCQL
 * - POST ke response_uri verifier
 * - Return result
 */
async function acceptAuthorizationRequest(
  options: AcceptAuthorizationRequestOptions
): Promise<AcceptAuthorizationRequestResult>

// ==================== TYPES ====================

interface ResolvedAuthorizationRequest {
  dcql?: DcqlQueryResult
  presentationExchange?: DifPexCredentialsForRequest  // backward-compat
  authorizationRequestPayload: Record<string, unknown>
  verifier: {
    clientId: string
    clientIdScheme: ClientIdScheme  // 'did' | 'x509_san_dns'
  }
  transactionData?: TransactionData[]
  origin?: string
}
```

---

## 6. Flow Detail

```
QR → resolveAuthorizationRequest()
  │
  ├─ 1. Parse invitation URL (utils.ts)
  │      → ekstrak request_uri, client_id
  │
  ├─ 2. Fetch JAR (via library: resolveOpenid4vpAuthorizationRequest)
  │      → GET request_uri → signed JWT (oauth-authz-req+jwt)
  │      → Version detection otomatis
  │      → Verify JWT signature
  │
  ├─ 3. Verify JWT signature (crypto.ts)
  │      CASE kid → resolveDidJwk(kid) → jose.verify()
  │      CASE x5c → resolveX5c(x5c) → jose.verify()
  │
  ├─ 4. Parse payload (via library)
  │      → dcql_query | presentation_definition
  │      → transaction_data (reject jika ada)
  │      → client_metadata.vp_formats_supported
  │      → nonce, state, dll
  │
  ├─ 5. Evaluate DCQL (dcql.ts)
  │      → Parse query (library)
  │      → Match credential format + claims ke wallet
  │      → Return matched credentials & candidates
  │
  └─ 6. Return ResolvedAuthorizationRequest

[User review + select credentials — UI EXISTING]

      ▼

acceptAuthorizationRequest()
  │
  ├─ 1. Map selected credentials → DCQL format (dcql.ts)
  │
  ├─ 2. Submit (via library: submitOpenid4vpAuthorizationResponse)
  │      → POST response_uri (x-www-form-urlencoded)
  │      → vp_token + state
  │
  └─ 3. Return result (ok/error/redirectUri)
```

---

## 7. Implementasi Detail per File

### 7.1 `holder.ts` — Inti Orchestrator

```
function resolveAuthorizationRequest({ request, credentials })
  1. Parse invitation URL → request_uri, client_id
  2. Fetch JAR: GET request_uri → signed JWT string
  3. Decode JWT header → dapat kid (did:jwk) atau x5c (x509)
  4. Verify signature:
     - did:jwk → crypto.resolveDidJwk(kid) → jose.verifyJwt()
     - x509 → crypto.resolveX5c(x5c) → jose.verifyJwt()
  5. Panggil library: parseAuthorizationRequestVersion(payload)
     → tau version untuk penanganan per-draft
  6. Validasi payload:
     - Mandatory fields: response_type=vp_token, response_mode=direct_post,
       nonce, state, client_id, response_uri
     - transaction_data → reject jika ada
     - client_metadata.vp_formats_supported → extract
     - dcql_query HARUS ada (standard) | presentation_definition (legacy)
  7. Evaluasi DCQL: dcql.evaluate(query, credentials)
     → return DcqlQueryResult (credential_query_id → matched)
  8. Return ResolvedAuthorizationRequest { dcql, payload, verifier }

function acceptAuthorizationRequest({ authorizationRequestPayload, dcql })
  1. Map selected credentials → DCQL response format
  2. Build vp_token (JSON object keyed by credential_query_id)
  3. Submit via library: submitOpenid4vpAuthorizationResponse({
       authorizationRequestPayload,
       vpToken,
       state
     })
  4. Return { ok, serverResponse }
```

### 7.2 `crypto.ts` — JWT Verification

```
function verifyDidJwkSignature(jwt: string, kid: string, alg: string)
  1. Parse kid → extract did:jwk URL (e.g., did:jwk:base64url...)
  2. Decode base64url → dapat JWK JSON
  3. Import JWK ke jose: jose.importJWK(jwk, alg)
  4. Verify: jose.jwtVerify(jwt, publicKey, { algorithms: [alg] })
  5. Return boolean

function verifyX5cSignature(jwt: string, x5c: string[], alg: string)
  1. Parse x5c[0] → DER certificate → extract public key
  2. (Optional) Verify certificate chain: x5c[0]→x5c[n-1] against trust store
  3. Import public key ke jose: jose.importX509(cert, alg)
  4. Verify: jose.jwtVerify(jwt, publicKey, { algorithms: [alg] })
  5. Return boolean
```

### 7.3 `dcql.ts` — Credential Evaluator

```
function evaluateDcqlQuery(query: DcqlQuery, credentials: Credential[])
  1. Parse query (via library atau manual)
  2. For setiap credential_query:
     a. Cek format match (dcql format → credential record type)
        vc+sd-jwt → SdJwtVcRecord
        mso_mdoc → MdocRecord
        jwt_vc_json → W3cCredentialRecord (JwtVc)
        ldp_vc → W3cCredentialRecord (LdpVc)
     b. Cek claims match (path/namespace+claim_name)
     c. Cek credential_sets (kombinasi A DAN B / A ATAU B)
     d. Cek trusted_authorities (optional)
     e. Cek require_cryptographic_holder_binding (optional)
  3. Return DcqlQueryResult {
       matched: credential_query_id → matched credentials list
       candidates: credential_query_id → all viable credentials
     }

function buildDcqlVpToken(selected: SelectedCredentials)
  1. Map selected credentials → format yang diminta
  2. Return VpToken: { [credential_query_id]: [presentation, ...] }

// BACKWARD-COMPAT: PEX evaluator (opsional)
function evaluatePexDefinition(definition, credentials)
  1. Parse input_descriptors
  2. Match per constraints.fields[].path[], format
  3. Return descriptor_map
```

### 7.4 `utils.ts` — HTTP & Helpers

```
function fetchJwtFromUri(uri: string)           → GET + timeout → string
function postForm(url: string, body: FormData)  → POST + timeout → Response
function parseInvitationUrl(url: string)        → { requestUri, clientId }
function extractHostname(url: string)           → string
```

---

## 8. Prioritas Implementasi

| Priority | Task | File | Dependency | Jam |
|----------|------|------|-----------|-----|
| **P0** 🚨 | Setup package + verifikasi RN ESM compat | `package.json` | - | 0.5 |
| **P0** 🚨 | did:jwk resolve + JWT verify | `crypto.ts` | P0 | 1.5 |
| **P0** 🚨 | DCQL evaluator (basic: format + claims match) | `dcql.ts` | P0 | 2 |
| **P0** 🚨 | Holder wrapper (resolve + accept) | `holder.ts` | P0 crypto | 1 |
| **P1** 🚨 | Bifold types update | `types.tsx` | P0 types | 0.5 |
| **P1** 🚨 | Bifold resolverProof update | `resolverProof.tsx` | P1 types | 1.5 |
| **P1** 🚨 | Package wiring (workspace, dependency) | `package.json` root+core | P1 | 0.5 |
| **P2** ⚠️ | x509 chain verify | `crypto.ts` | P0 | 0.5 |
| **P2** ⚠️ | DCQL evaluator (credential_sets, trusted_authorities) | `dcql.ts` | P0 | 1 |
| **P2** ⚠️ | Unit tests | `__tests__/` | P0-P2 | 1.5 |
| **P3** 📝 | PEX backward-compat | `dcql.ts` + `holder.ts` | P2 | opsional |
| **P3** 📝 | Integration test with acapy | `__tests__/integration/` | P2 | 1 |

### Timeline

```
Jam 0-3   → P0: Setup + Crypto + DCQL basic + Holder wrapper
             ✅ core protocol layer functional (via library)
             ✅ crypto (did:jwk verify)
             ✅ DCQL evaluator (basic)
             ✅ resolve + accept workflow

Jam 3-5   → P1: Integrasi Bifold
             ✅ types.tsx updated
             ✅ resolverProof.tsx updated
             ✅ package wiring

Jam 5-8   → P2: Polish & Testing
             ✅ x509 verify
             ✅ DCQL evaluator (credential_sets)
             ✅ Unit tests

Jam 8-10  → P2-P3: Final
             ✅ More tests
             ✅ PEX backward-compat (jika diperlukan)
             ✅ Integration test with acapy
```

---

## 9. Checklist Implementasi

### P0: Foundation (3 jam)
- [ ] Setup `packages/openid4vp/`
- [ ] Import `@openid4vc/openid4vp@^0.5.1` — test di RN/Metro bundler
- [ ] Implement `crypto.ts` — did:jwk resolve + verify
- [ ] Implement `dcql.ts` — evaluator: format + claims match
- [ ] Implement `holder.ts` — resolveAuthorizationRequest + acceptAuthorizationRequest
- [ ] Implement `utils.ts` — HTTP, URL, helpers
- [ ] Implement `types.ts` — type definitions
- [ ] Unit test: crypto, DCQL, utils

### P1: Bifold Integration (2 jam)
- [ ] Update `packages/core/src/modules/openid/types.tsx`
- [ ] Update `packages/core/src/modules/openid/resolverProof.tsx`
- [ ] Update root `package.json` — add workspace
- [ ] Update `packages/core/package.json` — add dependency
- [ ] Update `displayProof.tsx` — verifikasi kompatibilitas tipe

### P2: Polish (3 jam)
- [ ] `crypto.ts` — x509 chain trust verification
- [ ] `dcql.ts` — credential_sets handling, trusted_authorities
- [ ] Error handling: network error, invalid signature, verifier reject, dll
- [ ] Unit tests > 80% coverage
- [ ] Logging untuk debugging

### P3: Tambahan (2+ jam, opsional)
- [ ] PEX backward-compat
- [ ] Integration test dengan acapy (end-to-end)
- [ ] E2E test: QR → resolve → UI → submit
- [ ] Error message localization (opsional)

---

## 10. Risiko & Mitigasi

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| `@openid4vc/openid4vp@0.5.1` ESM tidak kompatibel RN Metro | Rendah | Tinggi | **Verifikasi di jam 1** sebelum coding lanjutan. Alternatif: tetap pake implementasi sendiri |
| `jose` butuh polyfill `crypto.getRandomValues` di RN | Rendah | Sedang | Tambah `react-native-get-random-values` |
| Library API breaking changes di minor update | Sedang | Sedang | Pin exact version `0.5.1`, lockfile, review changelog sebelum upgrade |
| did:jwk format tidak standard | Rendah | Rendah | Implement parser yang handle variasi format (base64url JWK, multibase, dll) |
| acapy update format JWT atau DCQL | Sedang | Sedang | Version detection otomatis dari library + test suite |

---

## 11. Perbandingan Opsi

| Aspek | A: Dari Nol | B: Full Library | C: Hybrid (DIPILIH) |
|-------|------------|----------------|-------------------|
| **Estimasi** | 13 jam | 10 jam | **~10 jam** |
| **Control** | ✅ Penuh | ⚠️ Terbatas API | ✅ Di critical path |
| **Safety (protocol)** | Manual | ✅ Dari library | ✅ Dari library |
| **Safety (crypto)** | ✅ Manual | ⚠️ Dari library | ✅ Manual |
| **DCQL evaluator** | ✅ Manual | ⚠️ Parsing doang | ✅ Kita kontrol |
| **RN compatibility risk** | Rendah | Sedang (ESM) | Sedang (verifikasi P0) |
| **Maintenance** | Update manual | Bump version | Hybrid |
| **Bundle size impact** | Minimal | +library | +library |
