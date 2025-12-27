import React, { useState, useCallback } from 'react'
import { useIssuerTrust } from '../hooks/useIssuerTrust'
import { TrustBadge } from './TrustBadge'
import { TrustRegistryModal } from './TrustRegistryModal'

export interface TrustBadgeWrapperProps {
    issuerDid?: string
    credentialType?: string
    /** Hide badge if unable to verify (error/unknown) */
    hideOnError?: boolean
    /** Allow clicking badge to show details (default: true) */
    showDetailsOnPress?: boolean
}

export const TrustBadgeWrapper: React.FC<TrustBadgeWrapperProps> = ({
    issuerDid,
    credentialType = 'Credential',
    hideOnError = false,
    showDetailsOnPress = true
}) => {
    const { trustResult, authResponse, isLoading } = useIssuerTrust(issuerDid, credentialType)
    const [modalVisible, setModalVisible] = useState(false)

    const handleBadgePress = useCallback(() => {
        if (showDetailsOnPress && trustResult && !isLoading) {
            setModalVisible(true)
        }
    }, [showDetailsOnPress, trustResult, isLoading])

    const handleModalClose = useCallback(() => {
        setModalVisible(false)
    }, [])

    // If no result yet and not loading, don't show anything
    if (!trustResult && !isLoading) {
        return null
    }

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

    // Don't render if result is null
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
                authResponse={authResponse}
                onAccept={handleModalClose}
                onDecline={handleModalClose}
                onClose={handleModalClose}
            />
        </>
    )
}

export default TrustBadgeWrapper
