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

export interface TrustAnchor {
    did: string
    url: string
    name?: string
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

export interface AuthorizationResponse {
    entity_id: string
    authority_id: string
    action: string
    resource: string
    authorized: boolean
    time_evaluated: string
    message: string
    context?: Record<string, unknown>
}

export interface TrustResult {
    level: TrustLevel
    authorized: boolean
    entityDid?: string
    credentialType?: string
    action?: 'issue' | 'verify'
    message?: string
    checkedAt: Date
}

export interface UseVerifierTrustResult {
    trustResult: TrustResult | null
    authResponse: AuthorizationResponse | null
    isLoading: boolean
    error: string | null
    refresh: () => Promise<void>
}

export interface TrustRegistryConfig {
    enabled: boolean
    url: string
    ecosystemDid: string
    cacheTTL: number
    showWarningForUntrusted: boolean
    blockUntrustedIssuers: boolean
    blockUntrustedVerifiers: boolean
    localAnchor?: TrustAnchor
    devMode?: boolean
    fallbackAuthority?: TrustAnchor
}
