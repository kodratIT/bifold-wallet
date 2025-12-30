import { useState, useEffect } from 'react'
import { useTrustRegistry } from '../contexts/TrustRegistryContext'
import { AuthorityDiscoveryService } from '../services/AuthorityDiscoveryService'
import { TrustLevel, TrustAnchor, TrustFramework } from '../types'

/**
 * Result from federated trust check
 */
export interface FederatedTrustResult {
    /** Trust level determined from verification */
    level: TrustLevel

    /** Whether the issuer is authorized (locally or via federation) */
    authorized: boolean

    /** Source of trust verification */
    trustSource: 'local' | 'federation' | 'unknown'

    /** Information about the trust authority that verified this */
    trustAuthority?: TrustFramework

    /** Loading state */
    isLoading: boolean

    /** Error if verification failed */
    error?: Error

    /** Detailed message about the verification result */
    message?: string
}

/**
 * Hook for federated trust verification
 * 
 * This hook implements a multi-step verification process:
 * 1. Check if issuer is authorized locally (existing authorization check)
 * 2. If not authorized locally, extract foreign authority from credential
 * 3. Check if local authority recognizes the foreign authority
 * 4. Return appropriate trust level and metadata
 * 
 * @param issuerDid - DID of the credential issuer
 * @param credential - The credential object (must contain termsOfUse for federation)
 * @param credentialType - Type of credential being verified
 * @returns Federated trust verification result
 */
export function useFederatedTrust(
    issuerDid: string | undefined,
    credential?: any,
    credentialType: string = 'Credential'
): FederatedTrustResult {
    const { isEnabled, config, checkIssuerAuthorization, checkRecognition } = useTrustRegistry()

    const [result, setResult] = useState<FederatedTrustResult>({
        level: 'unknown',
        authorized: false,
        trustSource: 'unknown',
        isLoading: true,
    })

    useEffect(() => {
        if (!isEnabled || !issuerDid) {
            setResult({
                level: 'unknown',
                authorized: false,
                trustSource: 'unknown',
                isLoading: false,
                message: isEnabled ? 'No issuer DID provided' : 'Trust registry not enabled',
            })
            return
        }

        let cancelled = false

        const verify = async () => {
            try {
                console.log(`[TrustRegistry] Starting federated trust check for issuer: ${issuerDid}, type: ${credentialType}`)
                setResult(prev => ({ ...prev, isLoading: true, error: undefined }))

                // Step 1: Check local authorization (existing flow)
                const authResponse = await checkIssuerAuthorization(issuerDid, credentialType)
                console.log(`[TrustRegistry] Local Authorization check for ${issuerDid}:`, authResponse)

                if (authResponse.authorized) {
                    console.log(`[TrustRegistry] Issuer ${issuerDid} is locally authorized.`)
                    // Issuer is directly authorized by local authority
                    if (!cancelled) {
                        setResult({
                            level: 'trusted_high',
                            authorized: true,
                            trustSource: 'local',
                            isLoading: false,
                            message: authResponse.message || 'Authorized by local trust authority',
                        })
                    }
                    return
                }

                // Step 2: Try federation - Extract foreign authority from credential
                console.log(`[TrustRegistry] Issuer not authorized locally. Attempting discovery from credential...`)
                const foreignAuthority = await AuthorityDiscoveryService.findAuthority(
                    issuerDid,
                    credential,
                    {
                        devMode: config?.devMode,
                        authority: config?.fallbackAuthority
                    }
                )
                console.log(`[TrustRegistry] Authority Discovery result for ${issuerDid}:`, foreignAuthority)

                if (!foreignAuthority) {
                    console.log(`[TrustRegistry] No foreign trust authority found for ${issuerDid}.`)
                    // No foreign authority found, issuer is untrusted
                    if (!cancelled) {
                        setResult({
                            level: 'untrusted',
                            authorized: false,
                            trustSource: 'unknown',
                            isLoading: false,
                            message: authResponse.message || 'Issuer not authorized and no trust framework found',
                        })
                    }
                    return
                }

                // Step 3: Check if local authority recognizes foreign authority
                console.log(`[TrustRegistry] Checking recognition for foreign authority: ${foreignAuthority.id}`)
                const recognitionResponse = await checkRecognition(
                    foreignAuthority.id,
                    credentialType
                )
                console.log(`[TrustRegistry] Recognition Response for ${foreignAuthority.id}:`, recognitionResponse)

                if (recognitionResponse.recognized) {
                    console.log(`[TrustRegistry] FINAL RESULT: Recognized via Federation (${foreignAuthority.name})`)
                    // Foreign authority is recognized - federation success!
                    if (!cancelled) {
                        setResult({
                            level: 'trusted_federation',
                            authorized: true,
                            trustSource: 'federation',
                            trustAuthority: foreignAuthority,
                            isLoading: false,
                            message: recognitionResponse.message ||
                                `Recognized via ${foreignAuthority.name || foreignAuthority.id}`,
                        })
                    }
                } else {
                    console.log(`[TrustRegistry] FINAL RESULT: Untrusted (Foreign authority not recognized)`)
                    // Foreign authority is not recognized
                    if (!cancelled) {
                        setResult({
                            level: 'untrusted',
                            authorized: false,
                            trustSource: 'unknown',
                            trustAuthority: foreignAuthority,
                            isLoading: false,
                            message: recognitionResponse.message ||
                                `Foreign authority ${foreignAuthority.name || foreignAuthority.id} is not recognized`,
                        })
                    }
                }

            } catch (error) {
                console.error(`[TrustRegistry] Error during trust verification:`, error)
                if (!cancelled) {
                    setResult({
                        level: 'unknown',
                        authorized: false,
                        trustSource: 'unknown',
                        isLoading: false,
                        error: error instanceof Error ? error : new Error('Unknown error'),
                        message: error instanceof Error ? error.message : 'Failed to verify trust',
                    })
                }
            }
        }

        verify()

        return () => {
            cancelled = true
        }
    }, [isEnabled, config, issuerDid, credential, credentialType, checkIssuerAuthorization, checkRecognition])

    return result
}
