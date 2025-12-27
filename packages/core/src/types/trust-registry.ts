export type TrustLevel =
    | 'trusted_high'
    | 'trusted_medium'
    | 'trusted_low'
    | 'untrusted'
    | 'trusted_federation'
    | 'unknown'

export interface TrustFramework {
    id: string
    name?: string
    registryUrl?: string
}

export interface FederatedTrustResult {
    level: TrustLevel
    authorized: boolean
    trustSource: 'local' | 'federation' | 'unknown'
    trustAuthority?: TrustFramework
    isLoading: boolean
    error?: Error
    message?: string
}

export interface TrustRegistryConfig {
    enabled: boolean
    url: string
    ecosystemDid: string
    cacheTTL: number
    showWarningForUntrusted: boolean
    blockUntrustedIssuers: boolean
    blockUntrustedVerifiers: boolean
}
