/**
 * useVerifierTrust Hook
 * Hook for checking verifier trust status via Authorization
 */

import { useState, useEffect, useCallback } from 'react'
import { TrustResult, AuthorizationResponse } from '../types'
import { useTrustRegistry } from '../contexts/TrustRegistryContext'
import { mapAuthorizationToTrustLevel } from '../services/TrustRegistryService'
import { AuthorityDiscoveryService } from '../services/AuthorityDiscoveryService'

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
  const { isEnabled, config, checkVerifierAuthorization, checkRecognition } = useTrustRegistry()
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
      // Step 1: Check local authorization
      const response = await checkVerifierAuthorization(did, credentialType)
      setAuthResponse(response)

      if (response.authorized) {
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
        return
      }

      // Step 2: Try Federation (Recognition)
      // We already have checkRecognition from useTrustRegistry() call at top of hook
      const foreignAuthority = await AuthorityDiscoveryService.findAuthority(did, undefined, {
        devMode: config?.devMode,
        authority: config?.fallbackAuthority
      })

      if (foreignAuthority) {
        const recognitionResponse = await checkRecognition(foreignAuthority.id, credentialType)
        if (recognitionResponse.recognized) {
          setTrustResult({
            level: 'trusted_federation',
            authorized: true,
            entityDid: did,
            credentialType,
            action: 'verify',
            message: recognitionResponse.message || `Recognized via ${foreignAuthority.name || foreignAuthority.id}`,
            checkedAt: new Date(),
          })
          return
        }
      }

      // Step 3: Not authorized and not recognized
      setTrustResult({
        level: mapAuthorizationToTrustLevel(false),
        authorized: false,
        entityDid: response.entity_id,
        credentialType: response.resource,
        action: 'verify',
        message: response.message || 'Verifier not authorized',
        checkedAt: new Date(),
      })
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
  }, [did, credentialType, isEnabled, config, checkVerifierAuthorization, checkRecognition])

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
