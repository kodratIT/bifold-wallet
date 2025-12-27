/**
 * useVerifierTrust Hook
 * Hook for checking verifier trust status via Authorization
 */

import { useState, useEffect, useCallback } from 'react'
import { TrustResult, AuthorizationResponse } from '../types'
import { useTrustRegistry } from '../contexts/TrustRegistryContext'
import { mapAuthorizationToTrustLevel } from '../services/TrustRegistryService'

/**
 * Return type for useVerifierTrust hook
 */
export interface UseVerifierTrustResult {
  /** Trust result for the verifier */
  trustResult: TrustResult | null
  /** Authorization response from API */
  authResponse: AuthorizationResponse | null
  /** Whether the trust check is in progress */
  isLoading: boolean
  /** Error message if the check failed */
  error: string | null
  /** Function to manually refresh the trust status */
  refresh: () => Promise<void>
}

/**
 * Hook to check verifier trust status via authorization
 * @param did - The DID of the verifier to check
 * @param credentialType - The credential type to check authorization for
 * @returns Trust result, authorization response, loading state, and error
 */
export function useVerifierTrust(
  did: string | undefined,
  credentialType: string = 'Credential'
): UseVerifierTrustResult {
  const { isEnabled, checkVerifierAuthorization } = useTrustRegistry()
  const [trustResult, setTrustResult] = useState<TrustResult | null>(null)
  const [authResponse, setAuthResponse] = useState<AuthorizationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTrustStatus = useCallback(async () => {
    if (!did || !isEnabled) {
      setTrustResult(null)
      setAuthResponse(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await checkVerifierAuthorization(did, credentialType)
      setAuthResponse(response)

      // Create TrustResult from authorization response
      const result: TrustResult = {
        level: mapAuthorizationToTrustLevel(response.authorized),
        authorized: response.authorized,
        entityDid: response.entity_id,
        credentialType: response.resource,
        action: 'verify',
        message: response.message,
        checkedAt: new Date(),
      }
      setTrustResult(result)
    } catch (err) {
      setError((err as Error).message)
      setTrustResult({
        level: 'unknown',
        authorized: false,
        entityDid: did,
        message: (err as Error).message,
        checkedAt: new Date(),
      })
      setAuthResponse(null)
    } finally {
      setIsLoading(false)
    }
  }, [did, credentialType, isEnabled, checkVerifierAuthorization])

  // Fetch trust status when DID or credentialType changes
  useEffect(() => {
    fetchTrustStatus()
  }, [fetchTrustStatus])

  const refresh = useCallback(async () => {
    await fetchTrustStatus()
  }, [fetchTrustStatus])

  return {
    trustResult,
    authResponse,
    isLoading,
    error,
    refresh,
  }
}
