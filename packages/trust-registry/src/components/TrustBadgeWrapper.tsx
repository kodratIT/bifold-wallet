import React, { useState, useCallback, useMemo } from 'react'
import { useFederatedTrust } from '../hooks/useFederatedTrust'
import { useVerifierTrust } from '../hooks/useVerifierTrust'
import { TrustBadge } from './TrustBadge'
import { TrustRegistryModal } from './TrustRegistryModal'
import { TrustResult } from '../types'

export interface TrustBadgeWrapperProps {
    issuerDid?: string
    verifierDid?: string
    credentialType?: string
    credential?: any
    /** Hide badge if unable to verify (error/unknown) */
    hideOnError?: boolean
    /** Allow clicking badge to show details (default: true) */
    showDetailsOnPress?: boolean
}

export const TrustBadgeWrapper: React.FC<TrustBadgeWrapperProps> = ({
    issuerDid,
    verifierDid,
    credentialType = 'Credential',
    credential,
    hideOnError = false,
    showDetailsOnPress = true
}) => {
    // Use Issuer/Federated Trust hook if issuerDid is provided
    const federatedResult = useFederatedTrust(issuerDid, credential, credentialType)

    // Use Verifier Trust hook if verifierDid is provided
    const verifierTrustResult = useVerifierTrust(verifierDid, credentialType)

    const isLoading = issuerDid ? federatedResult.isLoading : (verifierDid ? verifierTrustResult.isLoading : false)
    const [modalVisible, setModalVisible] = useState(false)

    // Map result to TrustResult expected by components
    const trustResult: TrustResult | null = useMemo(() => {
        if (issuerDid) {
            const { level, authorized, message, trustSource, trustAuthority } = federatedResult
            return {
                level,
                authorized,
                entityDid: issuerDid,
                credentialType,
                message,
                checkedAt: new Date(),
                trustSource,
                trustAuthority,
                action: 'issue'
            } as TrustResult
        }

        if (verifierDid) {
            return verifierTrustResult.trustResult
        }

        return null
    }, [issuerDid, verifierDid, federatedResult, verifierTrustResult, credentialType])

    const handleBadgePress = useCallback(() => {
        if (showDetailsOnPress && trustResult && !isLoading) {
            setModalVisible(true)
        }
    }, [showDetailsOnPress, trustResult, isLoading])

    const handleModalClose = useCallback(() => {
        setModalVisible(false)
    }, [])

    // Show loading badge while checking
    if (isLoading) {
        return (
            <TrustBadge
                trustResult={{
                    level: 'unknown',
                    authorized: false,
                    checkedAt: new Date()
                }}
                isLoading={true}
            />
        )
    }

    // Don't render if result is null or (hideOnError is true and status unknown)
    if (!trustResult) {
        return null
    }

    return (
        <>
            <TrustBadge
                trustResult={trustResult}
                hideOnError={hideOnError}
                onPress={showDetailsOnPress ? handleBadgePress : undefined}
            />
            <TrustRegistryModal
                visible={modalVisible}
                trustResult={trustResult}
                authResponse={verifierDid ? verifierTrustResult.authResponse : null}
                onAccept={handleModalClose}
                onDecline={handleModalClose}
                onClose={handleModalClose}
            />
        </>
    )
}

export default TrustBadgeWrapper
