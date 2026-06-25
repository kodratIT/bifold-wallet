# Project Brief: Custom OID4VP Module untuk Bifold Wallet

**Dokumen untuk Stakeholder**
**Versi:** 1.0 | **Tanggal:** 23 Juni 2026 | **Penulis:** Tim Pengembangan

---

## 1. Ringkasan Eksekutif

Bifold Wallet saat ini menggunakan library **`@credo-ts/openid4vc`** untuk komunikasi OID4VP (OpenID for Verifiable Presentations) dengan verifier. Library ini menghambat fleksibilitas karena:

- **Tidak bisa mengikuti perkembangan spesifikasi terbaru** — tergantung rilis pihak ketiga
- **Tidak kompatibel penuh dengan verifier acapy** yang digunakan di ekosistem kita
- **Terdapat fitur yang tidak digunakan** — kita hanya memakai 2 fungsi dari puluhan yang tersedia

**Solusi:** Membangun modul khusus OID4VP (`@bifold/openid4vp`) yang independen, sesuai standar, dan kompatibel dengan verifier acapy.

**Estimasi:** 17 jam kerja untuk core module + integrasi.

---

## 2. Latar Belakang

### 2.1. Kondisi Saat Ini

```
Wallet (existing):                  Verifier (acapy):
                                    ┌──────────────────────┐
┌──────────────────────┐            │  OID4VP Final (ID3)  │
│  resolverProof.tsx   │───────────▶│  client_id: did:jwk  │
│  (2 baris kritis)    │◀───────────│  vp_formats: ...     │
│          │           │  response  │  DCQL / PEX queries  │
│          ▼           │            │  direct_post submit  │
│  @credo-ts/openid4vc │            └──────────────────────┘
│  @openid4vc/openid4vp│
└──────────────────────┘
```

Bifold wallet hanya menggunakan **2 fungsi** dari Credo untuk OID4VP:
1. `resolveOpenId4VpAuthorizationRequest()` — memproses permintaan verifier
2. `acceptOpenId4VpAuthorizationRequest()` — mengirim response

### 2.2. Masalah

| Masalah | Dampak |
|---------|--------|
| Credo rilis tidak sinkron dengan kebutuhan | Tidak bisa update ke spesifikasi terbaru |
| Library pihak ketiga mengandung banyak fitur yang tidak dipakai | Ukuran bundle lebih besar |
| Ketergantungan pada ekosistem Credo | Jika Credo berhenti support, wallet ikut terdampak |
| Tidak ada kontrol penuh atas verifikasi JWT dan crypto | Risiko keamanan tidak terkelola langsung |

---

## 3. Ruang Lingkup (Scope)

### ✅ Termasuk (In Scope)

| Fitur | Keterangan |
|-------|------------|
| **DCQL resolve & submit** | Menerima dan memproses permission verifier menggunakan DCQL — sesuai standar OID4VP 1.0 Final |
| **JWT verification** | Verifikasi tanda tangan JWT (EdDSA/ES256) melalui `did:jwk` dan `x509_san_dns` |
| **JAR fetch via GET** | Mengambil Request Object dari endpoint verifier |
| **direct_post response** | Mengirim response ke verifier via HTTP POST |
| **Payload validation** | Validasi nonce, state, response_type, dan parameter wajib lainnya |
| **client_metadata parsing** | Mengekstrak format credential yang didukung verifier |
| **transaction_data rejection** | Menolak request yang memerlukan fitur transaction_data |
| **PEX backward-compat** (opsional) | Dukungan untuk verifier legacy yang masih menggunakan Presentation Exchange |

### ❌ Tidak Termasuk (Out of Scope)

Modul ini **hanya** untuk komunikasi OID4VP. Semua fitur berikut **sudah ada** di wallet dan tidak berubah:

- ❌ UI/UX screens (review, pilih credential, submit)
- ❌ Credential storage dan management
- ❌ Credential matching dan evaluasi (format mana yang cocok)
- ❌ OIDC4VCI (issuance) — hanya issuance via OID4VP
- ❌ Notifikasi
- ❌ Navigasi dan routing

---

## 4. Metode & Pendekatan

### 4.1. Arsitektur

```
┌────────────────────────────────────────────────────────────┐
│                   Bifold Wallet                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  packages/core/src/modules/openid/                    │  │
│  │  ├─ resolverProof.tsx  ← 2 baris diubah             │  │
│  │  ├─ types.tsx          ← 1 type diubah              │  │
│  │  ├─ displayProof.tsx   ← minor adjustment            │  │
│  │  └─ ... (tidak berubah)                              │  │
│  └──────────┬───────────────────────────────────────────┘  │
│             │ import @bifold/openid4vp                     │
│             ▼                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  @bifold/openid4vp (CUSTOM MODULE)                    │  │
│  │                                                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │  │
│  │  │ holder.ts│  │ crypto.ts│  │ dcql.ts          │    │  │
│  │  │ resolve  │  │ JWT      │  │ parser           │    │  │
│  │  │ accept   │  │ did:jwk  │  │ evaluator        │    │  │
│  │  │          │  │ x509     │  │ formatter        │    │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘    │  │
│  │  ┌──────────┐  ┌──────────┐                           │  │
│  │  │ types.ts │  │ utils.ts │                           │  │
│  │  └──────────┘  └──────────┘                           │  │
│  └──────────────────────────────────────────────────────┘  │
│             │                                              │
│             ▼ HTTP POST                                    │
│  ┌──────────────────────┐                                  │
│  │  acapy Verifier      │                                  │
│  └──────────────────────┘                                  │
└────────────────────────────────────────────────────────────┘
```

