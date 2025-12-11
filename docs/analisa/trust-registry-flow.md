# Flow Kerja Trust Registry di Bifold Wallet

Dokumentasi detail flow kerja integrasi 4 API wajib Trust Registry dengan Bifold Wallet.

---

## API Wajib

| # | Endpoint | Method | Auth | Fungsi |
|---|----------|--------|------|--------|
| 1 | `/v2/metadata` | GET | ❌ | Service discovery |
| 2 | `/v2/public/lookup/issuer/{did}` | GET | ❌ | Quick lookup issuer |
| 3 | `/v2/public/lookup/verifier/{did}` | GET | ❌ | Quick lookup verifier |
| 4 | `/v2/authorization` | POST | ❌ | Full authorization check |

---

## Flow 1: App Startup - Service Discovery

**Kapan:** Saat aplikasi Bifold pertama kali dibuka atau saat konfigurasi trust registry berubah.

**Tujuan:** Mendapatkan metadata registry untuk mengetahui capabilities dan status service.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         APP STARTUP FLOW                             │
└─────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Bifold  │     │ TrustRegistry   │     │ Trust Registry  │
│   App    │     │    Service      │     │     Server      │
└────┬─────┘     └────────┬────────┘     └────────┬────────┘
     │                    │                       │
     │  1. App Start      │                       │
     ├───────────────────►│                       │
     │                    │                       │
     │                    │  2. GET /v2/metadata  │
     │                    ├──────────────────────►│
     │                    │                       │
     │                    │  3. Response          │
     │                    │◄──────────────────────┤
     │                    │  {                    │
     │                    │    name: "ToIP TR",   │
     │                    │    version: "2.0.0",  │
     │                    │    status: "operational",
     │                    │    features: {...},   │
     │                    │    supportedDIDMethods: [...]
     │                    │  }                    │
     │                    │                       │
     │  4. Cache metadata │                       │
     │◄───────────────────┤                       │
     │                    │                       │
     │  5. Ready          │                       │
     ▼                    ▼                       ▼
```

**Request:**
```http
GET /v2/metadata HTTP/1.1
Host: trust-registry.example.com
```

**Response:**
```json
{
  "name": "ToIP Trust Registry v2",
  "version": "2.0.0",
  "protocol": "ToIP Trust Registry Query Protocol v2",
  "status": "operational",
  "supportedActions": ["issue", "verify", "recognize", "govern", "delegate"],
  "supportedDIDMethods": ["web", "key", "indy", "ion", "ethr", "sov"],
  "features": {
    "authorization": true,
    "recognition": true,
    "delegation": true,
    "publicTrustedList": true
  },
  "endpoints": {
    "authorization": "/v2/authorization",
    "public": {
      "lookupIssuer": "/v2/public/lookup/issuer/{did}",
      "lookupVerifier": "/v2/public/lookup/verifier/{did}"
    }
  }
}
```

**Aksi di Bifold:**
- Cache metadata (TTL: 1 jam)
- Validasi DID method yang digunakan didukung
- Set flag `trustRegistryAvailable = true/false`

---

## Flow 2: Credential Offer - Issuer Trust Check

**Kapan:** Saat user menerima credential offer dari issuer.

**Tujuan:** Memverifikasi apakah issuer terdaftar dan berwenang menerbitkan credential type tersebut.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CREDENTIAL OFFER FLOW                             │
└─────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────┐     ┌─────────────┐     ┌─────────────┐
│  Issuer  │     │  Bifold  │     │ TrustRegistry│     │   Trust     │
│          │     │  Wallet  │     │   Service   │     │   Registry  │
└────┬─────┘     └────┬─────┘     └──────┬──────┘     └──────┬──────┘
     │                │                  │                   │
     │ 1. Credential  │                  │                   │
     │    Offer       │                  │                   │
     ├───────────────►│                  │                   │
     │                │                  │                   │
     │                │ 2. Extract:      │                   │
     │                │    - issuerDid   │                   │
     │                │    - credType    │                   │
     │                │                  │                   │
     │                │ 3. lookupIssuer  │                   │
     │                ├─────────────────►│                   │
     │                │                  │                   │
     │                │                  │ 4. GET /v2/public/│
     │                │                  │    lookup/issuer/ │
     │                │                  │    {did}          │
     │                │                  ├──────────────────►│
     │                │                  │                   │
     │                │                  │ 5. Issuer Data    │
     │                │                  │◄──────────────────┤
     │                │                  │                   │
     │                │ 6. TrustResult   │                   │
     │                │◄─────────────────┤                   │
     │                │                  │                   │
     │                │ 7. Show UI:      │                   │
     │                │    ┌───────────────────────────┐     │
     │                │    │ 📜 Credential Offer       │     │
     │                │    │                           │     │
     │                │    │ From: Example University  │     │
     │                │    │ ✅ Trusted Issuer         │     │
     │                │    │ 🏛️ High Accreditation    │     │
     │                │    │                           │     │
     │                │    │ Type: University Degree   │     │
     │                │    │                           │     │
     │                │    │ [Accept]  [Decline]       │     │
     │                │    └───────────────────────────┘     │
     │                │                  │                   │
     ▼                ▼                  ▼                   ▼
```

