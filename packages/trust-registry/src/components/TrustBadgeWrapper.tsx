import React from 'react'
import { useIssuerTrust } from '../hooks/useIssuerTrust'
import { TrustBadge } from './TrustBadge'

export interface TrustBadgeWrapperProps {
    issuerDid?: string
}

export const TrustBadgeWrapper: React.FC<TrustBadgeWrapperProps> = ({ issuerDid }) => {
    const { trustResult } = useIssuerTrust(issuerDid)

    if (!trustResult) {
        return null
    }

    return <TrustBadge trustResult={trustResult} />
}

export default TrustBadgeWrapper
