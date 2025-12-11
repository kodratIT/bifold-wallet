# Task List: Integrasi Trust Registry ke Bifold

## Strategi Fork-Friendly

Agar implementasi Trust Registry tetap kompatibel saat `git pull` dari upstream Bifold:

### Prinsip Utama
1. **Buat file baru** - Hindari modifikasi file existing sebisa mungkin
2. **Gunakan DI Container** - Register service via container, bukan hardcode
3. **Extend, jangan modify** - Gunakan inheritance/composition
4. **Feature flag** - Bisa di-enable/disable via config
5. **Separate package** - Idealnya buat package terpisah

### Struktur yang Direkomendasikan

```
packages/
├── core/                          # JANGAN MODIFY (upstream)
│   └── src/
│       ├── container-api.ts       # EXTEND (tambah tokens)
│       └── container-impl.ts      # EXTEND (register service)
│
└── trust-registry/                # PACKAGE BARU (aman dari conflict)
    ├── package.json
    ├── src/
    │   ├── index.ts
    │   ├── services/
    │   │   └── TrustRegistryService.ts
    │   ├── contexts/
    │   │   └── TrustRegistryContext.tsx
    │   ├── components/
    │   │   ├── TrustBadge.tsx
    │   │   └── TrustWarning.tsx
    │   ├── hooks/
    │   │   └── useTrustRegistry.ts
    │   ├── types/
    │   │   └── index.ts
    │   └── utils/
    │       └── cache.ts
    └── __tests__/
```

### Git Strategy

```bash
# Setup upstream
git remote add upstream https://github.com/openwallet-foundation/bifold-wallet.git

# Sync dengan upstream
git fetch upstream
git checkout main
git merge upstream/main

# Jika ada conflict di file yang kamu modify
git checkout --theirs packages/core/src/container-api.ts  # Ambil versi upstream
# Kemudian re-apply perubahan kamu secara manual
```

---

## Task List

### Phase 1: Setup Package & Types

#### Task 1.1: Buat package trust-registry
```
Lokasi: packages/trust-registry/
Status: [ ] Not Started
```

**Sub-tasks:**
- [ ] 1.1.1 Buat `packages/trust-registry/package.json`
- [ ] 1.1.2 Buat `packages/trust-registry/tsconfig.json`
- [ ] 1.1.3 Update root `package.json` workspaces
- [ ] 1.1.4 Buat `packages/trust-registry/src/index.ts`

**File: packages/trust-registry/package.json**
```json
{
  "name": "@bifold/trust-registry",
  "version": "1.0.0",
  "description": "Trust Registry integration for Bifold Wallet (ToIP TRQP v2)",
  "main": "build/index.js",
  "types": "build/index.d.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rimraf build",
    "test": "jest"
  },
  "dependencies": {
    "@bifold/core": "workspace:*"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-native": ">=0.70.0"
  }
}
```

---

#### Task 1.2: Definisikan Types
```
Lokasi: packages/trust-registry/src/types/index.ts
Status: [ ] Not Started
```

**Sub-tasks:**
- [ ] 1.2.1 Buat interface `TrustRegistryConfig`
- [ ] 1.2.2 Buat interface `TrustRegistryMetadata`
- [ ] 1.2.3 Buat interface `IssuerInfo`, `VerifierInfo`
- [ ] 1.2.4 Buat interface `AuthorizationRequest`, `AuthorizationResponse`
- [ ] 1.2.5 Buat type `TrustStatus`

