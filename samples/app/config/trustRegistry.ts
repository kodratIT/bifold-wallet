/**
 * Trust Registry Configuration from Environment Variables
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
})

/**
 * Check if Trust Registry is properly configured
 */
export const isTrustRegistryConfigured = (): boolean => {
  const config = getTrustRegistryConfig()
  return config.enabled && !!config.url && !!config.ecosystemDid
}
