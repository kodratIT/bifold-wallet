# Laporan Teknis: Standar OID4VP & Rencana Implementasi

**Dokumen**
**Versi:** 1.0 | **Tanggal:** 23 Juni 2026 | **Penulis:** Tim Pengembangan

---

## Daftar Isi

1. Ringkasan Eksekutif
2. Latar Belakang
3. Standar yang Digunakan: Perbedaan Acapy vs Bifold
4. Dampak Perbedaan Standar
5. Rencana Implementasi
6. Risiko & Mitigasi
7. Kesimpulan

---

## 1. Ringkasan Eksekutif

Bifold Wallet dan sistem verifier **acapy-plugins** saat ini menggunakan **versi standar OID4VP (OpenID for Verifiable Presentations) yang berbeda**. Perbedaan ini menyebabkan ketidakpastian interoperabilitas dan ketergantungan pada library pihak ketiga *(Credo)* yang tidak bisa kita kontrol.

**Rencana:** Membangun modul komunikasi OID4VP mandiri (`@bifold/openid4vp`) yang sesuai standar terbaru, interoperable dengan acapy, dan independen dari Credo.

---

## 2. Latar Belakang

### 2.1. Apa itu OID4VP?

OID4VP adalah protokol di atas OAuth 2.0 yang memungkinkan **wallet** (seperti Bifold) untuk menyajikan kredensial digital *(VC, SD-JWT, mDoc)* kepada **verifier** (seperti acapy) atas permintaan yang telah ditentukan.

### 2.2. Ekosistem Saat Ini

```
┌─────────────────────────┐          ┌─────────────────────────┐
│   BIFOLD WALLET         │          │   ACAPY VERIFIER        │
│                         │          │                         │
│  OID4VP DRAFT 8         │◀────────▶│  OID4VP FINAL (≈ v1)   │
│  (via Credo library)    │  JAR +   │  (via python lib)      │
│                         │  DCQL/   │                         │
│  ⚠️ Tidak bisa update   │  PEX     │  ✅ Selalu ikut update  │
│     tanpa nunggu Credo  │  submit  │     spesifikasi terbaru │
└─────────────────────────┘          └─────────────────────────┘
```

**Masalah utama:** Bifold bergantung pada library **`@credo-ts/openid4vc`** yang:
- Hanya dipasang sebagai consumer — tidak bisa mengontrol versi protokol
- Banyak fitur tidak terpakai *(hanya 2 fungsi dipakai dari puluhan)*
- Jika Credo berhenti mendukung versi terbaru, wallet kita ikut tertinggal

---

## 3. Standar yang Digunakan: Perbedaan Acapy vs Bifold

### 3.1. Evolusi Standar OID4VP

```
Draft 8 ─────────────────────────────────────────────────────────┐
  ├── client_id_scheme sebagai parameter terpisah                │
  ├── presentation_definition (PEX) sebagai query                │
  ├── vp_formats di payload langsung                             │
  └── nonce opsional                                             │
                                                                 │
Draft 18 ────────────────────────────────────────────────────────┤
  ├── x509_san_dns client_id scheme mulaid digunakan              │
  ├── client_id_scheme mulaid dihapus (pindah ke prefix client_id)│
                                                                 │
Draft 21 ────────────────────────────────────────────────────────┤
  ├── dcql_query diperkenalkan sebagai alternatif PEX            │
  ├── request_uri_method diperkenalkan                           │
                                                                 │
Draft 24-26 ─────────────────────────────────────────────────────┤
  ├── dcql_query menjadi standar utama                           │
  ├── presentation_definition mulai dihapus                      │
  ├── client_id pake prefix scheme (did:, x509_san_dns:)         │
  └── nonce diwajibkan, minimal 128 bit                          │
                                                                 │
OID4VP 1.0 Final (Draft 30+) ───────────────────────────────────│
  ├── dcql_query SATU-SATUNYA query language                     │
  ├── presentation_definition TIDAK ADA                          │
  ├── client_id wajib pake prefix scheme                         │
  ├── transaction_data — wallet HARUS reject jika tidak support  │
  ├── nonce — WAJIB, 128 bit, ASCII URL-safe                    │
  ├── client_metadata — tempat vp_formats_supported             │
  ├── request_uri_method=post — GET atau POST                   │
  └── verifier_info — fitur baru (optional)                     │
```

### 3.2. Perbedaan Detail: Bifold (Draft 8) vs Acapy (Final)

