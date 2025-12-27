import React, { useState, useCallback, useMemo } from 'react'
import { useFederatedTrust } from '../hooks/useFederatedTrust'
import { TrustBadge } from './TrustBadge'
import { TrustRegistryModal } from './TrustRegistryModal'
import { TrustResult } from '../types'

export interface TrustBadgeWrapperProps {
    issuerDid?: string
    credentialType?: string
    credential?: any
    /** Hide badge if unable to verify (error/unknown) */
    hideOnError?: boolean
    /** Allow clicking badge to show details (default: true) */
    showDetailsOnPress?: boolean
}

export const TrustBadgeWrapper: React.FC<TrustBadgeWrapperProps> = ({
    issuerDid,
    credentialType = 'Credential',
    credential,
    hideOnError = false,
    showDetailsOnPress = true
}) => {
    // Use Federated Trust hook to support both local and federation
    const federatedResult = useFederatedTrust(issuerDid, credential, credentialType)
    const { level, authorized, isLoading, message, trustSource, trustAuthority } = federatedResult

    const [modalVisible, setModalVisible] = useState(false)

    // Map FederatedTrustResult to TrustResult expected by components
    const trustResult: TrustResult | null = useMemo(() => {
        if (level === 'unknown' && !isLoading) {
            // If unknown and not loading, it might be effectively null or just unknown
            return {
                level: 'unknown',
                authorized: false,
                entityDid: issuerDid,
                credentialType,
                message: message || 'Trust status unknown',
                checkedAt: new Date()
            }
        }

        return {
            level,
            authorized,
            entityDid: issuerDid,
            credentialType,
            message,
            checkedAt: new Date(),
            // Extra fields for federation context
            trustSource,
            trustAuthority
        } as TrustResult
    }, [level, authorized, issuerDid, credentialType, message, isLoading, trustSource, trustAuthority])

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
                authResponse={null} // federatedResult doesn't return raw auth response, but trustResult has details
                onAccept={handleModalClose}
                onDecline={handleModalClose}
                onClose={handleModalClose}
            />
        </>
    )
}

export default TrustBadgeWrapper
