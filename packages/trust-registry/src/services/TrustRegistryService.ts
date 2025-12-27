/**
 * Trust Registry Service
 * HTTP client for ToIP Trust Registry Query Protocol (TRQP) v2
 * Simplified to use Authorization endpoint only
 */

import {
  TrustRegistryConfig,
  TrustRegistryMetadata,
  AuthorizationRequest,
  AuthorizationResponse,
  TrustRegistryError,
  TrustRegistryErrorCode,
  TrustLevel,
} from '../types'
import { TrustRegistryCache, CacheKeys } from '../utils/cache'

/**
 * Interface for Trust Registry Service
 */
export interface ITrustRegistryService {
  // Service Discovery
  getMetadata(): Promise<TrustRegistryMetadata>
  isAvailable(): Promise<boolean>

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
  info: (message, context) => console.log(`[TrustRegistry\n] ${message}`, context),
  warn: (message, context) => console.warn(`[TrustRegistry\n] ${message}`, context),
  error: (message, context) => console.error(`[TrustRegistry\n] ${message}`, context),
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
 * Map authorization response to TrustLevel
 */
export function mapAuthorizationToTrustLevel(authorized: boolean): TrustLevel {
  return authorized ? 'trusted_high' : 'untrusted'
}

/**
 * Trust Registry Service Implementation
 * Uses only Authorization endpoint
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
    const normalizedVerifierDid = normalizeDid(verifierDid)
    const normalizedAuthorityId = normalizeDid(this.config.ecosystemDid)

    const cacheKey = CacheKeys.authorization(normalizedVerifierDid, 'verify', credentialType)
    const cached = this.cache.get<AuthorizationResponse>(cacheKey)

    if (cached) {
      return cached
    }

    const request: AuthorizationRequest = {
      entity_id: normalizedVerifierDid,
      authority_id: normalizedAuthorityId,
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
