# Analisis Fitur Backup & Restore Wallet Bifold

## Overview

Dokumen ini menganalisis arsitektur Credo-TS di Bifold dan bagaimana mengimplementasikan fitur backup & restore wallet yang lengkap.

---

## Arsitektur Credo-TS di Bifold

### Modules yang Digunakan

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CREDO-TS MODULES DI BIFOLD                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STORAGE LAYER                                                       │
│  └── AskarModule (Aries Askar) - Encrypted SQLite Database          │
│                                                                      │
│  CREDENTIAL MODULES                                                  │
│  ├── AnonCredsModule - Indy credentials, ZKP proofs                 │
│  ├── CredentialsModule - W3C VC, JWT-VC                             │
│  └── OpenId4VcHolderModule - SD-JWT, mDOC                           │
│                                                                      │
│  PROTOCOL MODULES                                                    │
│  ├── ConnectionsModule - DIDComm connections                        │
│  ├── ProofsModule - Presentation exchange                           │
│  └── MediationRecipientModule - Message routing                     │
│                                                                      │
│  LEDGER/REGISTRY                                                     │
│  ├── IndyVdrModule - Indy ledger access                             │
│  └── DidsModule - DID resolution (peer, web, key, jwk)              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Konfigurasi Agent di Bifold

```typescript
// packages/core/src/utils/agent.ts
export function getAgentModules({ indyNetworks, mediatorInvitationUrl, txnCache }) {
  return {
    askar: new AskarModule({ ariesAskar }),
    anoncreds: new AnonCredsModule({
      anoncreds,
      registries: [new IndyVdrAnonCredsRegistry(), new WebVhAnonCredsRegistry()],
    }),
    indyVdr: new IndyVdrModule({ indyVdr, networks: indyNetworks }),
    connections: new ConnectionsModule({ autoAcceptConnections: true }),
    credentials: new CredentialsModule({ ... }),
    proofs: new ProofsModule({ ... }),
    mediationRecipient: new MediationRecipientModule({ ... }),
    openId4VcHolder: new OpenId4VcHolderModule(),
    dids: new DidsModule({ resolvers: [...] }),
  }
}
```


---

## Data Storage Architecture

### 1. Askar Database (Primary Storage)

