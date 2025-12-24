# Design Document: Trust Registry Integration

## Overview

Dokumen ini menjelaskan desain teknis untuk integrasi Trust Registry Protocol (ToIP TRQP v2) ke dalam Bifold Wallet. Implementasi akan dibuat sebagai package terpisah `@bifold/trust-registry` untuk menjaga kompatibilitas dengan upstream Bifold.

Trust Registry memungkinkan wallet untuk:
- Memverifikasi apakah issuer terdaftar dan berwenang menerbitkan credential type tertentu
- Memverifikasi apakah verifier terdaftar dan berwenang meminta credential type tertentu
- Menampilkan informasi trust status kepada user sebelum menerima credential atau membagikan proof

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BIFOLD WALLET                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐                       │
│  │ Credential Offer │    │  Proof Request   │                       │
│  │     Screen       │    │     Screen       │                       │
│  └────────┬─────────┘    └────────┬─────────┘                       │
│           │                       │                                  │
│           ▼                       ▼                                  │
│  ┌─────────────────────────────────────────┐                        │
│  │      TrustRegistryContext (Provider)    │                        │
│  │  ┌─────────────────────────────────┐    │                        │
│  │  │ - isEnabled                     │    │                        │
│  │  │ - isAvailable                   │    │                        │
│  │  │ - metadata                      │    │                        │
│  │  │ - checkIssuer()                 │    │                        │
│  │  │ - checkVerifier()               │    │                        │
│  │  └─────────────────────────────────┘    │                        │
│  └────────────────────┬────────────────────┘                        │
│                       │                                              │
│  ┌────────────────────┴────────────────────┐                        │
│  │         TrustRegistryService            │                        │
│  │  ┌─────────────────────────────────┐    │                        │
│  │  │ - getMetadata()                 │    │                        │
│  │  │ - lookupIssuer()                │    │                        │
│  │  │ - lookupVerifier()              │    │                        │
│  │  │ - checkIssuerAuthorization()    │    │                        │
│  │  │ - checkVerifierAuthorization()  │    │                        │
│  │  └─────────────────────────────────┘    │                        │
│  └────────────────────┬────────────────────┘                        │
│                       │                                              │
│  ┌────────────────────┴────────────────────┐                        │
│  │              CacheUtility               │                        │
│  │  - get(key)                             │                        │
│  │  - set(key, value, ttl)                 │                        │
│  │  - clear()                              │                        │
│  └─────────────────────────────────────────┘                        │
│                       │                                              │
└───────────────────────┼──────────────────────────────────────────────┘
                        │ HTTP/HTTPS
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TRUST REGISTRY SERVICE                            │
│                    (ToIP TRQP v2 Compliant)                          │
├─────────────────────────────────────────────────────────────────────┤
│  • GET  /v2/metadata                                                │
│  • GET  /v2/public/lookup/issuer/{did}                              │
│  • GET  /v2/public/lookup/verifier/{did}                            │
│  • POST /v2/authorization                                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Package Structure

```
packages/trust-registry/
├── package.json
├── tsconfig.json
├── jest.config.js
├── src/
│   ├── index.ts                    # Public exports
│   ├── types/
│   │   └── index.ts                # Type definitions
│   ├── services/
│   │   └── TrustRegistryService.ts # HTTP client
│   ├── contexts/
│   │   └── TrustRegistryContext.tsx # React context
│   ├── hooks/
│   │   ├── useIssuerTrust.ts       # Issuer trust hook
│   │   ├── useVerifierTrust.ts     # Verifier trust hook
│   │   └── useTrustRegistryStatus.ts # Registry status hook
│   ├── components/
│   │   ├── TrustBadge.tsx          # Trust status badge
│   │   ├── TrustWarning.tsx        # Warning banner
│   │   └── IssuerInfoCard.tsx      # Issuer details card
│   └── utils/
│       └── cache.ts                # Cache utility
└── __tests__/
    ├── services/
    │   └── TrustRegistryService.test.ts
    ├── hooks/
    │   └── useIssuerTrust.test.ts
    └── utils/
        └── cache.test.ts
```

### Service Interface

```typescript
// ITrustRegistryService interface
export interface ITrustRegistryService {
  // Service Discovery
  getMetadata(): Promise<TrustRegistryMetadata>
  isAvailable(): Promise<boolean>
  
  // Lookup (Quick Check)
  lookupIssuer(did: string): Promise<TrustResult>
  lookupVerifier(did: string): Promise<TrustResult>
  
  // Authorization (Detailed Check)
  checkIssuerAuthorization(issuerDid: string, credentialType: string): Promise<AuthorizationResponse>
  checkVerifierAuthorization(verifierDid: string, credentialType: string): Promise<AuthorizationResponse>
  
  // Cache Management
  clearCache(): void
}
```

