# Analisis Fitur Export/Import Credential di Bifold Wallet

## Overview

Dokumen ini menganalisis kemungkinan pengembangan fitur export/import credential untuk Bifold Wallet yang menggunakan Credo-TS (Aries Framework JavaScript) sebagai agent wallet.

---

## Arsitektur Storage Credential di Bifold

### 1. Wallet Storage Engine

Bifold menggunakan **Aries Askar** sebagai secure storage:

```typescript
// packages/core/src/utils/agent.ts
import { AskarModule } from '@credo-ts/askar'
import { ariesAskar } from '@hyperledger/aries-askar-react-native'

askar: new AskarModule({
  ariesAskar,
})
```

**Aries Askar** adalah:
- Secure encrypted storage untuk wallet data
- Pengganti Indy SDK wallet
- Menyimpan: credentials, DIDs, keys, connections, dll
- Database SQLite yang terenkripsi dengan wallet key

### 2. Tipe Credential yang Didukung

Bifold mendukung beberapa format credential:

| Format | Class | Storage |
|--------|-------|---------|
| AnonCreds (Indy) | `CredentialExchangeRecord` | `agent.credentials` |
| W3C JWT-VC | `W3cCredentialRecord` | `agent.w3cCredentials` |
| SD-JWT VC | `SdJwtVcRecord` | `agent.sdJwtVc` |
| mDOC (ISO 18013-5) | `MdocRecord` | `agent.mdocs` |

### 3. Cara Akses Credentials

```typescript
// AnonCreds credentials
const anonCreds = await agent.credentials.getAll()

// W3C credentials
const w3cCreds = await agent.w3cCredentials.getAllCredentialRecords()

// SD-JWT credentials
const sdJwtCreds = await agent.sdJwtVc.getAll()

// mDOC credentials
const mdocCreds = await agent.mdocs.getAll()
```

---

## Opsi Implementasi Export/Import

### Opsi 1: Full Wallet Export (Aries Askar Level)

**Deskripsi:** Export seluruh wallet database termasuk keys, DIDs, credentials, connections.

**Pros:**
- Complete backup
- Termasuk private keys
- Bisa restore ke device baru

**Cons:**
- File besar
- Security risk (private keys)
- Tidak selective
- Perlu wallet key untuk decrypt

**API Credo-TS:**
```typescript
// Credo-TS belum punya built-in wallet export
// Perlu akses langsung ke Askar
import { Store } from '@hyperledger/aries-askar-react-native'

// Export raw database (encrypted)
const walletPath = `${DocumentDirectoryPath}/wallet/${walletId}`
// Copy SQLite file
```

### Opsi 2: Credential-Level Export (Recommended)

**Deskripsi:** Export credential individual atau batch dalam format portable.

**Pros:**
- Selective export
- Smaller file size
- Bisa share specific credentials
- Lebih aman (tanpa private keys)

**Cons:**
- Tidak termasuk private keys
- Perlu re-bind ke wallet baru
- Beberapa credential mungkin tidak bisa di-import ulang

**Format Export yang Direkomendasikan:**

```typescript
interface CredentialExportPackage {
  version: '1.0'
  exportedAt: string
  walletId?: string // optional, untuk tracking
  credentials: ExportedCredential[]
}

interface ExportedCredential {
  id: string
  type: 'anoncreds' | 'w3c-jwt' | 'sd-jwt' | 'mdoc'
  format: string
  issuedAt?: string
  expiresAt?: string
  issuer: {
    did?: string
    name?: string
  }
  // Credential data (format-specific)
  data: AnonCredsExport | W3cExport | SdJwtExport | MdocExport
  // Metadata
  metadata?: Record<string, unknown>
}
```

### Opsi 3: Portable Credential Format (W3C VC)

**Deskripsi:** Export dalam format W3C Verifiable Credential standar.

**Pros:**
- Interoperable dengan wallet lain
- Standard format
- Future-proof

**Cons:**
- Tidak semua credential bisa dikonversi
- AnonCreds tidak langsung compatible

---

## Detail Implementasi per Credential Type

### 1. AnonCreds Credential Export

```typescript
interface AnonCredsExport {
  credentialId: string
  schemaId: string
  credentialDefinitionId: string
  revocationRegistryId?: string
  credentialRevocationId?: string
  // Raw credential values
  values: Record<string, {
    raw: string
    encoded: string
  }>
  // Signature (tanpa private key holder)
  signature: any
  signatureCorrectnessProof: any
}

// Export function
async function exportAnonCredsCredential(
  agent: Agent,
  credentialId: string
): Promise<AnonCredsExport> {
  const record = await agent.credentials.getById(credentialId)
  const formatData = await agent.credentials.getFormatData(credentialId)
  
  return {
    credentialId: record.id,
    schemaId: formatData.credential?.anoncreds?.schemaId,
    credentialDefinitionId: formatData.credential?.anoncreds?.credentialDefinitionId,
    values: formatData.credential?.anoncreds?.values,
    // ... etc
  }
}
```

