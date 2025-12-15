/**
 * @bifold/trust-registry
 * Trust Registry integration for Bifold Wallet (ToIP TRQP v2)
 */

// Types
export * from './types'

// Services
export { TrustRegistryService, encodeDid, mapToTrustLevel } from './services/TrustRegistryService'
export type { ITrustRegistryService, Logger } from './services/TrustRegistryService'

// Context and Hooks
export { TrustRegistryProvider, useTrustRegistry, TrustRegistryContext } from './contexts/TrustRegistryContext'
export type { TrustRegistryProviderProps } from './contexts/TrustRegistryContext'
export { useIssuerTrust } from './hooks/useIssuerTrust'
export type { UseIssuerTrustResult } from './hooks/useIssuerTrust'
export { useVerifierTrust } from './hooks/useVerifierTrust'
export type { UseVerifierTrustResult } from './hooks/useVerifierTrust'
export { useTrustRegistryStatus } from './hooks/useTrustRegistryStatus'
export type { UseTrustRegistryStatusResult } from './hooks/useTrustRegistryStatus'

// Components
export { TrustBadge, getBadgeConfig, TRUST_BADGE_CONFIG, BADGE_SIZES } from './components/TrustBadge'
export type { TrustBadgeProps, BadgeConfig } from './components/TrustBadge'
export { TrustWarning, getWarningConfig, shouldShowWarning, isDismissible } from './components/TrustWarning'
export type { TrustWarningProps, WarningConfig } from './components/TrustWarning'
export { IssuerInfoCard, formatDate, ACCREDITATION_CONFIG } from './components/IssuerInfoCard'
export type { IssuerInfoCardProps } from './components/IssuerInfoCard'

// Utils
export { TrustRegistryCache, generateCacheKey, CacheKeys } from './utils/cache'
export type { CacheKeyType } from './utils/cache'