**Step-by-Step:**

1. **Issuer mengirim Credential Offer** ke Bifold (via DIDComm/OpenID4VCI)

2. **Bifold extract informasi:**
   ```typescript
   const issuerDid = offer.issuer // "did:web:university.edu"
   const credentialType = offer.credential.type // "UniversityDegree"
   ```

3. **Bifold panggil TrustRegistryService:**
   ```typescript
   const trustResult = await trustRegistryService.lookupIssuer(issuerDid)
   ```

4. **TrustRegistryService panggil API:**
   ```http
   GET /v2/public/lookup/issuer/did%3Aweb%3Auniversity.edu HTTP/1.1
   Host: trust-registry.example.com
   ```

5. **Response dari Trust Registry:**
   ```json
   {
     "data": {
       "found": true,
       "issuer": {
         "did": "did:web:university.edu",
         "name": "Example University",
         "status": "active",
         "accreditationLevel": "high",
         "credentialTypes": [
           {"type": "UniversityDegree", "name": "University Degree"}
         ],
         "validFrom": "2024-01-01T00:00:00Z",
         "validUntil": "2025-12-31T23:59:59Z",
         "registry": {
           "name": "Education Trust Registry",
           "ecosystemDid": "did:web:education-trust.org"
         }
       }
     }
   }
   ```

6. **TrustRegistryService return TrustResult:**
   ```typescript
   {
     trusted: true,
     issuer: {
       did: "did:web:university.edu",
       name: "Example University",
       status: "active",
       accreditationLevel: "high"
     },
     canIssue: ["UniversityDegree", "StudentCard"],
     registry: "Education Trust Registry"
   }
   ```

7. **Bifold tampilkan UI** dengan trust badge

---

## Flow 3: Proof Request - Verifier Trust Check

**Kapan:** Saat user menerima proof request dari verifier.

**Tujuan:** Memverifikasi apakah verifier terdaftar dan berwenang meminta credential type tersebut.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PROOF REQUEST FLOW                               │
└─────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────┐     ┌─────────────┐     ┌─────────────┐
│ Verifier │     │  Bifold  │     │ TrustRegistry│     │   Trust     │
│          │     │  Wallet  │     │   Service   │     │   Registry  │
└────┬─────┘     └────┬─────┘     └──────┬──────┘     └──────┬──────┘
     │                │                  │                   │
     │ 1. Proof       │                  │                   │
     │    Request     │                  │                   │
     ├───────────────►│                  │                   │
     │                │                  │                   │
     │                │ 2. Extract:      │                   │
     │                │    - verifierDid │                   │
     │                │    - requestedCreds                  │
     │                │                  │                   │
     │                │ 3. lookupVerifier│                   │
     │                ├─────────────────►│                   │
     │                │                  │                   │
     │                │                  │ 4. GET /v2/public/│
     │                │                  │    lookup/verifier│
     │                │                  │    /{did}         │
     │                │                  ├──────────────────►│
     │                │                  │                   │
     │                │                  │ 5. Verifier Data  │
     │                │                  │◄──────────────────┤
     │                │                  │                   │
     │                │ 6. TrustResult   │                   │
     │                │◄─────────────────┤                   │
     │                │                  │                   │
     │                │ 7. Show UI:      │                   │
     │                │    ┌───────────────────────────┐     │
     │                │    │ 🔍 Proof Request          │     │
     │                │    │                           │     │
     │                │    │ From: Employer Corp      │     │
     │                │    │ ✅ Trusted Verifier       │     │
     │                │    │                           │     │
     │                │    │ Requesting:               │     │
     │                │    │ • University Degree       │     │
     │                │    │ • Full Name               │     │
     │                │    │                           │     │
     │                │    │ [Share]  [Decline]        │     │
     │                │    └───────────────────────────┘     │
     │                │                  │                   │
     ▼                ▼                  ▼                   ▼
