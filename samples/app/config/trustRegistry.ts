/**
 * Trust Registry Configuration from Environment Variables
 * 
 * This configuration supports both:
 * 1. Local Trust Registry (Direct Authorization)
 * 2. Federation Strategy (Recognition via termsOfUse in credentials)
 * 
 * For Federation Strategy:
 * - The local anchor (ecosystemDid + url) is used as the primary trust authority
 * - Foreign authorities are discovered from credential's termsOfUse field
 * - Recognition queries are sent to the local anchor to verify foreign authorities
 * 
 * Example .env configuration:
 * ```
 * TRUST_REGISTRY_ENABLED=true
 * TRUST_REGISTRY_URL=https://trust.kemdikbud.go.id
 * TRUST_REGISTRY_ECOSYSTEM_DID=did:web:kemdikbud.go.id
 * TRUST_REGISTRY_CACHE_TTL=3600000
 * TRUST_REGISTRY_SHOW_WARNING=true
 * TRUST_REGISTRY_BLOCK_UNTRUSTED_ISSUERS=false
 * TRUST_REGISTRY_BLOCK_UNTRUSTED_VERIFIERS=false
 * ```
 */
import Config from 'react-native-config'
import { TrustRegistryConfig } from '@bifold/trust-registry'

/**
 * Get Trust Registry configuration from environment variables
 */
export const getTrustRegistryConfig = (): TrustRegistryConfig => ({
  enabled: Config.TRUST_REGISTRY_ENABLED === 'true',
  url: Config.TRUST_REGISTRY_URL || '',
  ecosystemDid: Config.TRUST_REGISTRY_ECOSYSTEM_DID || '',
  cacheTTL: parseInt(Config.TRUST_REGISTRY_CACHE_TTL || '3600000', 10),
  showWarningForUntrusted: Config.TRUST_REGISTRY_SHOW_WARNING !== 'false',
  blockUntrustedIssuers: Config.TRUST_REGISTRY_BLOCK_UNTRUSTED_ISSUERS === 'true',
  blockUntrustedVerifiers: Config.TRUST_REGISTRY_BLOCK_UNTRUSTED_VERIFIERS === 'true',

  // Dev Mode Fallback configuration
  devMode: Config.ENV === 'dev' || Config.DEV_MODE === 'true' || __DEV__,
  fallbackAuthority: (Config.TRUST_REGISTRY_FALLBACK_DID && Config.TRUST_REGISTRY_FALLBACK_URL) ? {
    did: Config.TRUST_REGISTRY_FALLBACK_DID,
    url: Config.TRUST_REGISTRY_FALLBACK_URL,
    name: Config.TRUST_REGISTRY_FALLBACK_NAME || 'Development Authority'
  } : undefined
})

/**
 * Check if Trust Registry is properly configured
 */
export const isTrustRegistryConfigured = (): boolean => {
  const config = getTrustRegistryConfig()
  return config.enabled && !!config.url && !!config.ecosystemDid
}

