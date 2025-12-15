/**
 * TrustRegistryService Tests
 * Property-based tests for service behavior
 */

import * as fc from 'fast-check'
import {
  TrustRegistryService,
  encodeDid,
  mapToTrustLevel,
} from '../../src/services/TrustRegistryService'
import {
  TrustRegistryConfig,
  EntityStatus,
  AccreditationLevel,
  TrustLevel,
} from '../../src/types'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Test config
const testConfig: TrustRegistryConfig = {
  enabled: true,
  url: 'https://trust-registry.example.com',
  ecosystemDid: 'did:web:ecosystem.example.com',
  cacheTTL: 5 * 60 * 1000,
  showWarningForUntrusted: true,
  blockUntrustedIssuers: false,
  blockUntrustedVerifiers: false,
}

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

describe('TrustRegistryService', () => {
  const numRuns = 100

  beforeEach(() => {
    mockFetch.mockReset()
    mockLogger.info.mockReset()
    mockLogger.warn.mockReset()
    mockLogger.error.mockReset()
  })

  /**
   * **Feature: trust-registry, Property 4: DID URL Encoding**
   * **Validates: Requirements 3.6**
   */
  describe('Property 4: DID URL Encoding', () => {
    it('encoded DID should be a valid URL path segment', () => {
      fc.assert(
        fc.property(
          // Use DID-like strings to test encoding
          fc.stringMatching(/^did:[a-z]+:[a-zA-Z0-9._:%-]+$/),
          (did) => {
            const encoded = encodeDid(did)
            // Encoded DID should decode back to original
            const decoded = decodeURIComponent(encoded)
            expect(decoded).toBe(did)
          }
        ),
        { numRuns }
      )
    })

    it('encoded DID should decode back to original', () => {
      fc.assert(
        fc.property(fc.string(), (did) => {
          const encoded = encodeDid(did)
          const decoded = decodeURIComponent(encoded)
          expect(decoded).toBe(did)
        }),
        { numRuns }
      )
    })

    it('common DID formats should encode correctly', () => {
      const testCases = [
        'did:web:example.com',
        'did:web:example.com:path:to:resource',
        'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        'did:indy:sovrin:WRfXPg8dantKVubE3HX8pw',
        'did:ethr:0xb9c5714089478a327f09197987f16f9e5d936e8a',
      ]

      for (const did of testCases) {
        const encoded = encodeDid(did)
        expect(decodeURIComponent(encoded)).toBe(did)
        // Colons should be encoded
        expect(encoded).not.toContain(':')
      }
    })
  })

  /**
   * **Feature: trust-registry, Property 2: Entity Lookup Returns Correct TrustResult**
   * **Validates: Requirements 3.2, 3.3**
   */
  describe('Property 2: Entity Lookup Returns Correct TrustResult', () => {
    const entityStatusArb = fc.constantFrom<EntityStatus>('pending', 'active', 'suspended', 'revoked')
    const accreditationLevelArb = fc.constantFrom<AccreditationLevel>('high', 'medium', 'low')

    it('mapToTrustLevel should correctly map status and accreditation', () => {
      // Test all combinations
      expect(mapToTrustLevel('active', 'high')).toBe('trusted_high')
      expect(mapToTrustLevel('active', 'medium')).toBe('trusted_medium')
      expect(mapToTrustLevel('active', 'low')).toBe('trusted_low')
      expect(mapToTrustLevel('active', undefined)).toBe('trusted_medium')
      expect(mapToTrustLevel('suspended', 'high')).toBe('suspended')
      expect(mapToTrustLevel('revoked', 'high')).toBe('revoked')
      expect(mapToTrustLevel('pending', 'high')).toBe('untrusted')
    })

    it('lookup should return found=true when entity exists', async () => {
      const service = new TrustRegistryService(testConfig, mockLogger)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            found: true,
            issuer: {
              did: 'did:web:issuer.example.com',
              name: 'Test Issuer',
              status: 'active',
              accreditationLevel: 'high',
              credentialTypes: [],
            },
          },
        }),
      })

      const result = await service.lookupIssuer('did:web:issuer.example.com')

      expect(result.found).toBe(true)
      expect(result.level).toBe('trusted_high')
      expect(result.entity).toBeDefined()
    })

    it('lookup should return found=false when entity not found', async () => {
      const service = new TrustRegistryService(testConfig, mockLogger)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            found: false,
            message: 'Entity not found',
          },
        }),
      })

      const result = await service.lookupIssuer('did:web:unknown.example.com')

      expect(result.found).toBe(false)
      expect(result.level).toBe('untrusted')
    })

    it('trust level should match entity status', () => {
      fc.assert(
        fc.property(
          entityStatusArb,
          fc.option(accreditationLevelArb, { nil: undefined }),
          (status, accreditation) => {
            const level = mapToTrustLevel(status, accreditation)

            if (status === 'suspended') {
              expect(level).toBe('suspended')
            } else if (status === 'revoked') {
              expect(level).toBe('revoked')
            } else if (status === 'pending') {
              expect(level).toBe('untrusted')
            } else if (status === 'active') {
              expect(['trusted_high', 'trusted_medium', 'trusted_low']).toContain(level)
            }
          }
        ),
        { numRuns }
      )
    })
  })

  /**
   * **Feature: trust-registry, Property 3: Authorization Request Formatting**
   * **Validates: Requirements 3.4, 3.5**
   */
  describe('Property 3: Authorization Request Formatting', () => {
    it('issuer authorization should use action "issue"', async () => {
      const service = new TrustRegistryService(testConfig, mockLogger)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entity_id: 'did:web:issuer.example.com',
          authority_id: testConfig.ecosystemDid,
          action: 'issue',
          resource: 'TestCredential',
          authorized: true,
          time_evaluated: new Date().toISOString(),
          message: 'Authorized',
        }),
      })

      await service.checkIssuerAuthorization('did:web:issuer.example.com', 'TestCredential')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/authorization'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"issue"'),
        })
      )
    })

    it('verifier authorization should use action "verify"', async () => {
      const service = new TrustRegistryService(testConfig, mockLogger)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entity_id: 'did:web:verifier.example.com',
          authority_id: testConfig.ecosystemDid,
          action: 'verify',
          resource: 'TestCredential',
          authorized: true,
          time_evaluated: new Date().toISOString(),
          message: 'Authorized',
        }),
      })

      await service.checkVerifierAuthorization('did:web:verifier.example.com', 'TestCredential')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/authorization'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"verify"'),
        })
      )
    })

    it('authorization request should include entity_id and resource', async () => {
      // Use fc.asyncProperty for proper async handling
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-zA-Z0-9:._-]+$/), // Valid DID-like characters
          fc.stringMatching(/^[a-zA-Z0-9_-]+$/), // Valid resource name characters
          async (entityId, resource) => {
            // Skip empty strings
            if (!entityId || !resource) return true

            const service = new TrustRegistryService(testConfig, mockLogger)

            // Clear previous mock calls
            mockFetch.mockClear()

            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                entity_id: entityId,
                authority_id: testConfig.ecosystemDid,
                action: 'issue',
                resource: resource,
                authorized: true,
                time_evaluated: new Date().toISOString(),
                message: 'Authorized',
              }),
            })

            await service.checkIssuerAuthorization(entityId, resource)

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
            expect(callBody.entity_id).toBe(entityId)
            expect(callBody.resource).toBe(resource)
            expect(callBody.authority_id).toBe(testConfig.ecosystemDid)
            return true
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  /**
   * **Feature: trust-registry, Property 13: Graceful Degradation When Unavailable**
   * **Validates: Requirements 10.1**
   */
  describe('Property 13: Graceful Degradation When Unavailable', () => {
    it('should return unknown trust level on network error', async () => {
      const service = new TrustRegistryService(testConfig, mockLogger)

      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await service.lookupIssuer('did:web:example.com')

      expect(result.level).toBe('unknown')
      expect(result.found).toBe(false)
      expect(result.message).toBeDefined()
    })

    it('should not throw unhandled exceptions on service unavailability', async () => {
      const service = new TrustRegistryService(testConfig, mockLogger)

      mockFetch.mockRejectedValue(new Error('Service unavailable'))

      // Should not throw
      const result = await service.lookupIssuer('did:web:example.com')
      expect(result).toBeDefined()
      expect(result.level).toBe('unknown')
    })
  })

  /**
   * **Feature: trust-registry, Property 14: Network Retry Behavior**
   * **Validates: Requirements 10.2**
   */
  describe('Property 14: Network Retry Behavior', () => {
    it('should retry once on network failure', async () => {
      const service = new TrustRegistryService(testConfig, mockLogger)

      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              found: true,
              issuer: {
                did: 'did:web:example.com',
                name: 'Test',
                status: 'active',
                credentialTypes: [],
              },
            },
          }),
        })

      const result = await service.lookupIssuer('did:web:example.com')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.found).toBe(true)
    })

    it('should not retry more than once', async () => {
      const service = new TrustRegistryService(testConfig, mockLogger)

      mockFetch.mockRejectedValue(new Error('Network error'))

      await service.lookupIssuer('did:web:example.com')

      // Initial call + 1 retry = 2 calls
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  /**
   * **Feature: trust-registry, Property 15: Error Logging with Context**
   * **Validates: Requirements 10.3**
   */
  describe('Property 15: Error Logging with Context', () => {
    it('should log errors with relevant context', async () => {
      const service = new TrustRegistryService(testConfig, mockLogger)

      mockFetch.mockRejectedValue(new Error('Network error'))

      await service.lookupIssuer('did:web:example.com')

      expect(mockLogger.error).toHaveBeenCalled()
      const errorCall = mockLogger.error.mock.calls[0]
      expect(errorCall[0]).toContain('Request failed after retries')
      expect(errorCall[1]).toHaveProperty('url')
    })

    it('should log retry attempts', async () => {
      const service = new TrustRegistryService(testConfig, mockLogger)

      mockFetch.mockRejectedValue(new Error('Network error'))

      await service.lookupIssuer('did:web:example.com')

      expect(mockLogger.warn).toHaveBeenCalled()
      const warnCall = mockLogger.warn.mock.calls[0]
      expect(warnCall[0]).toContain('retrying')
    })
  })

  describe('Cache behavior', () => {
    it('should cache lookup results', async () => {
      const service = new TrustRegistryService(testConfig, mockLogger)

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            found: true,
            issuer: {
              did: 'did:web:example.com',
              name: 'Test',
              status: 'active',
              credentialTypes: [],
            },
          },
        }),
      })

      // First call
      await service.lookupIssuer('did:web:example.com')
      // Second call (should use cache)
      await service.lookupIssuer('did:web:example.com')

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('clearCache should invalidate cached results', async () => {
      const service = new TrustRegistryService(testConfig, mockLogger)

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            found: true,
            issuer: {
              did: 'did:web:example.com',
              name: 'Test',
              status: 'active',
              credentialTypes: [],
            },
          },
        }),
      })

      await service.lookupIssuer('did:web:example.com')
      service.clearCache()
      await service.lookupIssuer('did:web:example.com')

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
