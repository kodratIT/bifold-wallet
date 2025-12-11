# Analisis Implementasi Trust Registry Protocol (ToIP) di Bifold Wallet

Dokumen ini menganalisis apakah project Bifold Wallet sudah mengimplementasikan [Trust Registry Protocol](https://trustoverip.github.io/tswg-trust-registry-protocol/) dari Trust over IP (ToIP) Foundation.

---

## Ringkasan Eksekutif

**Status: ❌ BELUM DIIMPLEMENTASIKAN**

Bifold Wallet **belum** mengimplementasikan Trust Registry Protocol dari ToIP. Project ini menggunakan pendekatan verifikasi kredensial berbasis kriptografi standar (DID resolution, signature verification, revocation check) tetapi tidak memiliki mekanisme untuk memverifikasi apakah issuer/verifier terdaftar dan berwenang dalam suatu trust framework.

---

## Apa itu Trust Registry Protocol?

Trust Registry Protocol dari ToIP adalah spesifikasi untuk:

1. **Registry Query** - Memungkinkan wallet/verifier untuk query apakah suatu entitas (issuer/verifier) terdaftar dan berwenang
2. **Governance Framework** - Mendefinisikan aturan dan kebijakan trust dalam suatu ekosistem
3. **Authorization Verification** - Memverifikasi apakah issuer berwenang menerbitkan credential type tertentu
4. **Ecosystem Membership** - Memverifikasi keanggotaan entitas dalam suatu trust ecosystem

### Komponen Utama Trust Registry Protocol

```
┌─────────────────────────────────────────────────────────────────┐
│                    Trust Registry Protocol                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Registry Query API                                          │
│     - GET /registries/{registryId}/entities/{entityId}          │
│     - Query issuer/verifier authorization status                │
│                                                                  │
│  2. Governance Framework                                        │
│     - Define credential types                                   │
│     - Define authorized issuers per credential type             │
│     - Define trust policies                                     │
│                                                                  │
│  3. Entity Registration                                         │
│     - Register issuers with their authorized credential types   │
│     - Register verifiers with their authorized verifications    │
│                                                                  │
│  4. Authorization Verification                                  │
│     - Verify issuer can issue specific credential type          │
│     - Verify verifier can request specific credential type      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Analisis Codebase Bifold Wallet

### 1. Pencarian Implementasi Trust Registry

| Pencarian | Hasil |
|-----------|-------|
| `TrustRegistry` | ❌ Tidak ditemukan |
| `trust.?registry` | ❌ Tidak ditemukan |
| `governance` | ❌ Hanya referensi ke project governance, bukan implementasi |
| `verifyIssuer` / `validateIssuer` | ❌ Tidak ditemukan |
| `authorized.*issuer` | ❌ Tidak ditemukan |
| `registry.*query` | ❌ Tidak ditemukan |

### 2. Mekanisme Verifikasi yang Ada

Bifold Wallet memiliki mekanisme verifikasi berikut, tetapi **bukan** Trust Registry:

#### a. DID Resolution
```typescript
// packages/core/src/utils/agent.ts
dids: new DidsModule({
  resolvers: [
    new WebvhDidResolver(),
    new WebDidResolver(),
    new JwkDidResolver(),
    new KeyDidResolver(),
    new PeerDidResolver(),
  ],
}),
```
- ✅ Resolve DID ke DID Document
- ❌ Tidak memverifikasi apakah DID terdaftar di trust registry

#### b. Credential Definition & Schema Validation
```typescript
// packages/verifier/src/request-templates.ts
const studentRestrictions = [{ cred_def_id: 'XUxBrVSALWHLeycAUhrNr9:3:CL:26293:student_card' }]
```
- ✅ Memvalidasi credential berdasarkan schema/cred_def
- ❌ Tidak memverifikasi apakah issuer berwenang menerbitkan credential type tersebut

#### c. Revocation Check
```typescript
// packages/core/src/screens/CredentialDetails.tsx
credential.revocationNotification == undefined ? setIsRevoked(false) : setIsRevoked(true)
```
- ✅ Memeriksa status revokasi credential
- ❌ Tidak memeriksa status issuer di trust registry

#### d. Attestation Monitor
```typescript
// packages/core/src/types/attestation.ts
export interface AttestationMonitor {
  readonly attestationWorkflowInProgress: boolean
  shouldHandleProofRequestAutomatically: boolean
  start(agent: Agent): void
  stop(): void
  requestAttestationCredential(): Promise<void>
}
```
- ✅ Mobile app attestation (Google Play Integrity, Apple DeviceCheck)
- ❌ Bukan trust registry untuk issuer/verifier

#### e. OCA Bundle Resolver
```typescript
// packages/core/src/container-api.ts
UTIL_OCA_RESOLVER: 'utility.oca-resolver'
```
- ✅ Resolve credential branding/display dari OCA bundles
- ❌ Tidak memverifikasi trust status issuer

### 3. Proof Request Restrictions

Bifold menggunakan `restrictions` dalam proof request untuk membatasi credential yang diterima:

```typescript
// packages/core/__tests__/components/VerifierCredentialCard.test.tsx
{
  name: 'given_names',
  restrictions: [
    { schema_id: '4eCXHS79ykiMv2PoBxPK23:2:unverified_person:0.1.0', issuer_did: '4eCXHS79ykiMv2PoBxPK23' },
    { schema_id: 'HTkhhCW1bAXWnxC1u3YVoa:2:unverified_person:0.1.0', issuer_did: 'HTkhhCW1bAXWnxC1u3YVoa' },
  ],
}
```

**Ini adalah hardcoded whitelist, bukan dynamic trust registry query.**

---

## Gap Analysis: Bifold vs Trust Registry Protocol

| Fitur Trust Registry Protocol | Status di Bifold | Keterangan |
|------------------------------|------------------|------------|
| Registry Query API | ❌ Tidak ada | Tidak ada endpoint untuk query trust registry |
| Governance Framework Definition | ❌ Tidak ada | Tidak ada struktur untuk mendefinisikan governance |
| Dynamic Issuer Authorization Check | ❌ Tidak ada | Issuer whitelist hardcoded di proof templates |
| Dynamic Verifier Authorization Check | ❌ Tidak ada | Tidak ada verifikasi verifier |
| Ecosystem Membership Verification | ❌ Tidak ada | Tidak ada konsep ecosystem membership |
| Trust Registry Caching | ❌ Tidak ada | Tidak ada caching karena tidak ada registry |
| Multi-Registry Support | ❌ Tidak ada | Tidak ada dukungan multiple registries |

---

## Apa yang Perlu Diimplementasikan

Untuk mengimplementasikan Trust Registry Protocol, Bifold perlu:

### 1. Trust Registry Service Interface

```typescript
// Contoh interface yang perlu dibuat
interface TrustRegistryService {
  // Query apakah issuer berwenang menerbitkan credential type
  isAuthorizedIssuer(
    registryId: string,
    issuerDid: string,
    credentialType: string
  ): Promise<AuthorizationResult>
  
  // Query apakah verifier berwenang meminta credential type
  isAuthorizedVerifier(
    registryId: string,
    verifierDid: string,
    credentialType: string
  ): Promise<AuthorizationResult>
  
  // Get governance framework
  getGovernanceFramework(registryId: string): Promise<GovernanceFramework>
  
  // List authorized issuers untuk credential type
  listAuthorizedIssuers(
    registryId: string,
    credentialType: string
  ): Promise<AuthorizedEntity[]>
}

interface AuthorizationResult {
  authorized: boolean
  validFrom?: Date
  validUntil?: Date
  governanceFramework?: string
  credentialTypes?: string[]
}

interface GovernanceFramework {
  id: string
  name: string
  version: string
  credentialTypes: CredentialTypeDefinition[]
  policies: TrustPolicy[]
}
```

### 2. Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                     Bifold Wallet                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Credential Offer │───▶│ Trust Registry  │                     │
│  │    Handler       │    │    Service      │                     │
│  └─────────────────┘    └────────┬────────┘                     │
│                                  │                               │
│  ┌─────────────────┐             │                               │
│  │  Proof Request  │─────────────┤                               │
│  │    Handler      │             │                               │
│  └─────────────────┘             ▼                               │
│                         ┌─────────────────┐                     │
│                         │  Trust Registry │                     │
│                         │      API        │                     │
│                         └─────────────────┘                     │
│                                  │                               │
└──────────────────────────────────┼───────────────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────┐
                    │   External Trust        │
                    │   Registry Service      │
                    │   (ToIP Compliant)      │
                    └─────────────────────────┘
```

### 3. Credential Offer Flow dengan Trust Registry

```typescript
// Contoh flow yang perlu diimplementasikan
async function handleCredentialOffer(offer: CredentialOffer) {
  const issuerDid = offer.issuer
  const credentialType = offer.credentialType
  
  // 1. Query trust registry
  const trustResult = await trustRegistryService.isAuthorizedIssuer(
    config.trustRegistryId,
    issuerDid,
    credentialType
  )
  
  // 2. Tampilkan trust status ke user
  if (trustResult.authorized) {
    showTrustedIssuerBadge(trustResult.governanceFramework)
  } else {
    showUntrustedIssuerWarning()
  }
  
  // 3. User memutuskan apakah menerima credential
  // ...
}
```

### 4. UI Components yang Diperlukan

- **Trust Badge** - Menampilkan status trust issuer/verifier
- **Governance Info** - Menampilkan informasi governance framework
- **Trust Warning** - Warning jika issuer/verifier tidak terdaftar
- **Registry Settings** - Konfigurasi trust registry yang digunakan

---

## Rekomendasi Implementasi

### Phase 1: Foundation
1. Buat `TrustRegistryService` interface
2. Implementasi basic HTTP client untuk ToIP Trust Registry API
3. Tambahkan konfigurasi trust registry di app settings

### Phase 2: Integration
1. Integrasikan trust check di credential offer handler
2. Integrasikan trust check di proof request handler
3. Tambahkan caching untuk trust registry responses

### Phase 3: UI/UX
1. Tambahkan trust badge di credential cards
2. Tambahkan trust warning di credential offer screen
3. Tambahkan governance info di credential details

### Phase 4: Advanced
1. Support multiple trust registries
2. Offline trust verification dengan cached data
3. Trust registry discovery

---

## Referensi

- [ToIP Trust Registry Protocol Specification](https://trustoverip.github.io/tswg-trust-registry-protocol/)
- [ToIP Trust Registry Task Force](https://wiki.trustoverip.org/display/HOME/Trust+Registry+Task+Force)
- [Credo-TS Documentation](https://credo.js.org/)
- [Aries RFC 0430: Machine-Readable Governance Frameworks](https://github.com/hyperledger/aries-rfcs/tree/main/concepts/0430-machine-readable-governance-frameworks)

---

## Kesimpulan

Bifold Wallet saat ini **tidak mengimplementasikan** Trust Registry Protocol dari ToIP. Project ini menggunakan:

1. **DID Resolution** - Untuk resolve DID ke DID Document
2. **Cryptographic Verification** - Untuk verifikasi signature credential
3. **Revocation Check** - Untuk memeriksa status revokasi
4. **Hardcoded Restrictions** - Untuk membatasi issuer yang diterima (bukan dynamic registry)

Untuk mendukung Trust Registry Protocol, diperlukan implementasi baru yang mencakup:
- Trust Registry Service
- Integration dengan credential/proof handlers
- UI components untuk menampilkan trust status
- Konfigurasi trust registry di settings

Implementasi ini akan memungkinkan Bifold Wallet untuk berpartisipasi dalam trust ecosystems yang menggunakan ToIP Trust Registry Protocol.