Semua data wallet disimpan di Askar SQLite database yang terenkripsi.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ASKAR DATABASE CONTENTS                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Location: {DocumentDir}/.afj/data/wallet/{walletId}/sqlite.db      │
│                                                                      │
│  Contents:                                                           │
│  ├── 🔑 Keys (private keys, public keys)                            │
│  ├── 🔑 DIDs (did:peer, did:key documents)                          │
│  ├── 🔑 Link Secrets (AnonCreds master secret)                      │
│  ├── 🔗 Connection Records                                          │
│  ├── 📜 Credential Records                                          │
│  │   ├── AnonCreds credentials                                      │
│  │   ├── W3C credentials                                            │
│  │   ├── SD-JWT credentials                                         │
│  │   └── mDOC credentials                                           │
│  ├── 📝 Proof Records                                               │
│  ├── 📡 Mediation Records                                           │
│  └── ⚙️  Metadata                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Indy VDR Cache (External, Not Critical)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INDY VDR CACHE                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Location: {CachesDir}/indy-vdr-cache/                              │
│                                                                      │
│  Contents:                                                           │
│  ├── Schema definitions (dari ledger)                               │
│  ├── Credential definitions (dari ledger)                           │
│  └── Revocation registries                                          │
│                                                                      │
│  ⚠️  TIDAK perlu di-backup - ini cache dari public ledger           │
│      Bisa di-fetch ulang saat dibutuhkan                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. App Preferences (AsyncStorage/SecureStorage)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    APP PREFERENCES                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Location: AsyncStorage / SecureStorage                             │
│                                                                      │
│  Contents:                                                           │
│  ├── Onboarding state                                               │
│  ├── User preferences                                               │
│  ├── Tour completion flags                                          │
│  └── Biometry settings                                              │
│                                                                      │
│  ⚠️  Optional untuk backup - bisa di-reset ke default               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Keychain (Wallet Credentials)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    KEYCHAIN / SECURE STORAGE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Contents:                                                           │
│  ├── Wallet ID                                                      │
│  ├── Wallet Key (untuk decrypt Askar DB)                            │
│  └── Salt                                                           │
│                                                                      │
│  ⭐ CRITICAL untuk backup - tanpa ini, Askar DB tidak bisa dibuka   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```


---

## Apa yang Perlu di-Backup?

### Summary

| Item | Lokasi | Prioritas | Alasan |
|------|--------|-----------|--------|
| Askar Database | `.afj/data/wallet/{id}/sqlite.db` | ⭐⭐⭐ Critical | Semua credentials, keys, DIDs |
| Wallet Key | Keychain | ⭐⭐⭐ Critical | Decrypt Askar DB |
| Wallet ID & Salt | Keychain | ⭐⭐⭐ Critical | Identifikasi wallet |
| App Preferences | AsyncStorage | ⭐ Optional | User settings |
| Indy VDR Cache | CachesDir | ❌ Skip | Public data, bisa fetch ulang |
| Push Tokens | - | ❌ Skip | Device-specific |

### Key Insight

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SIMPLIFIED VIEW                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Untuk backup wallet Bifold, kamu hanya perlu:                     │
│                                                                      │
│   1. Askar SQLite database file                                     │
│   2. Wallet key (untuk decrypt database)                            │
│                                                                      │
│   Semua credentials (AnonCreds, W3C, SD-JWT, mDOC),                 │
│   DIDs, keys, connections - semuanya ada di Askar DB                │
│                                                                      │
│   Modules lain (AnonCreds, OpenID4VC, IndyVDR) adalah               │
│   logic/protocol handlers, bukan storage.                           │
│   Mereka semua menyimpan data ke Askar.                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Backup Process Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKUP PROCESS                                    │
└─────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   User clicks   │
                    │    "Backup"     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Close wallet   │  ◄── Penting! Consistent state
                    │  connection     │
                    └────────┬────────┘
                             │
                             ▼
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Read Askar DB  │ │  Read App       │ │  Read Keychain  │
│  (sqlite.db)    │ │  Preferences    │ │  (wallet key)   │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Combine into   │
                    │  backup package │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Encrypt with   │
                    │  user password  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Save .bifold   │
                    │  backup file    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Reopen wallet  │
                    └─────────────────┘
```


---

## Restore Process Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RESTORE PROCESS                                   │
└─────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │  Fresh install  │
                    │  or "Restore"   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Select backup  │
                    │  file (.bifold) │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Enter backup   │
                    │  password       │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Decrypt &      │
                    │  verify         │
                    └────────┬────────┘
                             │
                             ▼
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Restore Askar  │ │  Restore App    │ │  Restore        │
│  DB to correct  │ │  Preferences    │ │  Keychain       │
│  location       │ │                 │ │  (wallet key)   │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Initialize     │
                    │  agent with     │
                    │  restored data  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Set new PIN    │
                    │  (optional)     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Reconnect to   │
                    │  mediator       │
                    └─────────────────┘
```

---

## Backup File Format

### File Structure

```typescript
interface BifoldBackupFile {
  // Header
  header: {
    magic: 'BIFOLD_BACKUP_V1'
    version: '1.0.0'
    createdAt: string          // ISO timestamp
    platform: 'ios' | 'android'
    appVersion: string
  }
  
  // Encryption info
  encryption: {
    algorithm: 'aes-256-gcm'
    kdf: 'pbkdf2'
    iterations: 100000
    salt: string               // Base64
    iv: string                 // Base64
    tag: string                // Base64
  }
  
  // Encrypted payload
  payload: string              // Base64 encrypted JSON
  
