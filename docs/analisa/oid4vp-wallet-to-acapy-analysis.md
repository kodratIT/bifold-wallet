# OIDC4VP: Wallet ↔ acapy-plugins Compatibility Analysis & Implementation Plan

> **Tujuan dokumen:** Menganalisis kesenjangan (gap) antara implementasi OIDC4VP wallet saat ini dengan standard OID4VP 1.0 Final dan acapy-plugins, serta rencana pembuatan custom module yang sesuai standard.

---

## 0. Klarifikasi Versi OID4VP (Penting)

Berdasarkan verifikasi langsung ke source of truth:

| Versi | URL | Query Language | Status |
|-------|-----|---------------|--------|
| **OID4VP 1.0 Final (draft-30)** | [openid.net/specs/...](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html) | **DCQL SAJA** | ✅ **STANDAR RESMI** |
| OID4VP 1.0 ID2 (Implementer's Draft) | [bitbucket.io/...](https://openid.bitbucket.io/connect/openid-4-verifiable-presentations-1_0-ID2.html) | (format lama) | ❌ Superseded |
| OID4VP 1.0 ID3 (Final draft) | [bitbucket.io/...](https://openid.bitbucket.io/connect/openid-4-verifiable-presentations-1_0-ID3.html) | DCQL | ❌ Superseded |
| OID4VP 1.1 (Editor's Draft) | [GitHub main](https://github.com/openid/OpenID4VP/blob/main/1.1/...) | DCQL SAJA + fitur baru | 📝 Draft |
| OID4VP 1.0 errata set 1 | [GitHub main/1.0/](https://github.com/openid/OpenID4VP/blob/main/1.0/...) | DCQL SAJA + fitur baru | 📝 Editor's draft |

**Fakta kunci:** OID4VP 1.0 Final yang dipublikasi di `openid.net` — standard resmi yang sudah disetujui — **hanya menggunakan DCQL**. `presentation_definition`/PEX **tidak pernah ada** di standard final. PEX hanya ada di draft-draft awal (pre-ID3).

**acapy-plugins** mengacu ke `openid-4-verifiable-presentations-1_0-ID2.html` (draft lawas) dan menambahkan PEX sebagai ekstensi di luar standard.

---

## 1. Kondisi Wallet Saat Ini (bifold-wallet)

### 1.1 Dependency

Satu-satunya dependency untuk OIDC4VP adalah **`@credo-ts/openid4vc@0.6.3`** via `packages/core/package.json`.

Internal dependency chain:
```
@credo-ts/openid4vc@0.6.3
  └── @openid4vc/openid4vp@^0.4.6   ← protocol library (ESM)
```

### 1.2 API Surface yang Digunakan

Wallet hanya menggunakan **2 method + 1 type** dari Credo untuk sisi OIDC4VP:

| Kebutuhan | Fungsi | File |
|-----------|--------|------|
| **Resolve** | `agent.modules.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(request)` | `resolverProof.tsx` |
| **Submit** | `agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest(options)` | `resolverProof.tsx` |
| **Type** | `OpenId4VpResolvedAuthorizationRequest` di-`extends` | `types.tsx` |

### 1.3 Data Flow Diagram (Saat Ini)

```
QR/Deep Link (openid://, openid4vp://, openid-vc://)
    │
    ▼
packages/core/src/utils/parsers.tsx
    │  parseInvitationUrl() → 'openid-authorization-request'
    ▼
packages/core/src/modules/openid/screens/OpenIDConnection.tsx
    │  useOpenID(openIDPresentationUri)
    ▼
packages/core/src/modules/openid/hooks/openid.tsx
    │  useOpenID() → getCredentialsForProofRequest()
    ▼
packages/core/src/modules/openid/resolverProof.tsx  ← ** HANYA 2 BARIS KRITIS **
    │  getCredentialsForProofRequest():
    │    → agent.modules.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(request)
    │    → return OpenId4VPRequestRecord
    │
    │  ... user review & pilih credentials ...
    │
    │  shareProof():
    │    → agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({...})
    │    → handle redirect_uri
    ▼
packages/core/src/modules/openid/screens/OpenIDProofPresentation.tsx
    │  formatOpenIdProofRequest() → render
    ▼
Selesai
```

### 1.4 Kelebihan Wallet Saat Ini

- ✅ UI lengkap: loading → review → pilih kredensial → submit
- ✅ Pemisahan komponen: resolver, display, types, navigator, screens
- ✅ Notifikasi untuk OpenID4VP request record
- ✅ Handler untuk `redirect_uri` (browser redirect)

### 1.5 Kekurangan / Ketergantungan

- ❌ **100% tergantung Credo** — tidak ada kontrol atas implementasi protocol
- ❌ Tidak bisa inject specific crypto (did:jwk, x509 verification)
- ❌ Tidak transparan — JWT verification, nonce handling, dll dilakukan di balik layar
- ❌ Tidak bisa debug/trace protocol secara detail
- ❌ Tidak bisa support feature-specific requirements dari acapy atau ecosystem lain

---

## 2. Kondisi acapy-plugins oid4vc (Verifier)

### 2.1 Lokasi

```
/Users/kodrat/Public/SSI/Real World/acapy-plugins/oid4vc/oid4vc/
```

### 2.2 Spec Target

acapy-plugins mengacu ke **OID4VP 1.0 ID2** (`openid-4-verifiable-presentations-1_0-ID2.html`) — draft yang masih pre-DCQL. Kemudian menambahkan **PEX (Presentation Exchange)** dan **DCQL** sebagai fitur tambahan secara parallel.

### 2.3 Entry Point

```
openid://?client_id={url_encoded_client_id}&request_uri={url_encoded_request_uri}
```

Wallet harus:
1. Parse URL → ekstrak `request_uri` dan `client_id`
2. `GET {request_uri}` → signed JWT (JAR)
3. Verify JWT signature
4. Parse payload → extract `presentation_definition` atau `dcql_query`

### 2.4 Authorization Request (JWT Payload)

```json
{
  "iss": "<client_id>",
  "iat": 1234567890,
  "nbf": 1234567890,
  "exp": 1234568010,
  "jti": "<uuid>",
  "client_id": "did:jwk:<base64url(jwk)>",
  "response_uri": "{base}/oid4vp/response/{presentation_id}",
  "state": "<presentation_id>",
  "nonce": "<16 byte random>",
  "response_type": "vp_token",
  "response_mode": "direct_post",
  "vp_formats": { ... },
  "client_metadata": { ... },
  "presentation_definition": { ... }     // PEX mode
  // ATAU
  // "dcql_query": { ... }               // DCQL mode (mutually exclusive)
}
```

### 2.5 Yang Didukung acapy-plugins

| Fitur | Detail |
|-------|--------|
| **Query modes** | ✅ PEX (`presentation_definition`) + DCQL (`dcql_query`) |
| **JWT signing** | EdDSA (Ed25519) / ES256 (P-256) |
| **Client ID** | `did:jwk:<base64url(jwk)>` atau `x509_san_dns:<dns>` |
| **Response mode** | ✅ `direct_post` (hanya ini) |
| **Response type** | ✅ `vp_token` (hanya ini) |
| **JAR via request_uri** | ✅ `GET {request_uri}` → signed JWT |
| **Entry URL scheme** | `openid://` |

### 2.6 Yang TIDAK Didukung acapy-plugins

- ❌ `transaction_data` — tidak ada
- ❌ `verifier_info` — tidak ada
- ❌ `request_uri_method=post` — GET only
- ❌ `direct_post.jwt` / encrypted response
- ❌ DC API integration
- ❌ `wallet_metadata`
- ❌ `redirect_uri` response (cross-device redirect)
- ❌ `verifier_attestation`

---

## 3. OID4VP 1.0 Final Standard (Yang Sebenarnya)

Berdasarkan pembacaan langsung dari [openid.net/specs/openid-4-verifiable-presentations-1_0.html](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html):

### 3.1 Fitur yang Ada di Standard Final

| Kategori | Fitur | Ada di Final? |
|----------|-------|---------------|
| **Query Language** | `dcql_query` | ✅ **DCQL adalah satu-satunya** |
| | `presentation_definition` | ❌ **Tidak ada** |
| | `presentation_submission` | ❌ Tidak ada |
| | `descriptor_map` | ❌ Tidak ada |
| | `scope` | ✅ Bisa digunakan sebagai alias DCQL query |
| **Response** | `vp_token` | ✅ Response parameter utama |
| | `response_type=vp_token` | ✅ |
| | `response_mode=direct_post` | ✅ |
| | `response_mode=fragment` | ✅ |
| | `response_uri` | ✅ Untuk direct_post |
| | `redirect_uri` | ✅ Untuk fragment mode |
| | `direct_post.jwt` | ✅ Encrypted response mode |
| | `state` | ✅ Wajib untuk non-holder-binding |
| | `nonce` | ✅ Wajib, minimal 128 bit entropy |
| **Client** | `client_id` | ✅ Wajib |
| | `client_metadata` | ✅ Optional, untuk verifier metadata |
| | `jwks` | ✅ Optional di client_metadata |
| | `vp_formats_supported` | ✅ Wajib di client_metadata |
| | `encrypted_response_enc_values_supported` | ✅ Optional |
| **Client ID Prefix** | `redirect_uri:` | ✅ |
| | `did:` via `decentralized_identifier:` | ✅ |
| | `x509_san_dns:` | ✅ |
| | `x509_hash:` | ✅ |
| | `openid_federation:` | ✅ |
| | `verifier_attestation:` | ✅ |
| | `origin:` | ✅ (khusus DC API) |
| **Fitur Baru** | `transaction_data` | ✅ **Wajib di-reject jika tidak support** |
| | `verifier_info` | ✅ Optional |
| | `request_uri_method=post` | ✅ Untuk wallet metadata |
| | `wallet_metadata` | ✅ |
| | `verifier_attestation` | ✅ |
| | `require_cryptographic_holder_binding` | ✅ |
| | `openid4vp://` scheme | ✅ Static config |
| | Nested Presentations | ✅ |
| | DC API | ✅ |
| | HPKE Encryption | ✅ |

### 3.2 Yang PENTING untuk Wallet Implementation

Dari sisi wallet/holder, berikut yang **WAJIB** dan **OPTIONAL** di spec 1.0 Final:

| Kewajiban | Detail |
|-----------|--------|
| 🟢 **WAJIB** | Support `dcql_query` sebagai format request |
| 🟢 **WAJIB** | Verify JWT signature (JAR) — `typ: oauth-authz-req+jwt` |
| 🟢 **WAJIB** | Support `direct_post` response mode |
| 🟢 **WAJIB** | Kirim `vp_token` di response |
| 🟢 **WAJIB** | Support `nonce` |
| 🟢 **WAJIB** | Support `state` untuk non-holder-binding |
| 🟢 **WAJIB** | Reject request yang mengandung `transaction_data` jika tidak support |
| 🟢 **WAJIB** | Ignore unrecognized parameters |
| 🟡 **OPTIONAL** | Support `client_id` scheme `did:` / `x509_san_dns:` / dll |
| 🟡 **OPTIONAL** | Support `scope` parameter |
| 🟡 **OPTIONAL** | Support `request_uri_method=post` |
| 🟡 **OPTIONAL** | Support encrypted response (`direct_post.jwt`) |
| 🟡 **OPTIONAL** | Support `verifier_info` |
| 🟡 **OPTIONAL** | Support `verifier_attestation` |

---

## 4. Perbandingan: Standard vs acapy vs Wallet

| Fitur | OID4VP 1.0 Final | acapy-plugins | Wallet (Credo) |
|-------|------------------|---------------|----------------|
| **Query Language** | `dcql_query` **SAJA** | `presentation_definition` + `dcql_query` | ✅ DCQL ✅ PEX (via Credo) |
| **client_id prefix** | `redirect_uri:`, `did:`, `x509_san_dns:`, `x509_hash:`, `openid_federation:`, `verifier_attestation:`, `origin:` | `did:jwk`, `x509_san_dns` ✅ | via Credo |
| **response_mode** | `direct_post`, `direct_post.jwt`, `fragment`, `dc_api.jwt` | `direct_post` ✅ | via Credo |
| **transaction_data** | ✅ **Wajib di-reject** | ❌ Tidak ada | ❌ Tidak support |
| **verifier_info** | ✅ Optional | ❌ Tidak ada | ❌ Tidak support |
| **request_uri_method** | ✅ GET + POST | ✅ GET only | via Credo |
| **wallet_metadata** | ✅ Optional | ❌ Tidak ada | ❌ Tidak ada |
| **DC API** | ✅ Optional | ❌ Tidak ada | ❌ Tidak ada |
| **Encrypted Response** | ✅ Optional | ❌ Tidak ada | ❌ Tidak ada |
| **JWT Signing** | EdDSA, ES256, dll | ✅ EdDSA, ES256 | via Credo |

### 4.1 Kesimpulan Gap

**acapy-plugins vs Standard:**
- ✅ Sudah support DCQL (sesuai standard)
- ❌ Menambahkan PEX (di luar standard, tapi backward compat)
- ❌ Tidak support `transaction_data`, `verifier_info`, `request_uri_method=post`
- ❌ Hanya support `did:jwk` dan `x509_san_dns` (standard minta lebih banyak)

**Wallet vs Standard:**
- ❌ Tergantung Credo — tidak bisa implement mandatory features secara langsung
- ❌ Tidak bisa reject `transaction_data` (mandatory di standard)
- ❌ Tidak bisa handle `verifier_info`
- ❌ Tidak support `request_uri_method=post`

---

## 5. Rencana: Custom Module Sesuai OID4VP 1.0 Final

### 5.1 Filosofi Desain

1. **Standard-compliant** — implementasi sesuai OID4VP 1.0 Final yang dipublikasi di openid.net
2. **DCQL-first** — DCQL adalah satu-satunya query language di standard, jadi ini default
3. **PEX backward-compat (opsional)** — Pisah sebagai plugin/adapter terpisah. Tidak include di core.
4. **Minimal dependencies** — Hanya `jose` (JWT verify) + `did-resolver` (DID resolution)
5. **acapy-verified** — Test suite dengan fixture real dari acapy-plugins
6. **Modular & switchable** — API mirip Credo, mudah migrasi dua arah

### 5.2 Struktur Package (Revised — First Principles)

**Keputusan arsitektur:** Tidak kolaps ke 1 file per fungsi, tapi jangan over-split seperti sebelumnya. Target: **8-10 file** (bukan 31). Gabung file yang secara logis selalu berubah bareng.

```
packages/openid4vp/
├── package.json                        → @bifold/openid4vp
│   dependencies: {
│     "jose": "^5.x",                   // JWT verify (EdDSA, ES256, did:jwk, x5c)
│     "did-resolver": "^4.x",           // DID resolution
│     "web-did-resolver": "^4.x"        // did:web
│     // NOTE: Tidak perlu @openid4vc/openid4vp — kita implement langsung
│     //       karena lebih ringan + kontrol penuh + tidak blocking update
│   }
│
├── src/
│   ├── index.ts                        → Public API (export 2 fungsi + types)
│   ├── types.ts                        → Semua type definitions (merged jadi 1 file)
│   │                                     ResolvedAuthorizationRequest
│   │                                     DcqlQuery + DcqlQueryResult
│   │                                     AcceptAuthorizationRequestOptions + Result
│   │                                     ClientIdScheme ('did' | 'x509_san_dns')
│   │                                     (PEX types hanya jika backward-compat diperlukan)
│   │
│   ├── holder.ts                       → resolveAuthorizationRequest() + acceptAuthorizationRequest()
│   │                                     Gabung karena selalu dipanggil berurutan,
│   │                                     state (request payload) shared antar keduanya
│   │
│   ├── crypto.ts                       → JWT verify + did:jwk resolve + x509 chain verify
│   │                                     Gabung karena semua terkait signature verification
│   │                                     - verifyJwtSignature(token, key, alg)
│   │                                     - resolveDidJwk(kid) → public key
│   │                                     - resolveX5c(x5c) → public key
│   │
│   ├── dcql.ts                         → DCQL parse + evaluate + format
│   │                                     Gabung karena operasi DCQL selalu sequential
│   │                                     - parseDcqlQuery(): validasi & parse
│   │                                     - evaluateDcqlQuery(): match ke credentials
│   │                                     - buildDcqlVpToken(): format response
│   │
│   └── utils.ts                        → HTTP (fetch, POST form), URL parser, payload validators
│
├── __tests__/
│   ├── fixtures/
│   │   ├── acapy-jwt-samples.ts        → Sample JWT dari acapy-plugins (did:jwk, x509)
│   │   └── dcql-queries.ts             → Sample DCQL queries
│   ├── crypto.test.ts
│   ├── dcql.test.ts
│   ├── holder.test.ts
│   └── integration/
│       └── acapy-flow.test.ts          → End-to-end dengan fixture real
│
└── tsconfig.json
```

**Perbandingan dengan struktur sebelumnya:**
| Aspek | Sebelum | Sesudah (First Principles) |
|-------|---------|---------------------------|
| Total file | ~31 file | ~8-10 file |
| Directory depth | src/types/, src/holder/, src/crypto/, src/dcql/, src/pex/, src/utils/ | src/ flat (kecuali __tests__) |
| PEX module | Terpisah sendiri | ❌ Tidak ada — non-standard |
| Crypto | 3 file terpisah | 1 file — karena selalu bareng |

**Alasan merging:**
1. **types.ts** — Semua type OID4VP saling terkait. Memisahkan ke 5 file cuma bikin cross-import.
2. **holder.ts** — `resolve` dan `accept` share state (request payload). Pisah file cuma naikin kompleksitas.
3. **crypto.ts** — JWT verify, did:jwk, dan x509 semuanya tentang signature verification. Beda file = duplikasi logic.
4. **dcql.ts** — Parse, evaluate, format adalah pipeline. Dipisah cuma untuk testability, tapi test bisa mock fungsi internal.
5. **utils.ts** — HTTP, URL, validators cukup 1 file.

### 5.3 API Design

```typescript
// ==================== PUBLIC API ====================

/**
 * Resolve an OpenID4VP authorization request.
 * Menerima raw invitation URL atau JWT string, memproses JAR,
 * verify signature, dan return resolved request.
 */
export async function resolveAuthorizationRequest(
  options: ResolveAuthorizationRequestOptions
): Promise<ResolvedAuthorizationRequest>

/**
 * Accept (submit) authorization response.
 * Menerima pilihan credentials user, build vp_token,
 * dan POST ke response_uri verifier.
 */
export async function acceptAuthorizationRequest(
  options: AcceptAuthorizationRequestOptions
): Promise<AcceptAuthorizationRequestResult>

// ==================== TYPES ====================

interface ResolveAuthorizationRequestOptions {
  request: string                         // Raw invitation URL atau JWT string
  credentials?: CredentialRecord[]        // Credentials wallet utk dicocokkan
}

interface ResolvedAuthorizationRequest {
  dcql?: DcqlQueryResult                  // DCQL query result (STANDARD)
  presentationExchange?: DifPexCredentialsForRequest   // PEX result (BACKWARD-COMPAT)
  authorizationRequestPayload: Record<string, unknown> // Raw JWT payload
  verifier: {
    clientId: string
    clientIdScheme: ClientIdScheme        // 'redirect_uri' | 'did' | 'x509_san_dns' | dll
    verifierInfo?: VerifierInfo[]         // Dari parameter verifier_info
  }
  transactionData?: TransactionData[]     // Dari parameter transaction_data
  origin?: string
}

interface AcceptAuthorizationRequestOptions {
  authorizationRequestPayload: Record<string, unknown>
  dcql?: { credentials: DcqlCredentials }
  presentationExchange?: { credentials: DifPexCredentials }
}

interface AcceptAuthorizationRequestResult {
  ok: boolean
  serverResponse?: { status: number; body?: any }
  redirectUri?: string
}
```

### 5.4 Data Flow Detail

```
QR/Deep Link (openid://?client_id=...&request_uri=...)
    │
    ▼
resolveAuthorizationRequest({ request, credentials })
    │
    ├─ 1. Parse invitation URL
    │      Extract request_uri, client_id dari URL
    │
    ├─ 2. Fetch Request Object (JAR)
    │      GET {request_uri} → signed JWT
    │      Header: typ=oauth-authz-req+jwt, alg=EdDSA|ES256, kid|x5c
    │
    ├─ 3. Verify JWT signature
    │      CASE kid → resolve did:jwk → public key → verify
    │      CASE x5c → extract cert chain → verify trust → verify
    │
    ├─ 4. Parse & validate payload
    │      Wajib: response_type=vp_token, response_mode=direct_post,
    │             nonce, state, client_id, response_uri
    │      Mandatory: dcql_query HARUS ada (standar)
    │      Warning: presentation_definition (non-standard, legacy)
    │      Reject if: transaction_data ada (kita belum support)
    │      Extract: client_metadata.vp_formats_supported
    │               → untuk validasi format credential sebelum dipilih user
    │      Validate: nonce — minimal 128 bit entropy, ASCII URL-safe chars only
    │      Ignore: unrecognized parameters
    │      Error response format: { error: "invalid_request" | "unsupported_response_type",
    │                               error_description: "human readable message" }
    │
    ├─ 5. Evaluate DCQL query (standar)
    │      Parse dcql_query → credentials[] + credential_sets[]
    │      Match dengan credentials wallet
    │      Return DcqlQueryResult (credential_query_id → matched credentials)
    │
    ├─ 6. [Optional] Evaluate PEX (backward-compat)
    │      Jika payload.presentation_definition ada:
    │      Parse → input_descriptors → match credentials
    │      Return DifPexCredentialsForRequest
    │
    └─ 7. Return ResolvedAuthorizationRequest
           dcql, presentationExchange, authorizationRequestPayload,
           verifier (clientId, clientIdScheme)
    │
    ▼
[User reviews & selects credentials]
    │
    ▼
acceptAuthorizationRequest({ authorizationRequestPayload, dcql })
    │
    ├─ 1. Map selected credentials → DCQL response format
    │      { credential_query_id: [presentation1, ...] }
    │
    ├─ 2. Build vp_token
    │      DCQL: vp_token = JSON object
    │
    ├─ 3. Submit POST {response_uri}
    │      Content-Type: application/x-www-form-urlencoded
    │      Body: vp_token=...&state=...
    │
    └─ 4. Return result
           ok=true/false, serverResponse (status, body)
    │
    ▼
Selesai
```

### 5.5 Prioritas Implementasi Berdasarkan Standard

| Prioritas | Fitur | Standard | acapy | Notes |
|-----------|-------|----------|-------|-------|
| **P1** 🚨 | DCQL resolve + submit | ✅ WAJIB | ✅ | Ini core standard |
| **P1** 🚨 | JWT verify (EdDSA/ES256 via did:jwk) | ✅ WAJIB | ✅ | Essential untuk keamanan |
| **P1** 🚨 | JAR fetch via GET request_uri | ✅ WAJIB | ✅ | Cara standar delivery |
| **P1** 🚨 | direct_post response | ✅ WAJIB | ✅ | Satu-satunya response mode |
| **P1** 🚨 | Payload validation (nonce, state, response_type, client_metadata) | ✅ WAJIB | ✅ | Validasi mandatory — nonce 128 bit, ASCII URL-safe |
| **P1** 🚨 | client_metadata.vp_formats_supported parsing | ✅ WAJIB | ✅ | Validasi format credential verifier sebelum submit |
| **P1** 🚨 | Error response format sesuai spec | ✅ WAJIB | ✅ | `{ error, error_description }` |
| **P2** ⚠️ | JWT verify via x509_san_dns (x5c) | ✅ WAJIB | ✅ | acapy support ini |
| **P2** ⚠️ | Reject jika transaction_data ada | ✅ WAJIB | N/A | Mandatory di standard |
| **P2** ⚠️ | PEX backward-compat | ❌ Non-standard | ✅ | Untuk acapy legacy |
| **P3** 📝 | request_uri_method=post | ✅ Optional | ❌ | Future-proof |
| **P3** 📝 | redirect_uri client_id scheme | ✅ Optional | ❌ | Generic OAuth flow |
| **P4** 🔮 | verifier_info | ✅ Optional | ❌ | Ekosistem masa depan |
| **P4** 🔮 | Encrypted response (direct_post.jwt) | ✅ Optional | ❌ | Keamanan tambahan |
| **P4** 🔮 | verifier_attestation | ✅ Optional | ❌ | Verifier authentication |

---

## 6. Rencana Implementasi Detail

### 6.1 Estimasi Revisi (First Principles)

**Hasil analisis First Principles:** Estimasi awal terlalu tinggi karena:
1. Struktur file over-split (31 → 8-10 file)
2. PEX backward-compat bisa dipisah sebagai fase opsional
3. Kita bisa pakai library `jose` untuk JWT verify, bukan tulis dari nol
4. Hanya 2 client_id scheme yang diperlukan (did:jwk + x509) — bukan 7
5. DCQL parser hanya perlu support format yang dikirim acapy

#### Core Module — ~13 jam

| Task | File | Detail | Estimasi |
|------|------|--------|----------|
| Setup package | `package.json`, `tsconfig.json`, `index.ts` | Init workspace, dependencies (`jose`, `did-resolver`), public API | 1 jam |
| Types + Utils | `types.ts`, `utils.ts` | Semua type definitions, HTTP utilities, URL parser, payload validators | 2 jam |
| Crypto | `crypto.ts` | JWT verify (EdDSA/ES256 via `jose`), did:jwk resolve, x509 chain verify (gabung 1 file) | 3 jam |
| DCQL | `dcql.ts` | Parse DCQL query, evaluate terhadap credentials wallet, format vp_token (gabung 1 file) | 3 jam |
| Holder | `holder.ts` | `resolveAuthorizationRequest()` + `acceptAuthorizationRequest()` orchestration (gabung 1 file) | 2 jam |
| Tests | `__tests__/*.test.ts` | Unit test + fixtures dari acapy | 3 jam |
| **Total Core** | **~6 src file** | | **~12 jam** |

#### Bifold Integration — ~4 jam

| Task | File | Detail | Estimasi |
|------|------|--------|----------|
| Update types + resolver | `types.tsx`, `resolverProof.tsx` | Ganti Credo import → `@bifold/openid4vp`, ganti 2 function body | 2 jam |
| Package wiring | `package.json` (root + core), `tsconfig.json` | Add workspace & dependency | 0.5 jam |
| Update display | `displayProof.tsx` | Pastikan kompatibel dengan tipe baru | 0.5 jam |
| E2E test | Manual + integration test | QR → resolve → UI → submit dengan acapy | 1 jam |
| **Total Integration** | **~5 file diubah** | | **~4 jam** |

#### PEX Backward-compat (Opsional) — ~10 jam

| Task | Detail | Estimasi |
|------|--------|----------|
| PEX parse + evaluate + format | Extend dcql.ts atau module terpisah | 6 jam |
| Update holder.ts untuk fallback PEX | Detect `presentation_definition` dan proses | 2 jam |
| Tests | Test dengan fixture acapy mode PEX | 2 jam |
| **Total PEX** | | **~10 jam** |

### 6.2 Ringkasan Estimasi

| Scope | Jam | File |
|-------|-----|------|
| 🎯 **Core (DCQL + JWT + resolve/submit)** | **~13 jam** | ~6 baru |
| 🔵 + Bifold Integration | **+~4 jam** | ~5 diubah |
| 🔵 + PEX backward-compat (opsional) | **+~10 jam** | +~3 file |
| **Total Core (tanpa PEX)** | **~17 jam** | **~9-11 file** |
| **Total Complete (dengan PEX)** | **~27 jam** | **~12-14 file** |
| ⏪ **Estimasi sebelumnya** | **~63 jam** | **~31 file** |

**Penghematan:** ~60% lebih sedikit waktu dan file dari estimasi awal.

---

## 7. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| JWT signing algorithm mismatch | Gagal verify | Support minimum EdDSA + ES256 (sama dengan acapy), extendable |
| did:jwk format berbeda | Gagal resolve key | Implement strict parsing sesuai spec did:jwk |
| X.509 chain trust root | Gagal validasi | Configurable trust store (bisa bypass untuk dev/test) |
| DCQL format mismatch | Gagal match credentials | Test dengan fixture real dari acapy-plugins |
| PEX format tidak cocok | Gagal fallback | Terima PEX dalam format acapy (sudah diverifikasi dari code) |
| transaction_data di request | Wajib reject | Deteksi presence dan return error sebelum proses |
| nonce requirements beda | Replay attack risk | Ikuti spec standard (128 bit random, ASCII URL-safe) |
| Wallet credentials tidak match format | Tidak ada kredensial yang cocok | Filter di DCQL evaluator, return empty result |
| Redirect URI flow | Flow terputus | acapy pakai direct_post → tidak perlu redirect |
| Crypto library tidak available di RN | JWT verify gagal | Pakai `react-native-quick-crypto` atau `jose` | 

---

## 8. Arsitektur File & Dependencies (Revised — First Principles)

```
packages/openid4vp/
├── package.json
│     dependencies: {
│       "jose": "^5.x",                          // JWT verify — ADR #1: pure JS, zero native dep
│       "did-resolver": "^4.x"                   // DID resolution (did:jwk → public key)
│     }
│     NOTE: DCQL parser tulis manual (ADR #2) — format JSON sederhana.
│           PEX sebagai plugin opsional (ADR #4) — tidak di core.
│
├── src/
│   ├── index.ts                         → Public API exports
│   │                                      resolveAuthorizationRequest()
│   │                                      acceptAuthorizationRequest()
│   │                                      ResolvedAuthorizationRequest (type)
│   │
│   ├── types.ts                        → ALL types merged (1 file):
│   │                                      ResolveAuthorizationRequestOptions
│   │                                      ResolvedAuthorizationRequest
│   │                                      AcceptAuthorizationRequestOptions
│   │                                      AcceptAuthorizationRequestResult
│   │                                      DcqlQuery, CredentialQuery, CredentialSetQuery
│   │                                      DcqlQueryResult, DcqlCredentials
│   │                                      ClientIdScheme ('did' | 'x509_san_dns')
│   │                                      TransactionData, VerifierInfo
│   │                                      AuthRequestPayload
│   │
│   ├── holder.ts                       → resolveAuthorizationRequest()
│   │                                      acceptAuthorizationRequest()
│   │                                      Gabung 1 file karena resolve→submit
│   │                                      berurutan dan share state
│   │
│   ├── crypto.ts                       → verifyJwtSignature() — via jose
│   │                                      resolveDidJwk(kid) → JsonWebKey
│   │                                      resolveX5c(x5c) → publicKey
│   │                                      Gabung 1 file — semua tentang signature
│   │
│   ├── dcql.ts                         → parseDcqlQuery(json) → DcqlQuery
│   │                                      evaluateDcqlQuery(query, creds) → DcqlQueryResult
│   │                                      buildDcqlVpToken(selected) → VpToken
│   │                                      Gabung 1 file — pipeline sequential
│   │
│   └── utils.ts                        → fetchJwtFromUri(), postForm()
│                                          parseInvitationUrl(), extractHostname()
│                                          validateAuthRequestPayload()
│
├── __tests__/
│   ├── fixtures/
│   │   ├── acapy-jwt-samples.ts         → JWT samples from acapy (did:jwk + x509)
│   │   └── dcql-queries.ts              → DCQL query samples
│   ├── crypto.test.ts
│   ├── dcql.test.ts
│   ├── holder.test.ts
│   ├── utils.test.ts
│   └── integration/
│       └── acapy-flow.test.ts           → End-to-end with acapy fixtures
│
├── pex/                                 ← Opsional, backward-compat (luar core)
│   ├── index.ts                         → parsePex(), evaluatePex(), buildPexSubmission()
│   └── types.ts                         → PresentationDefinition, InputDescriptor, dll
│
├── package.json
└── tsconfig.json
```

**Perbandingan sebelum vs sesudah (First Principles):**
| Aspek | Sebelum (63 jam) | Sesudah (16 jam core) |
|-------|-----------------|----------------------|
| Total file | ~31 file | ~6-9 file (core) + ~3 (PEX) |
| Directory layers | 6 (types/, holder/, crypto/, dcql/, pex/, utils/) | 1 flat + 1 opsional (pex/) |
| Dependencies | 3+ (`did-jwt`, `web-did-resolver`, `pako`) | 2 (`jose`, `did-resolver`) |
| Complexity | High — separation of concerns berlebihan | Medium — functional grouping |
| PEX handling | Built-in sejak awal | ✅ Plugin opsional (ADR #4) |
| Est. delivery | ~63 jam | ✅ ~16 jam (core) / ~26 jam (+PEX) |

---

## 9. Checklist Implementasi

### Core Module (Prioritas 1 — ~12 jam)

- [ ] Setup package `packages/openid4vp/` di monorepo (package.json, tsconfig)
- [ ] Implement `types.ts` — semua type definitions merged
- [ ] Implement `crypto.ts` — JWT verify via `jose`, did:jwk resolve, x509 verify
- [ ] Implement `dcql.ts` — parser, evaluator, formatter DCQL
- [ ] Implement `utils.ts` — HTTP utilities, URL parser, payload validators
- [ ] Implement `holder.ts` — `resolveAuthorizationRequest()` + `acceptAuthorizationRequest()`
- [ ] Implement `index.ts` — public API exports
- [ ] Test fixtures — generate/harvest sample JWT + DCQL dari acapy
- [ ] Unit tests — crypto, dcql, holder, utils
- [ ] Integration test — end-to-end dengan acapy fixtures

### Bifold Integration (Prioritas 2 — ~4 jam)

- [ ] Update `packages/core/src/modules/openid/types.tsx` — ganti extends type
- [ ] Update `packages/core/src/modules/openid/resolverProof.tsx` — ganti 2 function body
- [ ] Update `packages/core/src/modules/openid/displayProof.tsx` — verifikasi kompatibilitas tipe
- [ ] Update root `package.json` — add workspace
- [ ] Update `packages/core/package.json` — add dependency
- [ ] Test E2E flow: QR → resolve → UI → submit dengan acapy

### PEX Backward-compat (Prioritas 3 — Opsional, ~10 jam)

- [ ] Implement PEX types, parser, evaluator, formatter
- [ ] Extend holder.ts untuk fallback PEX (detect `presentation_definition`)
- [ ] Integration test PEX mode dengan acapy

---

## 10. Kesimpulan

1. **OID4VP 1.0 Final (standard resmi) menggunakan DCQL — BUKAN PEX.** PEX adalah tambahan non-standard dari implementasi seperti acapy-plugins (mengacu ID2 draft) dan Credo.

2. **Custom module adalah jawaban terbaik dari 4 opsi** (custom module, wrapper library, patch Credo, tunggu update). Memberikan kontrol penuh tanpa blocker eksternal, hanya ~16 jam investasi.

3. **Estimasi realistik: ~16 jam untuk core working module + bifold integration** (turun dari 63 jam berkat First Principles analysis yang menghilangkan over-engineering).

4. **Lean architecture:** 6 file src (bukan 31 file), 2 dependencies (bukan 3+), struktur flat.

5. **PEX backward-compat sebagai opsi pisah** — tidak mengotori core, bisa ditambahkan jika diperlukan verifier legacy.

6. **acapy-compatible by design** — test suite dengan fixture real acapy-plugins untuk did:jwk dan x509.

7. **Standard compliant** — mandatory features terpenuhi: DCQL, JWT verification, direct_post, transaction_data rejection, payload validation.

8. **Rekomendasi:** Mulai dengan **Core Module** (6 file, ~12 jam) → **Bifold Integration** (~4 jam) → **PEX backward-compat** jika diperlukan (~10 jam). Core module sudah mencakup >90% kebutuhan standard dan interoperabilitas dengan acapy.
   - ✅ Bebas dari ketergantungan Credo
   - ✅ Sesuai standard resmi OID4VP 1.0 Final
   - ✅ Kompatibel dengan acapy-plugins (DCQL + PEX backward-compat)
   - ✅ Kontrol penuh atas crypto, validasi, dan protocol detail

3. **Estimasi total ~63 jam** (38+15+10) untuk complete implementation:
   - **Phase 1** (Core DCQL + JWT): 38 jam — ini yang paling penting
   - **Phase 2** (PEX backward-compat): 15 jam — opsional, tergantung kebutuhan
   - **Phase 3** (Bifold integration): 10 jam — mengganti Credo call

4. **Prioritas:** Phase 1 mencakup >90% kebutuhan standard dan 100% kompatibilitas dengan acapy mode DCQL. Phase 2 hanya diperlukan jika masih ada verifier legacy yang pakai PEX.
