/**
 * Trust Registry Context
 * React context for trust registry state management
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, PropsWithChildren } from 'react'
import {
  TrustRegistryConfig,
  TrustRegistryMetadata,
  TrustResult,
  AuthorizationResponse,
  TrustRegistryContextValue,
} from '../types'
import { TrustRegistryService, ITrustRegistryService } from '../services/TrustRegistryService'

/**
 * Default context value
 */
const defaultContextValue: TrustRegistryContextValue = {
  isEnabled: false,
  isAvailable: false,
  metadata: null,
  checkIssuer: async () => ({
    level: 'unknown',
    found: false,
    message: 'Trust registry not initialized',
    checkedAt: new Date(),
  }),
  checkVerifier: async () => ({
    level: 'unknown',
    found: false,
    message: 'Trust registry not initialized',
    checkedAt: new Date(),
  }),
  checkIssuerAuthorization: async () => ({
    entity_id: '',
    authority_id: '',
    action: 'issue',
    resource: '',
    authorized: false,
    time_evaluated: new Date().toISOString(),
    message: 'Trust registry not initialized',
  }),
  checkVerifierAuthorization: async () => ({
    entity_id: '',
    authority_id: '',
    action: 'verify',
    resource: '',
    authorized: false,
    time_evaluated: new Date().toISOString(),
    message: 'Trust registry not initialized',
  }),
  refreshMetadata: async () => {},
  clearCache: () => {},
}

/**
 * Trust Registry Context
 */
const TrustRegistryContext = createContext<TrustRegistryContextValue>(defaultContextValue)

/**
 * Props for TrustRegistryProvider
 */
export interface TrustRegistryProviderProps extends PropsWithChildren {
  config: TrustRegistryConfig
}

/**
 * Trust Registry Provider Component
 */
export const TrustRegistryProvider: React.FC<TrustRegistryProviderProps> = ({ config, children }) => {
  const [service, setService] = useState<ITrustRegistryService | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)
  const [metadata, setMetadata] = useState<TrustRegistryMetadata | null>(null)

  // Initialize service when config changes
  useEffect(() => {
    if (config.enabled && config.url) {
      const newService = new TrustRegistryService(config)
      setService(newService)
    } else {
      setService(null)
      setIsAvailable(false)
      setMetadata(null)
    }
  }, [config])

  // Check availability and fetch metadata on service init
  useEffect(() => {
    if (!service) return

    const checkAvailability = async () => {
      try {
        const available = await service.isAvailable()
        setIsAvailable(available)

        if (available) {
          const meta = await service.getMetadata()
          setMetadata(meta)
        }
      } catch {
        setIsAvailable(false)
        setMetadata(null)
      }
    }

    checkAvailability()
  }, [service])

  // Memoized actions
  const checkIssuer = useCallback(
    async (did: string): Promise<TrustResult> => {
      if (!service) {
        return {
          level: 'unknown',
          found: false,
          message: 'Trust registry not enabled',
          checkedAt: new Date(),
        }
      }
      return service.lookupIssuer(did)
    },
    [service]
  )

  const checkVerifier = useCallback(
    async (did: string): Promise<TrustResult> => {
      if (!service) {
        return {
          level: 'unknown',
          found: false,
          message: 'Trust registry not enabled',
          checkedAt: new Date(),
        }
      }
      return service.lookupVerifier(did)
    },
    [service]
  )

  const checkIssuerAuthorization = useCallback(
    async (did: string, credType: string): Promise<AuthorizationResponse> => {
      if (!service) {
        return {
          entity_id: did,
          authority_id: '',
          action: 'issue',
          resource: credType,
          authorized: false,
          time_evaluated: new Date().toISOString(),
          message: 'Trust registry not enabled',
        }
      }
      return service.checkIssuerAuthorization(did, credType)
    },
    [service]
  )

  const checkVerifierAuthorization = useCallback(
    async (did: string, credType: string): Promise<AuthorizationResponse> => {
      if (!service) {
        return {
          entity_id: did,
          authority_id: '',
          action: 'verify',
          resource: credType,
          authorized: false,
          time_evaluated: new Date().toISOString(),
          message: 'Trust registry not enabled',
        }
      }
      return service.checkVerifierAuthorization(did, credType)
    },
    [service]
  )

  const refreshMetadata = useCallback(async () => {
    if (!service) return

    try {
      service.clearCache()
      const meta = await service.getMetadata()
      setMetadata(meta)
      const available = await service.isAvailable()
      setIsAvailable(available)
    } catch {
      setIsAvailable(false)
    }
  }, [service])

  const clearCache = useCallback(() => {
    service?.clearCache()
  }, [service])

  // Memoized context value
  const contextValue = useMemo<TrustRegistryContextValue>(
    () => ({
      isEnabled: config.enabled,
      isAvailable,
      metadata,
      checkIssuer,
      checkVerifier,
      checkIssuerAuthorization,
      checkVerifierAuthorization,
      refreshMetadata,
      clearCache,
    }),
    [
      config.enabled,
      isAvailable,
      metadata,
      checkIssuer,
      checkVerifier,
      checkIssuerAuthorization,
      checkVerifierAuthorization,
      refreshMetadata,
      clearCache,
    ]
  )

  return <TrustRegistryContext.Provider value={contextValue}>{children}</TrustRegistryContext.Provider>
}

/**
 * Hook to access trust registry context
 */
export const useTrustRegistry = (): TrustRegistryContextValue => {
  const context = useContext(TrustRegistryContext)
  if (!context) {
    throw new Error('useTrustRegistry must be used within a TrustRegistryProvider')
  }
  return context
}

export { TrustRegistryContext }