  // Integrity check
  checksum: string             // SHA-256 of payload
}
```

### Payload Structure (setelah decrypt)

```typescript
interface BackupPayload {
  // Askar database (most important!)
  askarDatabase: {
    walletId: string
    walletKey: string          // Encrypted wallet key
    databaseBlob: string       // Base64 of sqlite.db
  }
  
  // App state (optional)
  appState?: {
    preferences: object
    onboarding: object
    tours: object
  }
  
  // Metadata for preview
  metadata: {
    credentialCount: number
    connectionCount: number
    didCount: number
    credentials: Array<{
      id: string
      type: 'anoncreds' | 'w3c' | 'sd-jwt' | 'mdoc'
      issuer: string
      issuedAt: string
    }>
  }
}
```


---

## Security Considerations

### Encryption Strategy

```typescript
// Double encryption approach:
// 1. Askar already encrypts DB with wallet key
// 2. Backup adds another layer with user password

const encryptionConfig = {
  algorithm: 'aes-256-gcm',    // Authenticated encryption
  kdf: 'pbkdf2',               // Key derivation
  iterations: 100000,          // Slow = secure against brute force
  keyLength: 32,               // 256 bits
  ivLength: 16,                // 128 bits
  tagLength: 16                // 128 bits auth tag
}
```

### Password Requirements

```typescript
const passwordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false,       // Optional untuk UX
  maxLength: 128
}
```

### Security Best Practices

1. **Never store backup password** - User harus ingat
2. **Warn about password loss** - Tidak bisa recover tanpa password
3. **Secure file handling** - Hapus temporary files setelah selesai
4. **Integrity verification** - Checksum untuk detect corruption

---

## User Interface Flow

### Backup UI Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKUP UI FLOW                               │
└─────────────────────────────────────────────────────────────────────┘

1. Settings > Backup Wallet
         │
         ▼
2. ┌─────────────────────────────┐
   │  ⚠️ Important Notice        │
   │                             │
   │  Your backup will contain   │
   │  all your credentials and   │
   │  private keys.              │
   │                             │
   │  Keep your backup file and  │
   │  password safe!             │
   │                             │
   │  [Continue]                 │
   └─────────────────────────────┘
         │
         ▼
3. ┌─────────────────────────────┐
   │  Create Backup Password     │
   │                             │
   │  Password: [••••••••••]     │
   │  Confirm:  [••••••••••]     │
   │                             │
   │  ✓ At least 8 characters    │
   │  ✓ Contains uppercase       │
   │  ✓ Contains number          │
   │                             │
   │  [Create Backup]            │
   └─────────────────────────────┘
         │
         ▼
4. ┌─────────────────────────────┐
   │  Creating Backup...         │
   │                             │
   │  ████████████░░░░░░ 60%     │
   │                             │
   │  Encrypting credentials...  │
   └─────────────────────────────┘
         │
         ▼
5. ┌─────────────────────────────┐
   │  Save Backup File           │
   │                             │
   │  📁 Save to Files           │
   │  ☁️  Save to iCloud/Drive   │
   │  📧 Send via Email          │
   │  📤 Share...                │
   └─────────────────────────────┘
         │
         ▼
6. ┌─────────────────────────────┐
   │  ✅ Backup Complete!        │
   │                             │
   │  Your wallet has been       │
   │  backed up successfully.    │
   │                             │
   │  Remember your password!    │
   │  Without it, you cannot     │
   │  restore your wallet.       │
   │                             │
   │  [Done]                     │
   └─────────────────────────────┘
```


### Restore UI Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RESTORE UI FLOW                               │
└─────────────────────────────────────────────────────────────────────┘

1. Onboarding > "I have a backup"
   OR Settings > Restore Wallet
         │
         ▼
2. ┌─────────────────────────────┐
   │  Select Backup File         │
   │                             │
   │  📁 Browse Files            │
   │  ☁️  From iCloud/Drive      │
   │                             │
   │  Supported: .bifold         │
   └─────────────────────────────┘
         │
         ▼