| Fitur | Bifold Saat Ini (Draft 8) | Acapy (Final / ≈ Draft 28-30) | Dampak |
|-------|--------------------------|-------------------------------|--------|
| **Query Language** | `presentation_definition` (PEX) | `dcql_query` (DCQL) sebagai standar | **Perubahan fundamental** — wallet harus migrasi dari PEX ke DCQL |
| **client_id scheme** | Parameter `client_id_scheme` terpisah | **Prefix** di `client_id` (`did:jwk:...`, `x509_san_dns:...`) | Cara deteksi skema client berubah total |
| **vp_formats** | Di payload JWT langsung | Di `client_metadata.vp_formats_supported` | Lokasi metadata berubah |
| **transaction_data** | Tidak dikenal | **Wajib di-reject** jika tidak support | Wallet harus return error spesifik |
| **nonce** | Opsional | **Wajib**, minimal 128 bit, ASCII URL-safe | Validasi lebih ketat |
| **JWT typ header** | Tidak diwajibkan | **Wajib** `typ: oauth-authz-req+jwt` | Validasi header tambahan |
| **request_uri_method** | Tidak dikenal | GET/POST (POST untuk wallet metadata) | Fitur baru (opsional) |
| **verifier_info** | Tidak dikenal | Optional — attestations verifier | Belum relevan |

### 3.3. Ringkasan Visual Perubahan

```
BIFOLD (Draft 8)                          ACAPY (Final)
┌──────────────────────┐                  ┌──────────────────────┐
│ Authorization Req    │                  │ Authorization Req    │
│ {                    │                  │ {                    │
│   client_id: "abc",  │                  │   client_id:         │
│   client_id_scheme:  │                  │    "did:jwk:...",    │
│    "did" ,           │                  │   client_metadata: { │
│   vp_formats: {..},  │                  │    vp_formats_       │
│   presentation_      │                  │    supported: {...}  │
│    definition: {...} │                  │   },                 │
│ }                    │                  │   dcql_query: {...}, │
└──────────────────────┘                  │   nonce: "..."       │
                                          │ }                    │
                                          └──────────────────────┘
```

### 3.4. Standar yang Mana yang Dipakai Acapy?

Acapy menggunakan **OID4VP Final (draft 28-30)** — versi final yang disetujui sebagai standar. Secara spesifik:

