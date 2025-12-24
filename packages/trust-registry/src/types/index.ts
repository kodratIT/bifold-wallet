/**
 * Trust Registry Type Definitions
 * Based on ToIP Trust Registry Query Protocol (TRQP) v2
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for Trust Registry integration
 */
export interface TrustRegistryConfig {
  /** Enable/disable trust registry feature */
  enabled: boolean
  /** Trust registry base URL */
  url: string
  /** Ecosystem/authority DID */
  ecosystemDid: string
  /** Cache TTL in milliseconds */
  cacheTTL: number
  /** Show warning for untrusted entities */
  showWarningForUntrusted: boolean
  /** Block credentials from untrusted issuers */
  blockUntrustedIssuers: boolean
  /** Block proof requests from untrusted verifiers */
  blockUntrustedVerifiers: boolean
}

// ============================================================================
// API Response Types (ToIP TRQP v2)
// ============================================================================

/**
 * Registry metadata response (GET /v2/metadata)
 */
export interface TrustRegistryMetadata {
  name: string
  version: string
  protocol: string
  status: RegistryStatus
  supportedActions: string[]
  supportedDIDMethods: string[]
  features: RegistryFeatures
  endpoints?: RegistryEndpoints
}

export type RegistryStatus = 'operational' | 'maintenance' | 'degraded'

export interface RegistryFeatures {
  authorization: boolean
  recognition: boolean
  delegation: boolean
  publicTrustedList: boolean
}

export interface RegistryEndpoints {
  authorization?: string
  public?: {
    lookupIssuer?: string
    lookupVerifier?: string
  }
}

// ============================================================================
// Entity Types
// ============================================================================

export type EntityStatus = 'pending' | 'active' | 'suspended' | 'revoked'
export type AccreditationLevel = 'high' | 'medium' | 'low'

/**
 * Credential type information
 */
export interface CredentialTypeInfo {
  id?: string
  type: string
  name?: string
}

/**
 * Jurisdiction information
 */
export interface Jurisdiction {
  code: string
  name?: string
}

/**
 * Registry information
 */
export interface RegistryInfo {
  id?: string
  name: string
  ecosystemDid?: string
}

/**
 * Issuer information (GET /v2/public/lookup/issuer/{did})
 */
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

/**
 * Verifier information (GET /v2/public/lookup/verifier/{did})
 */
export interface VerifierInfo {
  did: string
  name: string
  status: EntityStatus
  accreditationLevel?: AccreditationLevel
  credentialTypes: CredentialTypeInfo[]
  jurisdictions?: Jurisdiction[]
  registry?: RegistryInfo
}

/**
 * Lookup response (direct structure)
 */
export interface LookupResponse<T> {
  found: boolean
  issuer?: T
  verifier?: T
  message?: string
}

// ============================================================================
// Authorization Types (POST /v2/authorization)
// ============================================================================

/**
 * Authorization request
 */
export interface AuthorizationRequest {
  entity_id: string
  authority_id: string
  action: 'issue' | 'verify'
  resource: string
  context?: {
    time?: string
    [key: string]: unknown
  }
}

/**
 * Authorization response
 */
export interface AuthorizationResponse {
  entity_id: string
  authority_id: string
  action: string
  resource: string
  authorized: boolean
  time_requested?: string
  time_evaluated: string
  message: string
  context?: Record<string, unknown>
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Trust level classification
 */
export type TrustLevel =
  | 'trusted_high'
  | 'trusted_medium'
  | 'trusted_low'
  | 'untrusted'
  | 'suspended'
  | 'revoked'
  | 'unknown'

/**
 * Trust check result
 */
export interface TrustResult {
  level: TrustLevel
  found: boolean
  entity?: IssuerInfo | VerifierInfo
  message?: string
  checkedAt: Date
}

// ============================================================================
// Error Types
// ============================================================================

export enum TrustRegistryErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INVALID_DID = 'INVALID_DID',
}

/**
 * Trust Registry Error
 */
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

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/**
 * Trust Registry Context value
 */
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