3. ┌─────────────────────────────┐
   │  Enter Backup Password      │
   │                             │
   │  Password: [••••••••••]     │
   │                             │
   │  [Verify]                   │
   └─────────────────────────────┘
         │
    ┌────┴────┐
    │         │
 Invalid    Valid
    │         │
    ▼         ▼
┌────────┐  ┌─────────────────────────────┐
│ ❌ Error│  │  Backup Preview             │
│ Wrong  │  │                             │
│ pass   │  │  Created: Dec 10, 2024      │
└────────┘  │  Credentials: 5             │
            │  Connections: 3             │
            │                             │
            │  • University Degree        │
            │  • Driver License           │
            │  • Employee Badge           │
            │  • ...                       │
            │                             │
            │  [Restore Wallet]           │
            └─────────────────────────────┘
         │
         ▼
4. ┌─────────────────────────────┐
   │  ⚠️ Warning                 │
   │                             │
   │  This will replace your     │
   │  current wallet data.       │
   │                             │
   │  [Cancel] [Continue]        │
   └─────────────────────────────┘
         │
         ▼
5. ┌─────────────────────────────┐
   │  Restoring...               │
   │                             │
   │  ████████████░░░░░░ 60%     │
   │                             │
   │  Importing credentials...   │
   └─────────────────────────────┘
         │
         ▼
6. ┌─────────────────────────────┐
   │  Set Wallet PIN             │
   │                             │
   │  Create a new PIN for       │
   │  your restored wallet.      │
   │                             │
   │  [• • • • • •]              │
   └─────────────────────────────┘
         │
         ▼
7. ┌─────────────────────────────┐
   │  ✅ Restore Complete!       │
   │                             │
   │  Your wallet has been       │
   │  restored successfully.     │
   │                             │
   │  5 credentials restored     │
   │  3 connections restored     │
   │                             │
   │  [Go to Wallet]             │
   └─────────────────────────────┘
```

---

## Package Structure

```
packages/wallet-backup/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── backup.ts
│   │   └── encryption.ts
│   ├── services/
│   │   ├── BackupService.ts        # Main backup logic
│   │   ├── RestoreService.ts       # Main restore logic
│   │   ├── EncryptionService.ts    # AES-256-GCM encryption
│   │   ├── FileService.ts          # File read/write
│   │   └── ValidationService.ts    # Backup validation
│   ├── contexts/
│   │   └── WalletBackupContext.tsx
│   ├── hooks/
│   │   ├── useBackup.ts
│   │   ├── useRestore.ts
│   │   └── useBackupStatus.ts
│   ├── screens/
│   │   ├── BackupScreen.tsx
│   │   ├── RestoreScreen.tsx
│   │   └── BackupPreviewScreen.tsx
│   ├── components/
│   │   ├── BackupPasswordModal.tsx
│   │   ├── BackupProgress.tsx
│   │   ├── CredentialPreview.tsx
│   │   └── BackupWarning.tsx
│   └── utils/
│       ├── fileHelpers.ts
│       ├── passwordValidation.ts
│       └── checksumUtils.ts
└── __tests__/
    ├── BackupService.test.ts
    ├── RestoreService.test.ts
    └── EncryptionService.test.ts
```


---

## Implementation Considerations

### 1. Wallet State Management

```typescript
// Harus close wallet sebelum backup untuk consistent state
async function prepareForBackup(agent: Agent): Promise<void> {
  // 1. Flush any pending writes
  await agent.wallet.close()
  
  // 2. Now safe to read database file
}

async function finalizeBackup(agent: Agent, walletConfig: WalletConfig): Promise<void> {
  // Reopen wallet after backup
  await agent.wallet.open(walletConfig)
}
```

### 2. File Locations (React Native)

```typescript
import RNFS from 'react-native-fs'

