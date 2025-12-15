/**
 * useIssuerTrust Hook
 * Hook for checking issuer trust status
 */

import { useState, useEffect, useCallback } from 'react'
import { TrustResult } from '../types'
import { useTrustRegistry } from '../contexts/TrustRegistryContext'

/**
 * Return type for useIssuerTrust hook
 */
export interface UseIssuerTrustResult {
  /** Trust result for the issuer */
  trustResult: TrustResult | null
  /** Whether the trust check is in progress */
  isLoading: boolean
  /** Error message if the check failed */
  error: string | null
  /** Function to manually refresh the trust status */
  refresh: () => Promise<void>
}

/**
 * Hook to check issuer trust status
 * @param did - The DID of the issuer to check
 * @returns Trust result, loading state, and error
 */
export function useIssuerTrust(did: string | undefined): UseIssuerTrustResult {
  const { isEnabled, checkIssuer } = useTrustRegistry()
  const [trustResult, setTrustResult] = useState<TrustResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTrustStatus = useCallback(async () => {
    if (!did || !isEnabled) {
      setTrustResult(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await checkIssuer(did)
      setTrustResult(result)
    } catch (err) {
      setError((err as Error).message)
      setTrustResult({
        level: 'unknown',
        found: false,
        message: (err as Error).message,
        checkedAt: new Date(),
      })
    } finally {
      setIsLoading(false)
    }
  }, [did, isEnabled, checkIssuer])

  // Fetch trust status when DID changes
  useEffect(() => {
    fetchTrustStatus()
  }, [fetchTrustStatus])

  const refresh = useCallback(async () => {
    await fetchTrustStatus()
  }, [fetchTrustStatus])

  return {
    trustResult,
    isLoading,
    error,
    refresh,
  }
}