**File: packages/trust-registry/src/types/index.ts**
```typescript
// Config
export interface TrustRegistryConfig {
  enabled: boolean
  url: string
  ecosystemDid: string
  cacheTTL: number
  showWarningForUntrusted: boolean
  blockUntrustedIssuers: boolean
  blockUntrustedVerifiers: boolean
}

// Metadata (dari GET /v2/metadata)
export interface TrustRegistryMetadata {
  name: string
  version: string
  protocol: string
  status: 'operational' | 'maintenance' | 'degraded'
  supportedActions: string[]
  supportedDIDMethods: string[]
  features: {
    authorization: boolean
    recognition: boolean
    delegation: boolean
    publicTrustedList: boolean
  }
}

// Entity Status
export type EntityStatus = 'pending' | 'active' | 'suspended' | 'revoked'
export type AccreditationLevel = 'high' | 'medium' | 'low'

// Issuer Info (dari GET /v2/public/lookup/issuer/{did})
export interface IssuerInfo {
  did: string
  name: string
  status: EntityStatus
  accreditationLevel?: AccreditationLevel
  credentialTypes: CredentialTypeInfo[]
  jurisdictions?: Jurisdiction[]
  validFrom?: string
  validUntil?: string
  registry?: RegistryInfo
}

export interface VerifierInfo {
  did: string
  name: string
  status: EntityStatus
  accreditationLevel?: AccreditationLevel
  credentialTypes: CredentialTypeInfo[]
  jurisdictions?: Jurisdiction[]
  registry?: RegistryInfo
}

export interface CredentialTypeInfo {
  id?: string
  type: string
  name?: string
}

export interface Jurisdiction {
  code: string
  name?: string
}

export interface RegistryInfo {
  id?: string
  name: string
  ecosystemDid?: string
}

// Lookup Response
export interface LookupResponse<T> {
  data: {
    found: boolean
    issuer?: T
    verifier?: T
    message?: string
  }
}

// Authorization (POST /v2/authorization)
export interface AuthorizationRequest {
  entity_id: string
  authority_id: string
  action: 'issue' | 'verify'
  resource: string
  context?: {
    time?: string
  }
}

export interface AuthorizationResponse {
  entity_id: string
  authority_id: string
  action: string
  resource: string
  authorized: boolean
  time_requested?: string
  time_evaluated: string
  message: string
  context?: Record<string, any>
}

// Trust Result (internal use)
export type TrustLevel = 'trusted_high' | 'trusted_medium' | 'trusted_low' | 'untrusted' | 'suspended' | 'revoked' | 'unknown'

export interface TrustResult {
  level: TrustLevel
  found: boolean
  entity?: IssuerInfo | VerifierInfo
  message?: string
  checkedAt: Date
}
```

---

### Phase 2: Service Layer

#### Task 2.1: Buat TrustRegistryService
```
Lokasi: packages/trust-registry/src/services/TrustRegistryService.ts
Status: [ ] Not Started
```

**Sub-tasks:**
- [ ] 2.1.1 Implement `getMetadata()` - GET /v2/metadata
- [ ] 2.1.2 Implement `lookupIssuer(did)` - GET /v2/public/lookup/issuer/{did}
- [ ] 2.1.3 Implement `lookupVerifier(did)` - GET /v2/public/lookup/verifier/{did}
- [ ] 2.1.4 Implement `checkAuthorization(request)` - POST /v2/authorization
- [ ] 2.1.5 Implement caching layer
- [ ] 2.1.6 Implement error handling

**Interface:**
```typescript
export interface ITrustRegistryService {
  // Service Discovery
  getMetadata(): Promise<TrustRegistryMetadata>
  isAvailable(): Promise<boolean>
  
  // Lookup
  lookupIssuer(did: string): Promise<TrustResult>
  lookupVerifier(did: string): Promise<TrustResult>
  
  // Authorization
  checkIssuerAuthorization(issuerDid: string, credentialType: string): Promise<AuthorizationResponse>
  checkVerifierAuthorization(verifierDid: string, credentialType: string): Promise<AuthorizationResponse>
  
  // Cache
  clearCache(): void
}
```

---

#### Task 2.2: Buat Cache Utility
```
Lokasi: packages/trust-registry/src/utils/cache.ts
Status: [ ] Not Started
```

**Sub-tasks:**
- [ ] 2.2.1 Implement in-memory cache dengan TTL
- [ ] 2.2.2 Implement cache key generation
- [ ] 2.2.3 Implement cache invalidation

---

### Phase 3: Context & Hooks

#### Task 3.1: Buat TrustRegistryContext
```
Lokasi: packages/trust-registry/src/contexts/TrustRegistryContext.tsx
Status: [ ] Not Started
```

**Sub-tasks:**
- [ ] 3.1.1 Buat TrustRegistryProvider
- [ ] 3.1.2 Buat useTrustRegistry hook
- [ ] 3.1.3 Manage state: metadata, availability, cache

