/**
 * Trust Registry Type Definitions
 * Based on ToIP Trust Registry Query Protocol (TRQP) v2
 * Simplified for Authorization-only flow
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

  /**
   * Optional local anchor configuration if different from url/ecosystemDid
   */
  localAnchor?: TrustAnchor
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
// Recognition Types (ToIP TRQP v2)
// ============================================================================

/**
 * Recognition Request
 */
export interface RecognitionRequest {
  entity_id: string // Foreign Authority DID
  authority_id: string // Local Anchor DID
  action: 'recognize' | 'govern'
  resource: string
  context?: {
    time?: string
    [key: string]: unknown
  }
}

/**
 * Recognition Response
 */
export interface RecognitionResponse {
  entity_id: string
  authority_id: string
  action: string
  resource: string
  recognized: boolean
  time_evaluated: string
  message?: string
  context?: Record<string, unknown>
}

/**
 * Trust Framework Info from Credential (termsOfUse)
 */
export interface TrustFramework {
  id: string // Authority DID
  name?: string
  registryUrl?: string // Optional direct URL
}

/**
 * Trust Anchor Definition
 */
export interface TrustAnchor {
  did: string
  url: string
  name?: string
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Trust level classification (derived from authorization)
 */
export type TrustLevel =
  | 'trusted_high'
  | 'trusted_medium'
  | 'trusted_low'
  | 'untrusted'
  | 'trusted_federation' // New level for federated trust
  | 'unknown'

/**
 * Trust result based on authorization check
 */
export interface TrustResult {
  level: TrustLevel
  authorized: boolean
  entityDid?: string
  credentialType?: string
  action?: 'issue' | 'verify'
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
  FEDERATION_FAILED = 'FEDERATION_FAILED',
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

  // Actions (Authorization-based)
  checkIssuerAuthorization: (did: string, credType: string) => Promise<AuthorizationResponse>
  checkVerifierAuthorization: (did: string, credType: string) => Promise<AuthorizationResponse>

  // Actions (Recognition-based for Federation)
  checkRecognition: (foreignAuthorityDid: string, resource?: string) => Promise<RecognitionResponse>

  // Utils
  refreshMetadata: () => Promise<void>
  clearCache: () => void
}