**Catatan:** AnonCreds credential terikat dengan link secret holder. Export credential tanpa link secret berarti credential tidak bisa digunakan untuk proving di wallet lain.

### 2. W3C JWT-VC Export

```typescript
interface W3cJwtExport {
  // JWT string (self-contained)
  jwt: string
  // Parsed data untuk display
  credentialSubject: Record<string, unknown>
  issuer: string
  issuanceDate: string
  expirationDate?: string
}

async function exportW3cCredential(
  agent: Agent,
  credentialId: string
): Promise<W3cJwtExport> {
  const record = await agent.w3cCredentials.getCredentialRecordById(credentialId)
  
  if (record.credential instanceof W3cJwtVerifiableCredential) {
    return {
      jwt: record.credential.serializedJwt,
      credentialSubject: record.credential.credentialSubject,
      issuer: record.credential.issuerId,
      issuanceDate: record.credential.issuanceDate,
      expirationDate: record.credential.expirationDate,
    }
  }
}
```

**Catatan:** W3C JWT-VC adalah self-contained, bisa di-import ke wallet lain yang support format ini.

### 3. SD-JWT VC Export

```typescript
interface SdJwtExport {
  // Compact SD-JWT string
  compactSdJwtVc: string
  // Disclosed claims
  disclosedClaims: Record<string, unknown>
  // Issuer info
  issuer: string
  vct: string // Verifiable Credential Type
}

async function exportSdJwtCredential(
  agent: Agent,
  credentialId: string
): Promise<SdJwtExport> {
  const record = await agent.sdJwtVc.getById(credentialId)
  
  return {
    compactSdJwtVc: record.compactSdJwtVc,
    disclosedClaims: record.getPrettyClaims(),
    issuer: record.sdJwtVc.payload.iss,
    vct: record.sdJwtVc.payload.vct,
  }
}
```

**Catatan:** SD-JWT VC juga self-contained dan portable.

### 4. mDOC Export

```typescript
interface MdocExport {
  // Base64 encoded mDOC
  base64: string
  docType: string
  namespaces: Record<string, Record<string, unknown>>
}

async function exportMdocCredential(
  agent: Agent,
  credentialId: string
): Promise<MdocExport> {
  const record = await agent.mdocs.getById(credentialId)
  
  return {
    base64: record.base64Url,
    docType: record.docType,
    namespaces: record.namespaces,
  }
}
```

---

## Struktur Package yang Direkomendasikan

```
packages/credential-backup/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types/
│   │   └── index.ts
│   ├── export/
│   │   ├── ExportService.ts
│   │   ├── exporters/
│   │   │   ├── AnonCredsExporter.ts
│   │   │   ├── W3cExporter.ts
│   │   │   ├── SdJwtExporter.ts
│   │   │   └── MdocExporter.ts
│   │   └── formatters/
│   │       ├── JsonFormatter.ts
│   │       └── EncryptedFormatter.ts
│   ├── import/
│   │   ├── ImportService.ts
│   │   ├── importers/
│   │   │   ├── AnonCredsImporter.ts
│   │   │   ├── W3cImporter.ts
│   │   │   ├── SdJwtImporter.ts
│   │   │   └── MdocImporter.ts
│   │   └── validators/
│   │       └── CredentialValidator.ts
│   ├── encryption/
│   │   ├── EncryptionService.ts
│   │   └── PasswordDerivedKey.ts
│   ├── contexts/
│   │   └── CredentialBackupContext.tsx
│   ├── hooks/
│   │   ├── useExportCredentials.ts
│   │   └── useImportCredentials.ts
│   └── components/
│       ├── ExportModal.tsx
│       ├── ImportModal.tsx
│       └── CredentialSelector.tsx
└── __tests__/
```

---

## Security Considerations

### 1. Encryption untuk Export File

```typescript
import { pbkdf2Sync, createCipheriv, createDecipheriv, randomBytes } from 'crypto'

interface EncryptedExport {
  version: '1.0'
  encryption: {
    algorithm: 'aes-256-gcm'
    kdf: 'pbkdf2'
    iterations: 100000
    salt: string // base64
    iv: string // base64
    tag: string // base64
  }
  data: string // encrypted base64
}

function encryptExport(data: string, password: string): EncryptedExport {
  const salt = randomBytes(32)
  const iv = randomBytes(16)
  const key = pbkdf2Sync(password, salt, 100000, 32, 'sha256')
  
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(data, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const tag = cipher.getAuthTag()
  
  return {
    version: '1.0',
    encryption: {
      algorithm: 'aes-256-gcm',
      kdf: 'pbkdf2',
      iterations: 100000,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    },
    data: encrypted,
  }
}
```

### 2. Validasi saat Import

- Verify credential signatures
- Check expiration dates
- Validate issuer DIDs
- Check revocation status (jika applicable)

### 3. User Consent

- Konfirmasi sebelum export
- Warning tentang sensitive data
- Password requirement untuk encrypted export

---

## Limitasi dan Catatan Penting

### 1. AnonCreds Limitation