**Interface:**
```typescript
export interface TrustRegistryContextValue {
  // State
  isEnabled: boolean
  isAvailable: boolean
  metadata: TrustRegistryMetadata | null
  
  // Actions
  checkIssuer: (did: string) => Promise<TrustResult>
  checkVerifier: (did: string) => Promise<TrustResult>
  checkIssuerAuthorization: (did: string, credType: string) => Promise<AuthorizationResponse>
  checkVerifierAuthorization: (did: string, credType: string) => Promise<AuthorizationResponse>
  
  // Utils
  refreshMetadata: () => Promise<void>
  clearCache: () => void
}
```

---

#### Task 3.2: Buat Custom Hooks
```
Lokasi: packages/trust-registry/src/hooks/
Status: [ ] Not Started
```

**Sub-tasks:**
- [ ] 3.2.1 `useIssuerTrust(did)` - Hook untuk check issuer trust
- [ ] 3.2.2 `useVerifierTrust(did)` - Hook untuk check verifier trust
- [ ] 3.2.3 `useTrustRegistryStatus()` - Hook untuk registry status

---

### Phase 4: UI Components

#### Task 4.1: Buat TrustBadge Component
```
Lokasi: packages/trust-registry/src/components/TrustBadge.tsx
Status: [ ] Not Started
```

**Sub-tasks:**
- [ ] 4.1.1 Design badge untuk setiap TrustLevel
- [ ] 4.1.2 Implement TrustBadge component
- [ ] 4.1.3 Add accessibility support
- [ ] 4.1.4 Add press handler untuk detail

**Props:**
```typescript
interface TrustBadgeProps {
  trustResult: TrustResult
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
  onPress?: () => void
}
```

---

#### Task 4.2: Buat TrustWarning Component
```
Lokasi: packages/trust-registry/src/components/TrustWarning.tsx
Status: [ ] Not Started
```

**Sub-tasks:**
- [ ] 4.2.1 Design warning banner
- [ ] 4.2.2 Implement dismissible warning
- [ ] 4.2.3 Add "Learn more" action

---

#### Task 4.3: Buat IssuerInfoCard Component
```
Lokasi: packages/trust-registry/src/components/IssuerInfoCard.tsx
Status: [ ] Not Started
```

**Sub-tasks:**
- [ ] 4.3.1 Display issuer details dari registry
- [ ] 4.3.2 Show credential types yang bisa di-issue
- [ ] 4.3.3 Show accreditation level
- [ ] 4.3.4 Show validity period

---

### Phase 5: Integration dengan Bifold Core

#### Task 5.1: Register di Container (Minimal Modification)
```
Lokasi: packages/core/src/container-api.ts (EXTEND)
Status: [ ] Not Started
```

**Sub-tasks:**
- [ ] 5.1.1 Tambah TRUST_REGISTRY_TOKENS
- [ ] 5.1.2 Tambah TokenMapping untuk trust registry

**Perubahan minimal di container-api.ts:**
```typescript
// Tambahkan di akhir file (sebelum export TOKENS)
export const TRUST_REGISTRY_TOKENS = {
  TRUST_REGISTRY_SERVICE: 'trust-registry.service',
  TRUST_REGISTRY_CONFIG: 'trust-registry.config',
} as const

// Extend TOKENS
export const TOKENS = {
  ...PROOF_TOKENS,
  // ... existing tokens
  ...TRUST_REGISTRY_TOKENS,  // ADD THIS
} as const
```

---

#### Task 5.2: Register Service di Container
```
Lokasi: packages/core/src/container-impl.ts (EXTEND)
Status: [ ] Not Started
```

**Perubahan minimal:**
```typescript
// Di method init(), tambahkan di akhir:
this._container.registerInstance(TOKENS.TRUST_REGISTRY_CONFIG, {
  enabled: false,  // Default disabled
  url: '',
  ecosystemDid: '',
  cacheTTL: 3600000,
  showWarningForUntrusted: true,
  blockUntrustedIssuers: false,
  blockUntrustedVerifiers: false,
})
```

---

#### Task 5.3: Wrap Provider di App (Fork-specific)
```
Lokasi: Your fork's App.tsx atau custom wrapper
Status: [ ] Not Started
```

**Di fork kamu, buat wrapper:**
```typescript
// packages/your-app/src/TrustRegistryWrapper.tsx
import { TrustRegistryProvider } from '@bifold/trust-registry'

export const TrustRegistryWrapper: React.FC<PropsWithChildren> = ({ children }) => {
  const config = {
    enabled: true,
    url: 'http://your-trust-registry.com',
    ecosystemDid: 'did:web:your-ecosystem.org',
    // ...
  }
  
  return (
    <TrustRegistryProvider config={config}>
      {children}
    </TrustRegistryProvider>
  )
}
```