```

**Request:**
```http
GET /v2/public/lookup/verifier/did%3Aweb%3Aemployer.com HTTP/1.1
Host: trust-registry.example.com
```

**Response:**
```json
{
  "data": {
    "found": true,
    "verifier": {
      "did": "did:web:employer.com",
      "name": "Employer Corp",
      "status": "active",
      "accreditationLevel": "medium",
      "credentialTypes": [
        {"type": "UniversityDegree"},
        {"type": "EmploymentCredential"}
      ],
      "registry": {
        "name": "Employment Trust Registry"
      }
    }
  }
}
```

---

## Flow 4: Full Authorization Check (Advanced)

**Kapan:** Saat perlu verifikasi lebih detail - apakah entity berwenang untuk action + resource spesifik.

**Tujuan:** Verifikasi granular berdasarkan action (issue/verify) dan resource (credential type).

```
┌─────────────────────────────────────────────────────────────────────┐
│                   AUTHORIZATION CHECK FLOW                           │
└─────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌─────────────┐     ┌─────────────┐
│  Bifold  │     │ TrustRegistry│     │   Trust     │
│  Wallet  │     │   Service   │     │   Registry  │
└────┬─────┘     └──────┬──────┘     └──────┬──────┘
     │                  │                   │
     │ 1. checkAuth     │                   │
     │    (issuerDid,   │                   │
     │     "issue",     │                   │
     │     "Degree")    │                   │
     ├─────────────────►│                   │
     │                  │                   │
     │                  │ 2. POST /v2/      │
     │                  │    authorization  │
     │                  ├──────────────────►│
     │                  │                   │
     │                  │ Request Body:     │
     │                  │ {                 │
     │                  │   entity_id: "did:web:uni.edu",
     │                  │   authority_id: "did:web:ecosystem.org",
     │                  │   action: "issue",│
     │                  │   resource: "UniversityDegree"
     │                  │ }                 │
     │                  │                   │
     │                  │ 3. Response       │
     │                  │◄──────────────────┤
     │                  │ {                 │
     │                  │   authorized: true,
     │                  │   message: "...", │
     │                  │   context: {      │
     │                  │     accreditationLevel: "high",
     │                  │     validUntil: "2025-12-31"
     │                  │   }               │
     │                  │ }                 │
     │                  │                   │
     │ 4. AuthResult    │                   │
     │◄─────────────────┤                   │
     │                  │                   │
     ▼                  ▼                   ▼
```

**Request:**
```http
POST /v2/authorization HTTP/1.1
Host: trust-registry.example.com
Content-Type: application/json