### Context Interface

```typescript
// TrustRegistryContextValue interface
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

### Component Props

```typescript
// TrustBadge props
interface TrustBadgeProps {
  trustResult: TrustResult
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
  onPress?: () => void
}

// TrustWarning props
interface TrustWarningProps {
  trustResult: TrustResult
  entityType: 'issuer' | 'verifier'
  onDismiss?: () => void
  onLearnMore?: () => void
}

// IssuerInfoCard props
interface IssuerInfoCardProps {
  issuerInfo: IssuerInfo
  onPress?: () => void
}
```

## Data Models

### Configuration

```typescript
export interface TrustRegistryConfig {
  enabled: boolean                    // Enable/disable trust registry
  url: string                         // Trust registry base URL
  ecosystemDid: string                // Ecosystem/authority DID
  cacheTTL: number                    // Cache TTL in milliseconds
  showWarningForUntrusted: boolean    // Show warning for untrusted entities
  blockUntrustedIssuers: boolean      // Block credentials from untrusted issuers
  blockUntrustedVerifiers: boolean    // Block proof requests from untrusted verifiers
}
```

### API Response Types

```typescript
// Metadata response (GET /v2/metadata)
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

// Issuer lookup response (GET /v2/public/lookup/issuer/{did})
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

// Authorization response (POST /v2/authorization)
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
```

### Internal Types

```typescript
export type EntityStatus = 'pending' | 'active' | 'suspended' | 'revoked'
export type AccreditationLevel = 'high' | 'medium' | 'low'
export type TrustLevel = 'trusted_high' | 'trusted_medium' | 'trusted_low' | 'untrusted' | 'suspended' | 'revoked' | 'unknown'