---

### Phase 6: Screen Integration (Fork-specific)

#### Task 6.1: Extend CredentialOffer Screen
```
Lokasi: Your fork - custom screen atau HOC
Status: [ ] Not Started
```

**Strategi: Buat HOC atau custom screen**
```typescript
// packages/your-app/src/screens/CredentialOfferWithTrust.tsx
import { CredentialOffer } from '@bifold/core'
import { useIssuerTrust, TrustBadge } from '@bifold/trust-registry'

export const CredentialOfferWithTrust: React.FC<Props> = (props) => {
  const { trustResult, isLoading } = useIssuerTrust(props.issuerDid)
  
  return (
    <View>
      <TrustBadge trustResult={trustResult} />
      <CredentialOffer {...props} />
    </View>
  )
}
```

---

#### Task 6.2: Extend ProofRequest Screen
```
Lokasi: Your fork - custom screen atau HOC
Status: [ ] Not Started
```

**Sama seperti Task 6.1, buat wrapper untuk ProofRequest**

---

#### Task 6.3: Add Trust Registry Settings
```
Lokasi: Your fork - settings screen
Status: [ ] Not Started
```

**Sub-tasks:**
- [ ] 6.3.1 Add toggle enable/disable trust registry
- [ ] 6.3.2 Add input untuk registry URL
- [ ] 6.3.3 Add input untuk ecosystem DID
- [ ] 6.3.4 Add button untuk test connection

---

### Phase 7: Testing

#### Task 7.1: Unit Tests
```
Lokasi: packages/trust-registry/__tests__/
Status: [ ] Not Started
```

**Sub-tasks:**
- [ ] 7.1.1 Test TrustRegistryService
- [ ] 7.1.2 Test cache utility
- [ ] 7.1.3 Test hooks
- [ ] 7.1.4 Test components

---

#### Task 7.2: Integration Tests
```
Status: [ ] Not Started
```

**Sub-tasks:**
- [ ] 7.2.1 Test dengan mock Trust Registry server
- [ ] 7.2.2 Test error scenarios
- [ ] 7.2.3 Test offline behavior

---

## Summary: File yang Perlu Dibuat vs Dimodifikasi

### ✅ FILE BARU (Aman dari conflict)
```
packages/trust-registry/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types/index.ts
│   ├── services/TrustRegistryService.ts
│   ├── contexts/TrustRegistryContext.tsx
│   ├── hooks/useIssuerTrust.ts
│   ├── hooks/useVerifierTrust.ts
│   ├── hooks/useTrustRegistryStatus.ts
│   ├── components/TrustBadge.tsx
│   ├── components/TrustWarning.tsx
│   ├── components/IssuerInfoCard.tsx
│   └── utils/cache.ts
└── __tests__/
    └── ...
```

### ⚠️ FILE YANG DIMODIFIKASI (Perlu hati-hati saat merge)
```
packages/core/src/container-api.ts    # Tambah tokens (append only)
packages/core/src/container-impl.ts   # Register service (append only)
package.json                          # Update workspaces
```

### 🔧 FILE DI FORK KAMU (Tidak ada di upstream)
```
packages/your-app/src/
├── TrustRegistryWrapper.tsx
├── screens/CredentialOfferWithTrust.tsx
├── screens/ProofRequestWithTrust.tsx
└── screens/TrustRegistrySettings.tsx
```

---

## Git Workflow untuk Sync dengan Upstream

```bash
# 1. Setup (sekali saja)
git remote add upstream https://github.com/openwallet-foundation/bifold-wallet.git

# 2. Sebelum mulai kerja, sync dulu
git fetch upstream
git checkout main
git merge upstream/main

# 3. Jika ada conflict di container-api.ts atau container-impl.ts:
#    - Ambil versi upstream
#    - Re-apply perubahan kamu (append tokens/registration)

# 4. Buat branch untuk feature
git checkout -b feature/trust-registry

# 5. Commit perubahan
git add packages/trust-registry/
git commit -m "feat: add trust-registry package"

git add packages/core/src/container-api.ts
git commit -m "feat: add trust registry tokens to container"

# 6. Push ke fork kamu
git push origin feature/trust-registry
```
