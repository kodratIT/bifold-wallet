/**
 * Trust Registry Service
 * HTTP client for ToIP Trust Registry Query Protocol (TRQP) v2
 */

import {
  TrustRegistryConfig,
  TrustRegistryMetadata,
  IssuerInfo,
  VerifierInfo,
  AuthorizationRequest,
  AuthorizationResponse,
  TrustResult,
  TrustLevel,
  TrustRegistryError,
  TrustRegistryErrorCode,
  LookupResponse,
  EntityStatus,
  AccreditationLevel,
} from '../types'
import { TrustRegistryCache, CacheKeys } from '../utils/cache'

/**
 * Interface for Trust Registry Service
 */
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

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
}

/**
 * Default console logger
 */
const defaultLogger: Logger = {
  info: (message, context) => console.log(`[TrustRegistry] ${message}`, context),
  warn: (message, context) => console.warn(`[TrustRegistry] ${message}`, context),
  error: (message, context) => console.error(`[TrustRegistry] ${message}`, context),
}

/**
 * Normalize a DID. If it's an unqualified Indy DID, add the did:sov: prefix.
 */
export function normalizeDid(did: string): string {
  if (!did) return did
  if (did.startsWith('did:')) return did

  // Basic check for indy DID (base58, length around 22)
  // For simplicity and to match user expectation, we'll assume unqualified DIDs 
  // in this context should be did:sov
  return `did:sov:${did}`
}

/**
 * URL-encode a DID for use in URL path
 */
export function encodeDid(did: string): string {
  return encodeURIComponent(normalizeDid(did))
}

/**
 * Map entity status and accreditation level to TrustLevel
 */
export function mapToTrustLevel(
  status: EntityStatus,
  accreditationLevel?: AccreditationLevel
): TrustLevel {
  switch (status) {
    case 'suspended':
      return 'suspended'
    case 'revoked':
      return 'revoked'
    case 'pending':
      return 'untrusted'
    case 'active':
      switch (accreditationLevel) {
        case 'high':
          return 'trusted_high'
        case 'medium':
          return 'trusted_medium'
        case 'low':
          return 'trusted_low'
        default:
          return 'trusted_medium'
      }
    default:
      return 'unknown'
  }
}

/**
 * Trust Registry Service Implementation
 */
export class TrustRegistryService implements ITrustRegistryService {
  private config: TrustRegistryConfig
  private cache: TrustRegistryCache
  private logger: Logger
  private retryCount: number = 1

  constructor(config: TrustRegistryConfig, logger?: Logger) {
    this.config = {
      ...config,
      url: config.url.replace(/\/v2\/?$/, ''),
    }
    this.cache = new TrustRegistryCache(config.cacheTTL)
    this.logger = logger ?? defaultLogger
  }

  /**
   * Make HTTP request with retry logic
   */
  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retries: number = this.retryCount
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        this.logger.info(`Outgoing Request`, {
          url,
          method: options.method ?? 'GET',
          body: options.body ? JSON.parse(options.body as string) : undefined
        })

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          let errorBody = ''
          try {
            errorBody = await response.text()
          } catch (e) {
            errorBody = 'Could not read error body'
          }

          this.logger.error(`Trust Registry Request Failed`, {
            url,
            status: response.status,
            statusText: response.statusText,
            body: errorBody,
          })