AnonCreds credentials **tidak bisa** di-import ke wallet lain karena:
- Terikat dengan `link_secret` (master secret) holder
- Link secret adalah private key yang tidak boleh di-export
- Credential signature terikat dengan link secret

**Solusi:**
- Export hanya untuk backup ke device yang sama
- Atau re-issue credential dari issuer

### 2. Key Binding

Beberapa credential (terutama yang menggunakan holder binding) tidak bisa dipindahkan ke wallet lain tanpa re-issuance.

### 3. Revocation

Credential yang sudah di-revoke tetap bisa di-export tapi tidak valid untuk proving.

---

## Flow Export/Import

### Export Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXPORT FLOW                                  │
└─────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────┐
│   User   │     │   Bifold     │     │   Export     │     │  File   │
│          │     │   Wallet     │     │   Service    │     │ System  │
└────┬─────┘     └──────┬───────┘     └──────┬───────┘     └────┬────┘
     │                  │                    │                  │
     │ 1. Tap Export    │                    │                  │
     ├─────────────────►│                    │                  │
     │                  │                    │                  │
     │ 2. Select        │                    │                  │
     │    Credentials   │                    │                  │
     │◄─────────────────┤                    │                  │
     │                  │                    │                  │
     │ 3. Confirm       │                    │                  │
     │    Selection     │                    │                  │
     ├─────────────────►│                    │                  │
     │                  │                    │                  │
     │                  │ 4. Export          │                  │
     │                  │    Credentials     │                  │
     │                  ├───────────────────►│                  │
     │                  │                    │                  │
     │ 5. Enter         │                    │                  │
     │    Password      │                    │                  │
     │◄─────────────────┤                    │                  │
     │                  │                    │                  │
     │ 6. Password      │                    │                  │
     ├─────────────────►│                    │                  │
     │                  │                    │                  │
     │                  │ 7. Encrypt         │                  │
     │                  ├───────────────────►│                  │
     │                  │                    │                  │
     │                  │                    │ 8. Save File     │
     │                  │                    ├─────────────────►│
     │                  │                    │                  │
     │ 9. Success       │                    │                  │
     │◄─────────────────┤                    │                  │
     │                  │                    │                  │
     ▼                  ▼                    ▼                  ▼
```

### Import Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         IMPORT FLOW                                  │
└─────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────┐
│   User   │     │   Bifold     │     │   Import     │     │  File   │
│          │     │   Wallet     │     │   Service    │     │ System  │
└────┬─────┘     └──────┬───────┘     └──────┬───────┘     └────┬────┘
     │                  │                    │                  │
     │ 1. Tap Import    │                    │                  │
     ├─────────────────►│                    │                  │
     │                  │                    │                  │
     │ 2. Select File   │                    │                  │
     │◄─────────────────┤                    │                  │
     │                  │                    │                  │
     │ 3. Pick File     │                    │                  │
     ├─────────────────►│                    │ 4. Read File     │
     │                  │                    ├─────────────────►│
     │                  │                    │◄─────────────────┤
     │                  │                    │                  │
     │ 5. Enter         │                    │                  │
     │    Password      │                    │                  │
     │◄─────────────────┤                    │                  │
     │                  │                    │                  │
     │ 6. Password      │                    │                  │
     ├─────────────────►│                    │                  │
     │                  │                    │                  │
     │                  │ 7. Decrypt &       │                  │
     │                  │    Validate        │                  │
     │                  ├───────────────────►│                  │
     │                  │                    │                  │
     │ 8. Preview       │                    │                  │
     │    Credentials   │                    │                  │
     │◄─────────────────┤                    │                  │
     │                  │                    │                  │
     │ 9. Confirm       │                    │                  │
     │    Import        │                    │                  │
     ├─────────────────►│                    │                  │
     │                  │                    │                  │
     │                  │ 10. Store          │                  │
     │                  │     Credentials    │                  │
     │                  ├───────────────────►│                  │
     │                  │                    │                  │
     │ 11. Success      │                    │                  │
     │◄─────────────────┤                    │                  │
     │                  │                    │                  │
     ▼                  ▼                    ▼                  ▼
```

---

## Rekomendasi

### Phase 1: MVP
1. Export/Import untuk **W3C JWT-VC** dan **SD-JWT VC** (portable formats)
2. Password-encrypted export file
3. Basic UI untuk select dan export

### Phase 2: Enhanced
1. Support **mDOC** export
2. QR code sharing untuk single credential
3. Cloud backup integration (optional)

### Phase 3: Advanced
1. **AnonCreds** backup (same device only)
2. Full wallet backup/restore
3. Cross-device migration dengan re-issuance flow

---

## Kesimpulan

**Ya, fitur export/import credential bisa dikembangkan** dengan catatan:

1. **W3C JWT-VC dan SD-JWT VC** - Fully portable, bisa di-export dan import ke wallet lain
2. **mDOC** - Portable dengan beberapa limitasi
3. **AnonCreds** - Hanya untuk backup, tidak bisa dipindahkan ke wallet lain

Rekomendasi: Mulai dengan W3C dan SD-JWT credentials karena format ini sudah self-contained dan portable.