{
  "entity_id": "did:web:university.edu",
  "authority_id": "did:web:education-trust.org",
  "action": "issue",
  "resource": "UniversityDegree",
  "context": {
    "time": "2024-12-10T10:00:00Z"
  }
}
```

**Response (Authorized):**
```json
{
  "entity_id": "did:web:university.edu",
  "authority_id": "did:web:education-trust.org",
  "action": "issue",
  "resource": "UniversityDegree",
  "authorized": true,
  "time_requested": "2024-12-10T10:00:00Z",
  "time_evaluated": "2024-12-10T10:00:01Z",
  "message": "did:web:university.edu is authorized for issue+UniversityDegree",
  "context": {
    "accreditationLevel": "high",
    "validUntil": "2025-12-31T23:59:59Z",
    "jurisdictions": ["ID", "SG"]
  }
}
```

**Response (Not Authorized):**
```json
{
  "entity_id": "did:web:unknown.edu",
  "authority_id": "did:web:education-trust.org",
  "action": "issue",
  "resource": "UniversityDegree",
  "authorized": false,
  "time_evaluated": "2024-12-10T10:00:01Z",
  "message": "Entity 'did:web:unknown.edu' not found in registry"
}
```

---

## Kapan Menggunakan API Mana?

| Skenario | API yang Digunakan | Alasan |
|----------|-------------------|--------|
| App startup | `GET /v2/metadata` | Service discovery, cache capabilities |
| Credential offer (quick) | `GET /v2/public/lookup/issuer/{did}` | Fast lookup, cukup untuk UI |
| Proof request (quick) | `GET /v2/public/lookup/verifier/{did}` | Fast lookup, cukup untuk UI |
| Verifikasi detail | `POST /v2/authorization` | Granular check per action+resource |
| Credential dengan multiple types | `POST /v2/authorization` | Check per credential type |

---

## Decision Tree

```
                    ┌─────────────────────┐
                    │ Terima Credential   │
                    │ Offer / Proof Req   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Trust Registry      │
                    │ Enabled?            │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │ NO             │                │ YES
              ▼                │                ▼
    ┌─────────────────┐        │      ┌─────────────────┐
    │ Proceed tanpa   │        │      │ Lookup Entity   │
    │ trust check     │        │      │ (Issuer/Verifier)│
    └─────────────────┘        │      └────────┬────────┘
                               │               │
                               │               ▼
                               │     ┌─────────────────────┐
                               │     │ Entity Found?       │
                               │     └──────────┬──────────┘
                               │                │
                               │   ┌────────────┼────────────┐
                               │   │ NO         │            │ YES
                               │   ▼            │            ▼
                               │ ┌──────────┐   │   ┌──────────────┐
                               │ │ Show ⚠️   │   │   │ Status =     │
                               │ │ Warning  │   │   │ "active"?    │
                               │ └──────────┘   │   └──────┬───────┘
                               │                │          │
                               │                │   ┌──────┼──────┐
                               │                │   │ NO   │      │ YES
                               │                │   ▼      │      ▼
                               │                │ ┌────────┴─┐  ┌─────────┐
                               │                │ │Show ⚠️   │  │Show ✅  │
                               │                │ │Suspended/│  │Trusted  │
                               │                │ │Revoked   │  │Badge    │
                               │                │ └──────────┘  └─────────┘
                               │                │
                               └────────────────┘
```

---

## Error Handling

### Network Error
```typescript
try {
  const result = await trustRegistryService.lookupIssuer(did)
} catch (error) {
  if (error instanceof NetworkError) {
    // Trust registry tidak tersedia
    // Tampilkan warning, tapi izinkan user melanjutkan
    showWarning("Trust registry tidak tersedia. Lanjutkan dengan hati-hati.")
  }
}
```

### Entity Not Found
```json
{
  "data": {
    "found": false,
    "message": "Issuer not found in any registry"
  }
}
```
**UI:** Tampilkan ⚠️ "Issuer tidak terdaftar di trust registry"

### Entity Suspended/Revoked
```json
{
  "data": {
    "found": true,
    "issuer": {
      "did": "did:web:bad-university.edu",
      "status": "suspended",
      "statusReason": "Accreditation revoked"
    }
  }
}
```
**UI:** Tampilkan 🚫 "Issuer telah di-suspend: Accreditation revoked"

---

## Caching Strategy

```typescript
// Cache TTL
const METADATA_CACHE_TTL = 60 * 60 * 1000  // 1 jam
const LOOKUP_CACHE_TTL = 5 * 60 * 1000     // 5 menit
const AUTH_CACHE_TTL = 1 * 60 * 1000       // 1 menit

// Cache key format
const cacheKey = {
  metadata: 'trust_registry_metadata',
  issuer: (did) => `issuer_${did}`,
  verifier: (did) => `verifier_${did}`,
  auth: (entityId, action, resource) => `auth_${entityId}_${action}_${resource}`
}
```

---

## UI States

### Trust Badge States

| State | Icon | Color | Text |
|-------|------|-------|------|
| Trusted (High) | ✅ | Green | "Trusted Issuer - High Accreditation" |
| Trusted (Medium) | ✅ | Blue | "Trusted Issuer" |
| Trusted (Low) | ✅ | Gray | "Registered Issuer" |
| Not Found | ⚠️ | Yellow | "Unregistered Issuer" |
| Suspended | 🚫 | Orange | "Suspended Issuer" |
| Revoked | ❌ | Red | "Revoked Issuer" |
| Registry Unavailable | ❓ | Gray | "Trust status unknown" |

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TRUST REGISTRY INTEGRATION                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. GET /v2/metadata                                                │
│     └─► App startup, service discovery                              │
│                                                                      │
│  2. GET /v2/public/lookup/issuer/{did}                              │
│     └─► Credential offer, quick issuer check                        │
│                                                                      │
│  3. GET /v2/public/lookup/verifier/{did}                            │
│     └─► Proof request, quick verifier check                         │
│                                                                      │
│  4. POST /v2/authorization                                          │
│     └─► Detailed authorization check (action + resource)            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```