**Prinsip desain:**
- **Minimal dependencies** — hanya `jose` (JWT) dan `did-resolver`
- **Struktur flat** — 6 file source code (bukan 31)
- **DCQL-first** — sesuai standar OID4VP 1.0 Final
- **PEX sebagai plugin terpisah** — tidak mengotori core

### 4.2. Strategi "Credo-switchable"

API modul dibuat serupa dengan Credo, sehingga jika suatu saat Credo mendukung spesifikasi yang dibutuhkan, wallet bisa kembali menggunakan Credo dengan perubahan minimal:

```typescript
// OPSI A: Custom module (sekarang)
import { resolveAuthorizationRequest } from '@bifold/openid4vp'

// OPSI B: Credo (masa depan — jika sudah support)
// import { agent } from '../agent'
// const resolveAuthorizationRequest = (opts) =>
//   agent.modules.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(opts.request)
```

---

## 5. Timeline & Estimasi

### Fase 1: Core Module (13 jam)

| Pekerjaan | Jam | Output |
|-----------|-----|--------|
| Setup package & dependencies | 1 jam | `packages/openid4vp/` siap |
| Types + HTTP + URL + validators | 2 jam | Utility functions |
| JWT verify (EdDSA/ES256 via `jose`) + did:jwk + x509 | 3 jam | `crypto.ts` |
| DCQL parser + evaluator + formatter | 3 jam | `dcql.ts` |
| Resolve + accept authorization | 2 jam | `holder.ts` |
| Unit tests + fixture | 3 jam | Test coverage |

### Fase 2: Integrasi Bifold (4 jam)

| Pekerjaan | Jam | Output |
|-----------|-----|--------|
| Update `types.tsx` & `resolverProof.tsx` | 2 jam | Ganti 2 baris + 1 type |
| Update `package.json` workspace | 0.5 jam | Dependency wiring |
| Update `displayProof.tsx` | 0.5 jam | Kompatibilitas tipe |
| E2E test | 1 jam | QR → resolve → UI → submit |

### Total: 17 Jam

### Fase Tambahan (Opsional): PEX Backward-compat

Jika diperlukan kompatibilitas dengan verifier legacy yang masih menggunakan Presentation Exchange (PEX), tambahan **10 jam**.

---

## 6. Perbandingan Sebelum & Sesudah

| Aspek | Sebelum (Credo) | Sesudah (Custom Module) |
|-------|-----------------|------------------------|
| **Ketergantungan** | `@credo-ts/openid4vc@0.6.3` + `@openid4vc/openid4vp@0.4.6` | `jose@^5.x` + `did-resolver@^4.x` |
| **Ukuran bundle** | ~50+ file library | ~6 file source |
| **Kontrol spesifikasi** | Tergantung rilis Credo | Langsung ikut OID4VP 1.0 Final |
| **Kontrol keamanan** | Opaque (dibalik library) | Transparan (kode sendiri) |
| **Kompatibilitas acapy** | Tidak terverifikasi | Terverifikasi via test fixture |
| **Estimasi maintenance** | Tinggi (banyak kode tidak dipakai) | Rendah (kode minimal) |
| **Total file berubah** | - | 6 baru + 5 dimodifikasi |

---

## 7. Risiko & Mitigasi

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Library `jose` tidak kompatibel React Native | Rendah | Tinggi | Verifikasi di awal sebelum coding; ada fallback `react-native-quick-crypto` |
| Perubahan spesifikasi OID4VP | Sedang | Sedang | Arsitektur modular; komponen bisa diupdate independen |
| Verifier acapy update format | Sedang | Sedang | Test suite dengan fixture; deteksi versi otomatis |
| Trusted root untuk x509 tidak jelas | Sedang | Sedang | Configurable trust store; bisa bypass untuk dev |
| Wallet credentials tidak cocok format | Rendah | Rendah | Deteksi mismatch sebelum submit |

---

## 8. Dampak Bisnis

| Dampak | Positif | Negatif |
|--------|---------|---------|
| **Time-to-market** | ✅ Bisa update spesifikasi kapan saja tanpa nunggu pihak ketiga | - |
| **Maintenance cost** | ✅ Kode lebih sedikit, lebih mudah dipahami | ⚠️ Perlu maintain modul sendiri |
| **Security** | ✅ Kontrol penuh atas verifikasi JWT dan crypto | - |
| **Interoperability** | ✅ Teruji kompatibel dengan acapy | ⚠️ Perlu update jika acapy berubah |
| **Bundle size** | ✅ Library lebih kecil | - |

---

## 9. Rekomendasi

Kami merekomendasikan untuk:

1. ✅ **Mulai dengan Core Module (13 jam)** — ini mencakup >90% kebutuhan standar OID4VP
2. ✅ **Lanjut ke Integrasi Bifold (4 jam)** — mengganti panggilan Credo
3. ⏸️ **Tunda PEX backward-compat (10 jam)** — hanya jika ada verifier legacy yang memerlukan

**Estimasi total: 17 jam** untuk wallet yang independen, sesuai standar, dan kompatibel dengan acapy.

---

*Dokumen ini disusun berdasarkan analisis teknis yang detail di `docs/analisa/oid4vp-wallet-to-acapy-analysis.md`*