| Aspek | Detail |
|-------|--------|
| **Versi Standar** | OID4VP 1.0 Final (Implementer's Draft 2 + tambahan) |
| **Query** | ✅ `dcql_query` (standar) + `presentation_definition` (backward compat) |
| **Response Mode** | ✅ `direct_post` (hanya ini) |
| **client_id** | ✅ Prefix: `did:jwk:<base64url(jwk)>` atau `x509_san_dns:<dns>` |
| **Signing** | ✅ EdDSA (Ed25519) atau ES256 (P-256) |
| **Request Delivery** | ✅ JAR via `request_uri` (signed JWT) |
| **Entry Point** | `openid://?client_id=...&request_uri=...` |

### 3.5. Kenapa Bifold Tidak Bisa Langsung Komunikasi dengan Acapy?

Bifold saat ini menggunakan **Draft 8** via library Credo. Kesenjangan utamanya:

1. **Format request berbeda** — Acapy kirim JAR signed JWT. Draft 8 tidak mewajibkan format ini secara ketat
2. **Query language berbeda** — Draft 8 pakai PEX, Final pakai DCQL (acapy support keduanya)
3. **Metadata binding berbeda** — Client metadata ada di payload, bukan di `client_metadata` terpisah
4. **Verifikasi JWT** — Wallet perlu resolve public key dari `did:jwk` — mekanisme ini ada di Final, tidak di Draft 8

> **Catatan:** Walaupun Credo di belakangnya bisa handle Final spec, kita tidak punya kontrol update. Yang lebih kritis — kit a tidak pernah **memverifikasi** interoperabilitas wallet kita dengan acapy secara langsung.

---

## 4. Dampak Perbedaan Standar

| Dampak | Tingkat |
|--------|---------|
| Wallet mungkin **tidak bisa menerima request** dari verifier acapy yang menggunakan format Final | 🔴 Tinggi |
| Wallet mungkin **mengirim response** yang tidak sesuai format yang diharapkan acapy | 🔴 Tinggi |
| Wallet tidak bisa **memanfaatkan fitur baru** (transaction_data, verifier_info) | 🟡 Sedang |
| Jika Credo berhenti di-maintain, wallet **kehilangan kemampuan OID4VP** | 🔴 Tinggi |

---

## 5. Rencana Implementasi

### 5.1. Arsitektur Hybrid

Untuk menyelesaikan kesenjangan ini, kami akan membangun **modul hybrid** yang menggabungkan library resmi dengan implementasi yang kita kontrol:

```
┌──────────────────────────────────────────────────────────────┐
│                    BIFOLD WALLET (setelah)                    │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  resolverProof.tsx  →  panggil @bifold/openid4vp    │  │
│   │  types.tsx          →  extends tipe dari @bifold    │  │
│   │  displayProof.tsx   →  kompatibel (no change)       │  │
│   │  agent.ts           →  hapus OpenId4VcModule (⚠️ lihat)│  │
│   └─────────────────────┬────────────────────────────────┘  │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────────┐
│  @bifold/openid4vp (MODUL BARU)                              │
│                         │                                    │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────────┐  │
│  │ holder.ts│   │ crypto.ts    │   │ dcql.ts            │  │
│  │ wrapper  │   │ did:jwk res  │   │ evaluator: match   │  │
│  │ resolve  │   │ x509 verify  │   │ credentials wallet │  │
│  │ accept   │   │ (KITA TULIS) │   │ (KITA TULIS)       │  │
│  └────┬─────┘   └──────────────┘   └────────────────────┘  │
│       │                                                     │
│  ┌────▼─────────────────────────────────────────────────┐  │
│  │  @openid4vc/openid4vp v0.5.1                         │  │
│  │  (OpenWallet Foundation — openid4vc-ts)              │  │
│  │  ✅ OID4VP 1.0 Final                                 │  │
│  │  ✅ Version detection (draft 8 → v1)                │  │
│  │  ✅ JWT verify, client_id schemes                    │  │
│  │  ✅ DCQL/PEX parsing, transaction_data               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2. Boundary: Library vs Kita Tulis

| ✅ Dari Library (gratis) | ✏️ Kita Tulis |
|-------------------------|---------------|
| OID4VP 1.0 Final protocol | **did:jwk resolver** (library tidak handle ini) |
| Version detection (draft 8 → v1) | **x509 chain trust verification** (wallet-specific) |
| JWT verify + JAR processing | **DCQL evaluator** (match credentials wallet) |
| DCQL/PEX parsing | **Bifold adapter** (types, resolverProof) |
| client_id scheme detection | |
| transaction_data parsing | |
| client_metadata parsing | |
| Error response format (OAuth2) | |

### 5.3. Yang Berubah di Bifold

| File | Perubahan | Level |
|------|-----------|-------|
| `resolverProof.tsx` | 2 function body ganti panggil Credo → panggil `@bifold/openid4vp` | 🔴 |
| `types.tsx` | 1 import + 1 extends ganti | 🟡 |
| `agent.ts` | Hapus `OpenId4VcModule` (⚠️ issuance tetap jalan) | 🟢 |
| `displayProof.tsx` | Verifikasi kompatibilitas tipe (mungkin 0 perubahan) | 🟢 |

**7 file lainnya** (hook, UI screens, components, credentialRecord) — **tidak berubah** karena interface function-nya tetap sama.

### 5.4. Repositori yang Digunakan: `openwallet-foundation-labs/oid4vc-ts`

Untuk modul ini, kami akan menggunakan library **`@openid4vc/openid4vp`** sebagai fondasi protocol layer. Library ini berasal dari repositori:

**GitHub:** [github.com/openwallet-foundation-labs/oid4vc-ts](https://github.com/openwallet-foundation-labs/oid4vc-ts)

#### Repository Profile

| Aspek | Detail |
|-------|--------|
| **Organisasi** | OpenWallet Foundation Labs — bagian dari **Linux Foundation** |
| **Lisensi** | Apache License 2.0 |
| **Awal mula** | Dikembangkan oleh **Animo** sebagai bagian dari **SPRIN-D EUDI Wallet Prototypes Funke** (Jerman) |
| **Status** | Aktif — 319+ commits, 11 rilis, maintenance aktif |
| **Platform** | ✅ Node.js, ✅ React Native, ✅ Browser |

#### Kenapa Memilih Library Ini?

| Alasan | Penjelasan |
|--------|-----------|
| **Sudah mendukung OID4VP 1.0 Final** | Target versi standar yang kita tuju |
| **Version detection built-in** | Bisa handle request dari Draft 18 sampai v1 Final — kompatibel dengan berbagai verifier |
| **React Native ready** | Library sudah diuji di RN |
| **OpenWallet Foundation** | Di bawah naungan Linux Foundation — bukan proyek individu |
| **Apache 2.0** | Bebas digunakan, dimodifikasi, dan didistribusikan |
| **Digunakan oleh ekosistem EUDI** | Sudah dipakai di inisiatif dompet digital Uni Eropa |

#### Tiga Package Dalam Satu Repo

| Package | Fungsi | Kami Pakai? |
|---------|--------|-------------|
| `@openid4vc/oauth2` | OAuth 2.0 dasar (DPoP, PKCE, PAR) | Tidak langsung, sebagai dependensi |
| `@openid4vc/openid4vci` | Issuance kredensial (VC, SD-JWT, mDoc) | Tidak |
| **`@openid4vc/openid4vp`** | **Verifiable Presentations (OID4VP)** | **✅ Ya — sebagai protocol layer** |

#### Cara Kami Menggunakannya

Kami **tidak** menggunakan library ini secara langsung di bifold. Sebaliknya, kami membuat **modul `@bifold/openid4vp`** yang membungkus library ini plus kode kita sendiri:

```
@bifold/openid4vp
  ├── crypto.ts      ← kita tulis: did:jwk resolve + x509 verify
  ├── dcql.ts        ← kita tulis: evaluator match credentials wallet
  ├── holder.ts      ← wrapper: panggil library resolve + submit
  └── [library] @openid4vc/openid4vp  ← protocol layer (dari repo ini)
```

Dengan cara ini, jika suatu saat library perlu di-upgrade atau diganti, kita hanya perlu mengubah **holder.ts** — tanpa menyentuh crypto, DCQL evaluator, atau bifold adapter.

### 5.5. Perbandingan Sebelum & Sesudah

| Aspek | Sebelum | Sesudah |
|-------|---------|---------|
| **Ketergantungan utama** | `@credo-ts/openid4vc@0.6.3` (+library kompleks) | `@openid4vc/openid4vp@0.5.1` (+2 library kecil) |
| **Kontrol spesifikasi** | Tidak bisa update tanpa Credo | Bisa update kapan saja |
| **Standar OID4VP** | Tidak jelas (tersembunyi di Credo) | ✅ OID4VP 1.0 Final |
| **Kompatibilitas acapy** | Tidak pernah diverifikasi | ✅ Akan diverifikasi |
| **Jumlah file berubah** | - | 6 file baru + 4 file diubah |

---

## 6. Risiko & Mitigasi

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Library `@openid4vc/openid4vp` tidak kompatibel React Native | Rendah | Tinggi | Verifikasi di awal; alternatif implementasi manual |
| Library masih versi 0.5.1 — API bisa berubah | Sedang | Sedang | Pin exact version; review changelog sebelum upgrade |
| `jose` butuh polyfill untuk RN | Rendah | Sedang | Tambahkan `react-native-get-random-values` |
| Issuance OIDC4VCI ikut terdampak jika `OpenId4VcModule` dihapus | Sedang | Tinggi | Pastikan `OpenId4VcModule` tetap terdaftar untuk issuance; hanya OID4VP yang pindah ke modul baru |
| Format credential wallet tidak match dengan `vp_formats_supported` | Rendah | Sedang | Deteksi mismatch sebelum submit |

---

## 7. Kesimpulan

1. **Bifold dan acapy saat ini menggunakan versi standar OID4VP yang berbeda.** Bifold (Draft 8 via Credo), acapy (Final / ≈Draft 28-30).

2. **Perbedaan utama:** Query language (PEX → DCQL), client_id scheme (parameter → prefix), metadata location, dan security requirements yang lebih ketat.

3. **Rencana:** Membangun modul hybrid `@bifold/openid4vp` yang:
   - Menggunakan **`@openid4vc/openid4vp@0.5.1`** untuk protocol layer (Dari OpenWallet Foundation — sudah mendukung OID4VP 1.0 Final)
   - Menulis **crypto (did:jwk, x509)** dan **DCQL evaluator** sendiri untuk kontrol penuh di area kritis
   - **4 file berubah** di bifold — sisanya tetap

4. Wallet menjadi independen, sesuai standar, dan terverifikasi kompatibel dengan acapy.

---

**Dokumen terkait:**
- Analisis detail: `docs/analisa/oid4vp-wallet-to-acapy-analysis.md`
- Rencana implementasi: `docs/plans/oid4vp-hybrid-module-plan.md`
- Brief stakeholder: `docs/oid4vp-custom-module-stakeholder-brief.md`
