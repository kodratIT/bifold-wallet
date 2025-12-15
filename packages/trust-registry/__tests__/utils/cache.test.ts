/**
 * Cache Utility Tests
 * Property-based tests for cache behavior
 */

import * as fc from 'fast-check'
import { TrustRegistryCache, generateCacheKey, CacheKeys } from '../../src/utils/cache'

describe('TrustRegistryCache', () => {
  const numRuns = 100

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      const cache = new TrustRegistryCache()
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
    })

    it('should return undefined for non-existent keys', () => {
      const cache = new TrustRegistryCache()
      expect(cache.get('nonexistent')).toBeUndefined()
    })
  })

  /**
   * **Feature: trust-registry, Property 5: Cache TTL Behavior**
   * **Validates: Requirements 4.1, 4.2, 4.3**
   */
  describe('Property 5: Cache TTL Behavior', () => {
    it('values should be retrievable before TTL expiry', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.jsonValue(),
          fc.integer({ min: 100, max: 10000 }),
          (key, value, ttl) => {
            const cache = new TrustRegistryCache(ttl)
            cache.set(key, value)
            
            // Immediately after setting, value should be retrievable
            const retrieved = cache.get(key)
            expect(retrieved).toEqual(value)
          }
        ),
        { numRuns }
      )
    })

    it('values should not be retrievable after TTL expiry', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.jsonValue(),
          (key, value) => {
            const cache = new TrustRegistryCache(1) // 1ms TTL
            cache.set(key, value, 1)
            
            // Wait for expiry
            const start = Date.now()
            while (Date.now() - start < 5) {
              // Busy wait for 5ms to ensure TTL expires
            }
            
            // After expiry, value should be undefined
            const retrieved = cache.get(key)
            expect(retrieved).toBeUndefined()
          }
        ),
        { numRuns: 10 } // Fewer runs due to timing sensitivity
      )
    })

    it('has() should return false for expired entries', () => {
      const cache = new TrustRegistryCache(1)
      cache.set('key', 'value', 1)
      
      // Wait for expiry
      const start = Date.now()
      while (Date.now() - start < 5) {
        // Busy wait
      }
      
      expect(cache.has('key')).toBe(false)
    })

    it('custom TTL should override default TTL', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.jsonValue(),
          (key, value) => {
            const cache = new TrustRegistryCache(1) // 1ms default
            cache.set(key, value, 60000) // 60s custom TTL
            
            // Wait a bit
            const start = Date.now()
            while (Date.now() - start < 5) {
              // Busy wait
            }
            
            // Should still be available due to longer custom TTL
            expect(cache.get(key)).toEqual(value)
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  /**
   * **Feature: trust-registry, Property 6: Cache Key Uniqueness**
   * **Validates: Requirements 4.5**
   */
  describe('Property 6: Cache Key Uniqueness', () => {
    it('different DIDs should produce different cache keys', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (did1, did2) => {
            fc.pre(did1 !== did2)
            
            const key1 = CacheKeys.issuer(did1)
            const key2 = CacheKeys.issuer(did2)
            
            expect(key1).not.toBe(key2)
          }
        ),
        { numRuns }
      )
    })

    it('different query types should produce different cache keys', () => {
      fc.assert(
        fc.property(fc.string(), (did) => {
          const issuerKey = CacheKeys.issuer(did)
          const verifierKey = CacheKeys.verifier(did)
          
          expect(issuerKey).not.toBe(verifierKey)
        }),
        { numRuns }
      )
    })

    it('different authorization parameters should produce different keys', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.string(),
          fc.string(),
          (entityId1, entityId2, action, resource) => {
            fc.pre(entityId1 !== entityId2)
            
            const key1 = CacheKeys.authorization(entityId1, action, resource)
            const key2 = CacheKeys.authorization(entityId2, action, resource)
            
            expect(key1).not.toBe(key2)
          }
        ),
        { numRuns }
      )
    })

    it('same parameters should produce same cache key', () => {
      fc.assert(
        fc.property(fc.string(), (did) => {
          const key1 = CacheKeys.issuer(did)
          const key2 = CacheKeys.issuer(did)
          
          expect(key1).toBe(key2)
        }),
        { numRuns }
      )
    })
  })

  /**
   * **Feature: trust-registry, Property 7: Cache Clearing**
   * **Validates: Requirements 4.4**
   */
  describe('Property 7: Cache Clearing', () => {
    it('clear() should remove all entries', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(fc.string(), fc.jsonValue()), { minLength: 1, maxLength: 20 }),
          (entries) => {
            const cache = new TrustRegistryCache(60000)
            
            // Add all entries
            for (const [key, value] of entries) {
              cache.set(key, value)
            }
            
            // Clear cache
            cache.clear()
            
            // All entries should be gone
            for (const [key] of entries) {
              expect(cache.get(key)).toBeUndefined()
            }
            
            expect(cache.size).toBe(0)
          }
        ),
        { numRuns }
      )
    })

    it('after clear(), new values can be added', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.jsonValue(),
          (key, value) => {
            const cache = new TrustRegistryCache()
            cache.set('old', 'value')
            cache.clear()
            
            cache.set(key, value)
            expect(cache.get(key)).toEqual(value)
          }
        ),
        { numRuns }
      )
    })
  })

  describe('generateCacheKey', () => {
    it('should generate consistent keys', () => {
      expect(generateCacheKey('metadata')).toBe('metadata')
      expect(generateCacheKey('issuer', 'did:web:example.com')).toBe('issuer:did:web:example.com')
      expect(generateCacheKey('auth', 'entity', 'issue', 'credential')).toBe('auth:entity:issue:credential')
    })
  })

  describe('prune()', () => {
    it('should remove expired entries', () => {
      const cache = new TrustRegistryCache(1)
      cache.set('key1', 'value1', 1)
      cache.set('key2', 'value2', 60000) // Long TTL
      
      // Wait for first entry to expire
      const start = Date.now()
      while (Date.now() - start < 5) {
        // Busy wait
      }
      
      const removed = cache.prune()
      
      expect(removed).toBe(1)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBe('value2')
    })
  })
})
