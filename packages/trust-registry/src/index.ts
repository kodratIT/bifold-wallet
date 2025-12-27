/**
 * @bifold/trust-registry
 * Trust Registry integration for Bifold Wallet (ToIP TRQP v2)
 * Simplified for Authorization-only flow
 */

// Types
export * from './types'

// Services
export { TrustRegistryService, encodeDid, mapAuthorizationToTrustLevel, normalizeDid } from './services/TrustRegistryService'
export type { ITrustRegistryService, Logger } from './services/TrustRegistryService'
export { AuthorityDiscoveryService } from './services/AuthorityDiscoveryService'

// Context and Hooks
export { TrustRegistryProvider, useTrustRegistry, TrustRegistryContext } from './contexts/TrustRegistryContext'
export type { TrustRegistryProviderProps } from './contexts/TrustRegistryContext'
export { useIssuerTrust } from './hooks/useIssuerTrust'
export type { UseIssuerTrustResult } from './hooks/useIssuerTrust'
export { useVerifierTrust } from './hooks/useVerifierTrust'
export type { UseVerifierTrustResult } from './hooks/useVerifierTrust'
export { useTrustRegistryStatus } from './hooks/useTrustRegistryStatus'
export type { UseTrustRegistryStatusResult } from './hooks/useTrustRegistryStatus'
export { useFederatedTrust } from './hooks/useFederatedTrust'
export type { FederatedTrustResult } from './hooks/useFederatedTrust'

// Components
export { TrustBadge, getBadgeConfig, TRUST_BADGE_CONFIG, BADGE_SIZES } from './components/TrustBadge'
export { TrustBadgeWrapper } from './components/TrustBadgeWrapper'
export { TrustRegistryModal } from './components/TrustRegistryModal'
export type { TrustBadgeProps, BadgeConfig } from './components/TrustBadge'
export type { TrustBadgeWrapperProps } from './components/TrustBadgeWrapper'
export type { TrustRegistryModalProps } from './components/TrustRegistryModal'
export { TrustWarning, getWarningConfig, shouldShowWarning, isDismissible } from './components/TrustWarning'
export type { TrustWarningProps, WarningConfig } from './components/TrustWarning'
export { TrustConfirmModal } from './components/TrustConfirmModal'
export type { TrustConfirmModalProps } from './components/TrustConfirmModal'

// Utils
export { TrustRegistryCache, generateCacheKey, CacheKeys } from './utils/cache'
export type { CacheKeyType } from './utils/cache'