export interface TrustResult {
  level: TrustLevel
  found: boolean
  entity?: IssuerInfo | VerifierInfo
  message?: string
  checkedAt: Date
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the acceptance criteria analysis, the following correctness properties have been identified:

### Property 1: Type Serialization Round-Trip

*For any* valid TrustRegistryConfig, TrustRegistryMetadata, IssuerInfo, VerifierInfo, AuthorizationRequest, AuthorizationResponse, or TrustResult object, serializing to JSON and then parsing back should produce an equivalent object.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

### Property 2: Entity Lookup Returns Correct TrustResult

*For any* valid DID and API response (found or not found), the lookupIssuer and lookupVerifier methods should return a TrustResult with:
- `found` matching the API response's `found` field
- `level` correctly mapped from entity status and accreditation level
- `entity` containing the parsed entity info when found
- `checkedAt` set to the current timestamp

**Validates: Requirements 3.2, 3.3**

### Property 3: Authorization Request Formatting

*For any* valid issuer/verifier DID and credential type, the checkIssuerAuthorization and checkVerifierAuthorization methods should construct an AuthorizationRequest with:
- `entity_id` set to the provided DID
- `authority_id` set to the configured ecosystem DID
- `action` set to "issue" for issuer or "verify" for verifier
- `resource` set to the provided credential type

**Validates: Requirements 3.4, 3.5**

### Property 4: DID URL Encoding

*For any* DID string containing special characters (colons, slashes, etc.), the URL-encoded version should:
- Be a valid URL path segment
- Decode back to the original DID
- Not contain unencoded special characters

**Validates: Requirements 3.6**

### Property 5: Cache TTL Behavior

*For any* cached value with a TTL:
- Retrieving before TTL expiry should return the cached value
- Retrieving after TTL expiry should return undefined (cache miss)
- The cache should not return stale data after expiry

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 6: Cache Key Uniqueness

*For any* two different queries (different DIDs, different query types, or different parameters), the generated cache keys should be different.

**Validates: Requirements 4.5**

### Property 7: Cache Clearing

*For any* cache state with entries, after calling clearCache(), all subsequent get operations should return undefined until new values are set.

**Validates: Requirements 4.4**

### Property 8: Trust Level to Badge Mapping

*For any* TrustResult with a valid trust level, the TrustBadge component should render:
- The correct icon type for that trust level
- The correct color for that trust level
- The correct label text for that trust level

The mapping should be deterministic and consistent.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

### Property 9: TrustBadge Size Rendering

*For any* size prop value ('small', 'medium', 'large'), the TrustBadge should render with appropriate dimensions that are distinct for each size.

**Validates: Requirements 6.8**

### Property 10: TrustWarning Dismissibility Based on Status

*For any* TrustResult:
- If entity is not found (untrusted), the warning should be dismissible
- If entity status is 'suspended' or 'revoked', the warning should NOT be dismissible

**Validates: Requirements 7.1, 7.2**

### Property 11: TrustWarning Accessibility

*For any* TrustWarning component instance, the rendered output should include:
- Appropriate ARIA role attribute
- Accessible label describing the warning
- Focusable interactive elements

**Validates: Requirements 7.4**

### Property 12: IssuerInfoCard Displays Required Information

*For any* IssuerInfo object, the IssuerInfoCard should render text content that includes:
- The issuer's name
- The issuer's DID
- The accreditation level (when present)
- All credential types (when present)
- Validity dates (when present)
- Registry name (when present)

**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

### Property 13: Graceful Degradation When Unavailable

*For any* service unavailability scenario, the system should:
- Not throw unhandled exceptions
- Return a TrustResult with level 'unknown'
- Allow the user flow to continue

**Validates: Requirements 10.1**

### Property 14: Network Retry Behavior

*For any* network timeout on the first attempt, the system should:
- Retry exactly once
- Only show error after the retry fails
- Not retry more than once

**Validates: Requirements 10.2**

### Property 15: Error Logging with Context

*For any* error that occurs during trust registry operations, the logged error should include:
- The operation that failed
- The relevant parameters (DID, credential type, etc.)
- The error message or code

**Validates: Requirements 10.3**

## Error Handling

### Error Types

```typescript
export class TrustRegistryError extends Error {
  constructor(
    message: string,
    public readonly code: TrustRegistryErrorCode,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'TrustRegistryError'
  }
}

export enum TrustRegistryErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INVALID_DID = 'INVALID_DID',
}
```

### Error Handling Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING FLOW                             │
└─────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌─────────────────┐     ┌─────────────────┐
│  API     │     │ TrustRegistry   │     │     UI          │
│  Call    │     │    Service      │     │   Component     │
└────┬─────┘     └────────┬────────┘     └────────┬────────┘
     │                    │                       │
     │ 1. Network Error   │                       │
     ├───────────────────►│                       │
     │                    │                       │
     │                    │ 2. Retry (1x)         │
     │◄───────────────────┤                       │
     │                    │                       │
     │ 3. Still Error     │                       │
     ├───────────────────►│                       │
     │                    │                       │
     │                    │ 4. Log Error          │
     │                    ├──────────────────────►│
     │                    │                       │
     │                    │ 5. Return TrustResult │
     │                    │    (level: 'unknown') │
     │                    ├──────────────────────►│
     │                    │                       │
     │                    │                       │ 6. Show Warning
     │                    │                       │    (Allow Continue)
     ▼                    ▼                       ▼
```

### Graceful Degradation

When trust registry is unavailable:
1. Log the error with context
2. Return `TrustResult` with `level: 'unknown'`
3. Display warning to user: "Trust status unknown - registry unavailable"
4. Allow user to proceed with their action

## Testing Strategy

### Dual Testing Approach

This implementation uses both unit tests and property-based tests:

- **Unit tests**: Verify specific examples, edge cases, and integration points
- **Property-based tests**: Verify universal properties that should hold across all inputs

### Property-Based Testing Library

**Library**: [fast-check](https://github.com/dubzzz/fast-check) - A TypeScript-first property-based testing library

**Configuration**: Each property test will run a minimum of 100 iterations.

### Test Structure

```
packages/trust-registry/__tests__/
├── services/
│   └── TrustRegistryService.test.ts
│       - Unit tests for API calls
│       - Property tests for response parsing
│       - Property tests for URL encoding
├── utils/
│   └── cache.test.ts
│       - Property tests for cache TTL behavior
│       - Property tests for cache key uniqueness
│       - Property tests for cache clearing
├── components/
│   ├── TrustBadge.test.tsx
│   │   - Property tests for trust level mapping
│   │   - Property tests for size rendering
│   └── TrustWarning.test.tsx
│       - Property tests for dismissibility
│       - Property tests for accessibility
├── hooks/
│   └── useIssuerTrust.test.ts
│       - Unit tests for hook behavior
└── types/
    └── serialization.test.ts
        - Property tests for type round-trip
```

### Property Test Annotation Format

Each property-based test will be annotated with:
```typescript
/**
 * **Feature: trust-registry, Property 1: Type Serialization Round-Trip**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 */
```

### Test Coverage Goals

| Component | Unit Tests | Property Tests |
|-----------|------------|----------------|
| TrustRegistryService | API mocking, error handling | Response parsing, URL encoding |
| Cache Utility | Basic operations | TTL behavior, key uniqueness |
| TrustBadge | Snapshot tests | Level mapping, size rendering |
| TrustWarning | Snapshot tests | Dismissibility, accessibility |
| IssuerInfoCard | Snapshot tests | Content rendering |
| Hooks | Integration tests | State management |

