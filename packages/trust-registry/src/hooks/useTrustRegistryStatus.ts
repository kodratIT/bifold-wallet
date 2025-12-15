/**
 * useTrustRegistryStatus Hook
 * Hook for checking trust registry availability and metadata
 */

import { useTrustRegistry } from '../contexts/TrustRegistryContext'
import { TrustRegistryMetadata } from '../types'

/**
 * Return type for useTrustRegistryStatus hook
 */
export interface UseTrustRegistryStatusResult {
  /** Whether trust registry feature is enabled */
  isEnabled: boolean
  /** Whether trust registry service is available */
  isAvailable: boolean
  /** Trust registry metadata */
  metadata: TrustRegistryMetadata | null
  /** Function to refresh metadata */
  refreshMetadata: () => Promise<void>
}

/**
 * Hook to get trust registry status and metadata
 * @returns Registry status, availability, and metadata
 */
export function useTrustRegistryStatus(): UseTrustRegistryStatusResult {
  const { isEnabled, isAvailable, metadata, refreshMetadata } = useTrustRegistry()

  return {
    isEnabled,
    isAvailable,
    metadata,
    refreshMetadata,
  }
}