const paths = {
  // Askar database
  askarDb: `${RNFS.DocumentDirectoryPath}/.afj/data/wallet/${walletId}/sqlite.db`,
  
  // Backup output
  backupDir: `${RNFS.DocumentDirectoryPath}/backups/`,
  
  // Temporary files
  tempDir: `${RNFS.CachesDirectoryPath}/backup-temp/`,
}
```

### 3. Cross-Platform Considerations

| Platform | File Access | Share | Cloud |
|----------|-------------|-------|-------|
| iOS | DocumentDirectory | UIActivityViewController | iCloud |
| Android | DocumentDirectory | Intent.ACTION_SEND | Google Drive |

### 4. Error Handling

```typescript
enum BackupError {
  WALLET_LOCKED = 'WALLET_LOCKED',
  INSUFFICIENT_STORAGE = 'INSUFFICIENT_STORAGE',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  FILE_WRITE_FAILED = 'FILE_WRITE_FAILED',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
}

enum RestoreError {
  INVALID_BACKUP_FILE = 'INVALID_BACKUP_FILE',
  WRONG_PASSWORD = 'WRONG_PASSWORD',
  CORRUPTED_DATA = 'CORRUPTED_DATA',
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  WALLET_EXISTS = 'WALLET_EXISTS',
}
```

---

## Post-Restore Actions

Setelah restore berhasil, beberapa hal perlu dilakukan:

### 1. Reconnect to Mediator

```typescript
async function reconnectMediator(agent: Agent): Promise<void> {
  // Mediator connection mungkin stale
  // Perlu re-establish
  const mediationRecord = await agent.mediationRecipient.findDefaultMediator()
  if (mediationRecord) {
    await agent.mediationRecipient.initiateMessagePickup(mediationRecord)
  }
}
```

### 2. Refresh Credential Status

```typescript
async function refreshCredentialStatus(agent: Agent): Promise<void> {
  // Check revocation status untuk AnonCreds
  const credentials = await agent.credentials.getAll()
  for (const cred of credentials) {
    // Verify credential masih valid
  }
}
```

### 3. Update Push Notification Token

```typescript
async function updatePushToken(agent: Agent): Promise<void> {
  // Device baru = token baru
  // Perlu register ulang dengan mediator
}
```

---

## Limitations & Known Issues

### 1. AnonCreds Credentials

- ✅ Bisa di-backup dan restore ke device yang sama
- ✅ Bisa di-backup dan restore ke device berbeda (dengan link secret)
- ❌ Tidak bisa di-transfer ke wallet lain (different link secret)

### 2. Mediator State

- Connection ke mediator mungkin perlu di-refresh
- Messages yang pending mungkin hilang

### 3. Device-Specific Data

- Push notification tokens tidak di-backup
- Biometric settings perlu di-setup ulang

### 4. Version Compatibility

- Backup dari versi lama mungkin tidak compatible
- Perlu migration logic untuk handle version differences

---

## Kesimpulan

### Feasibility: ✅ BISA DITERAPKAN

Fitur backup & restore wallet Bifold **bisa diimplementasikan** karena:

1. **Single Storage Point** - Semua data ada di Askar database
2. **File System Access** - React Native bisa akses file system
3. **Encryption Libraries** - Crypto tersedia di React Native
4. **Share Functionality** - Native sharing bisa digunakan

### Effort Estimate

| Phase | Task | Effort |
|-------|------|--------|
| 1 | Core backup/restore logic | 3-4 days |
| 2 | Encryption service | 1-2 days |
| 3 | UI screens | 2-3 days |
| 4 | Testing | 2-3 days |
| 5 | Edge cases & polish | 2-3 days |
| **Total** | | **10-15 days** |

### Next Steps

1. Buat spec lengkap (requirements, design, tasks)
2. Prototype backup service
3. Test dengan berbagai credential types
4. Implement UI
5. Security review
