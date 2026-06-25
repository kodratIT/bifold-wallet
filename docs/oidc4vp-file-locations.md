# OIDC4VP — Struktur File & Lokasi

Dokumen ini memetakan semua file yang terkait dengan implementasi **OpenID4VP (OpenID for Verifiable Presentations)** di sisi wallet/holder.

```
packages/core/src/
├── modules/openid/                  ← *** DIREKTORI UTAMA ***
│   ├── types.tsx                    → Tipe data (OpenId4VPRequestRecord, FormattedSubmission, etc.)
│   ├── credentialRecord.ts          → CRUD record, type guard isOpenIdProofRequestRecord()
│   ├── resolverProof.tsx            → getCredentialsForProofRequest() [resolve] + shareProof() [submit]
│   ├── displayProof.tsx             → formatOpenIdProofRequest() [format utk UI]
│   ├── hooks/
│   │   └── openid.tsx               → useOpenID() hook (resolve otomatis dari URI)
│   ├── screens/
│   │   ├── OpenIDConnection.tsx              → Screen loading awal (terima QR/deeplink)
│   │   ├── OpenIDProofPresentation.tsx       → Screen utama review & pilih kredensial
│   │   └── OpenIDProofChangeCredential.tsx   → Screen ganti kredensial alternatif
│   ├── features/OpenIDProofPresentation/
│   │   ├── OpenIDProofRequestDisplay.tsx     → Assembler komponen (header+body+footer)
│   │   ├── components/
│   │   │   ├── OpenIDProofRequestHeader.tsx  → Header (nama verifier, purpose)
│   │   │   ├── OpenIDProofRequestBody.tsx    → Body (daftar kredensial & atribut)
│   │   │   └── OpenIDProofRequestFooter.tsx  → Footer (tombol Send/Decline/Dismiss)
│   │   └── ...
│   ├── components/
│   │   └── OpenIDUnsatisfiedProofRequest.tsx → Komponen bila kredensial tdk memenuhi syarat
│   └── utils/
│       └── utils.tsx               → getHostNameFromUrl(), isW3CProofRequest(), etc.
│
├── utils/
│   └── parsers.tsx                 → isOpenIdPresentationRequest(), parseInvitationUrl()
│
├── types/
│   └── navigators.ts               → Screen enum (OpenIDProofPresentation, etc.)
│
├── navigators/
│   ├── DeliveryStack.tsx            → Registrasi screen OIDC4VP di navigator
│   ├── defaultLayoutOptions.tsx     → Layout options
│   └── defaultStackOptions.tsx      → Stack options
│
└── hooks/
    └── notifications.ts            → OpenId4VPRequestRecord masuk notifikasi

packages/core/__tests__/modules/openid/
├── resolverProof.test.ts            → Test resolve & shareProof
└── credentialRecord.test.ts         → Test type guard & CRUD

samples/app/
└── index.js                        → Polyfill base64 utk openID4VP
```

---

## Alur Data (End-to-End)

```
QR/Deep Link (openid4vp://, openid://, openid-vc://)
    │
    ▼
parsers.tsx — parseInvitationUrl()
    │  mengklasifikasi sebagai 'openid-authorization-request'
    ▼
OpenIDConnection.tsx — screen loading
    │  menerima parameter openIDPresentationUri
    ▼
hooks/openid.tsx — useOpenID()
    │  memanggil getCredentialsForProofRequest()
    ▼
resolverProof.tsx — getCredentialsForProofRequest()
    │  → agent.modules.openid4vc.holder.resolveOpenId4VpAuthorizationRequest()
    │  → return OpenId4VPRequestRecord
    ▼
OpenIDProofPresentation.tsx — screen review
    │  → displayProof.tsx — formatOpenIdProofRequest() → FormattedSubmission
    │  → user pilih kredensial
    ▼
resolverProof.tsx — shareProof()
    │  → agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest()
    │  → redirect_uri (browser)
```

---

## Dependency Eksternal

| Package | Lokasi |
|---------|--------|
| `@credo-ts/openid4vc` | `node_modules/@credo-ts/openid4vc/build/openid4vc-holder/` |
| `OpenId4VpHolderService` | `OpenId4VpHolderService.d.mts` — `resolveAuthorizationRequest()` & `acceptAuthorizationRequest()` |
| `@openid4vc/openid4vp` | Dependency internal dari `@credo-ts/openid4vc` |

---

## Ringkasan Fungsi per File

| File | Fungsi Utama |
|------|-------------|
| `resolverProof.tsx` | Entry & exit point OIDC4VP (resolve → share) |
| `displayProof.tsx` | Format data untuk rendering UI |
| `types.tsx` | Definisi tipe data OIDC4VP |
| `credentialRecord.ts` | CRUD & type guard record |
| `hooks/openid.tsx` | React hook OIDC4VP + OIDC4VCI |
| `parsers.tsx` | Deteksi URI OIDC4VP masuk |
| `OpenIDConnection.tsx` | Screen loading awal |
| `OpenIDProofPresentation.tsx` | Screen utama review presentasi |
| `OpenIDProofRequestHeader.tsx` | Header verifier |
| `OpenIDProofRequestBody.tsx` | Body daftar atribut |
| `OpenIDProofRequestFooter.tsx` | Footer tombol aksi |
