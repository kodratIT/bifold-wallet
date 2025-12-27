/**
 * Trust Registry Cache Utility
 * In-memory cache with TTL support
 */

import { CacheEntry } from '../types'

/**
 * Cache key types for different query types
 */
export type CacheKeyType = 'metadata' | 'issuer' | 'verifier' | 'auth' | 'recognition'

/**
 * Generate a unique cache key
 */
export function generateCacheKey(
  type: CacheKeyType,
  ...params: string[]
): string {
  const parts = [type, ...params].filter(Boolean)
  return parts.join(':')
}

/**
 * In-memory cache with TTL support
 */
export class TrustRegistryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map()
  private defaultTTL: number

  /**
   * Create a new cache instance
   * @param defaultTTL Default TTL in milliseconds
   */
  constructor(defaultTTL: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTL
  }

  /**
   * Get a value from cache
   * @param key Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      return undefined
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value as T
  }

  /**
   * Set a value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl TTL in milliseconds (optional, uses default if not provided)
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL)
    this.cache.set(key, { value, expiresAt })
  }

  /**
   * Check if a key exists and is not expired
   * @param key Cache key
   * @returns true if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete a specific key from cache
   * @param key Cache key
   * @returns true if key was deleted
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get the number of entries in cache (including expired)
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Remove all expired entries
   * @returns Number of entries removed
   */
  prune(): number {
    const now = Date.now()
    let removed = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        removed++
      }
    }

    return removed
  }

  /**
   * Get all keys in cache (including expired)
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }
}

// Pre-defined cache key generators
export const CacheKeys = {
  metadata: () => generateCacheKey('metadata'),
  issuer: (did: string) => generateCacheKey('issuer', did),
  verifier: (did: string) => generateCacheKey('verifier', did),
  authorization: (entityId: string, action: string, resource: string) =>
    generateCacheKey('auth', entityId, action, resource),
  recognition: (foreignAuthorityDid: string) =>
    generateCacheKey('recognition', foreignAuthorityDid),
}