          throw new TrustRegistryError(
            `HTTP ${response.status}: ${response.statusText}`,
            TrustRegistryErrorCode.INVALID_RESPONSE,
            { url, status: response.status, body: errorBody }
          )
        }

        return (await response.json()) as T
      } catch (error) {
        lastError = error as Error

        if (error instanceof TrustRegistryError) {
          throw error
        }

        // Log retry attempt
        if (attempt < retries) {
          this.logger.warn(`Request failed, retrying (${attempt + 1}/${retries})`, {
            url,
            error: lastError.message,
          })
        }
      }
    }

    // All retries failed
    this.logger.error('Request failed after retries', {
      url,
      error: lastError?.message,
    })

    if (lastError?.name === 'AbortError') {
      throw new TrustRegistryError(
        'Request timeout',
        TrustRegistryErrorCode.TIMEOUT,
        { url }
      )
    }

    throw new TrustRegistryError(
      lastError?.message ?? 'Network error',
      TrustRegistryErrorCode.NETWORK_ERROR,
      { url }
    )
  }

  /**
   * Get registry metadata
   */
  async getMetadata(): Promise<TrustRegistryMetadata> {
    const cacheKey = CacheKeys.metadata()
    const cached = this.cache.get<TrustRegistryMetadata>(cacheKey)

    if (cached) {
      return cached
    }

    const url = `${this.config.url}/v2/metadata`
    const metadata = await this.fetchWithRetry<TrustRegistryMetadata>(url)

    this.cache.set(cacheKey, metadata, 60 * 60 * 1000) // 1 hour cache for metadata
    return metadata
  }

  /**
   * Check if registry is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const metadata = await this.getMetadata()
      return metadata.status === 'operational'
    } catch {
      return false
    }
  }

  /**
   * Lookup issuer by DID
   */
  async lookupIssuer(did: string): Promise<TrustResult> {
    const normalizedDid = normalizeDid(did)
    const cacheKey = CacheKeys.issuer(normalizedDid)
    const cached = this.cache.get<TrustResult>(cacheKey)

    if (cached) {
      return cached
    }

    try {
      const url = `${this.config.url}/v2/public/lookup/issuer/${encodeDid(normalizedDid)}`
      const response = await this.fetchWithRetry<LookupResponse<IssuerInfo>>(url)

      const result = this.mapLookupResponseToTrustResult(response, 'issuer')
      this.cache.set(cacheKey, result)
      return result
    } catch (error) {
      this.logger.error('Failed to lookup issuer', {
        did: normalizedDid,
        error: (error as Error).message,
      })

      return {
        level: 'unknown',
        found: false,
        message: (error as Error).message,
        checkedAt: new Date(),
      }
    }
  }

  /**
   * Lookup verifier by DID
   */
  async lookupVerifier(did: string): Promise<TrustResult> {
    const cacheKey = CacheKeys.verifier(did)
    const cached = this.cache.get<TrustResult>(cacheKey)

    if (cached) {
      return cached
    }

    try {
      const url = `${this.config.url}/v2/public/lookup/verifier/${encodeDid(did)}`
      const response = await this.fetchWithRetry<LookupResponse<VerifierInfo>>(url)

      const result = this.mapLookupResponseToTrustResult(response, 'verifier')
      this.cache.set(cacheKey, result)
      return result
    } catch (error) {
      this.logger.error('Failed to lookup verifier', {
        did,
        error: (error as Error).message,
      })

      return {
        level: 'unknown',
        found: false,
        message: (error as Error).message,
        checkedAt: new Date(),
      }
    }
  }

  /**
   * Map lookup response to TrustResult
   */
  private mapLookupResponseToTrustResult(
    response: LookupResponse<IssuerInfo | VerifierInfo>,
    type: 'issuer' | 'verifier'
  ): TrustResult {
    const entity = type === 'issuer' ? response.data.issuer : response.data.verifier

    if (!response.data.found || !entity) {
      return {
        level: 'untrusted',
        found: false,
        message: response.data.message ?? 'Entity not found in registry',
        checkedAt: new Date(),
      }
    }

    return {
      level: mapToTrustLevel(entity.status, entity.accreditationLevel),
      found: true,
      entity,
      message: response.data.message,
      checkedAt: new Date(),
    }
  }

  /**
   * Check issuer authorization for a credential type
   */
  async checkIssuerAuthorization(
    issuerDid: string,
    credentialType: string
  ): Promise<AuthorizationResponse> {
    const normalizedIssuerDid = normalizeDid(issuerDid)
    const normalizedAuthorityId = normalizeDid(this.config.ecosystemDid)

    const cacheKey = CacheKeys.authorization(normalizedIssuerDid, 'issue', credentialType)
    const cached = this.cache.get<AuthorizationResponse>(cacheKey)

    if (cached) {
      return cached
    }

    const request: AuthorizationRequest = {
      entity_id: normalizedIssuerDid,
      authority_id: normalizedAuthorityId,
      action: 'issue',
      resource: credentialType,
      context: {
        time: new Date().toISOString(),
      },
    }

    const url = `${this.config.url}/v2/authorization`
    const response = await this.fetchWithRetry<AuthorizationResponse>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    this.cache.set(cacheKey, response, 60 * 1000) // 1 minute cache for auth
    return response
  }

  /**
   * Check verifier authorization for a credential type
   */
  async checkVerifierAuthorization(
    verifierDid: string,
    credentialType: string
  ): Promise<AuthorizationResponse> {
    const cacheKey = CacheKeys.authorization(verifierDid, 'verify', credentialType)
    const cached = this.cache.get<AuthorizationResponse>(cacheKey)

    if (cached) {
      return cached
    }

    const request: AuthorizationRequest = {
      entity_id: verifierDid,
      authority_id: this.config.ecosystemDid,
      action: 'verify',
      resource: credentialType,
      context: {
        time: new Date().toISOString(),
      },
    }

    const url = `${this.config.url}/v2/authorization`
    const response = await this.fetchWithRetry<AuthorizationResponse>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    this.cache.set(cacheKey, response, 60 * 1000) // 1 minute cache for auth
    return response
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear()
  }
}
