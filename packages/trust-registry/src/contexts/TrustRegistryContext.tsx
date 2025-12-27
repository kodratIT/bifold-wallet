/**
 * Trust Registry Context
 * React context for trust registry state management
 * Simplified for Authorization-only flow
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, PropsWithChildren } from 'react'
import {
  TrustRegistryConfig,
  TrustRegistryMetadata,
  AuthorizationResponse,
  RecognitionResponse,
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
  checkRecognition: async () => ({
    entity_id: '',
    authority_id: '',
    action: 'recognize',
    resource: '',
    recognized: false,
    time_evaluated: new Date().toISOString(),
    message: 'Trust registry not initialized',
  }),
  refreshMetadata: async () => { },
  clearCache: () => { },
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

  const checkRecognition = useCallback(
    async (foreignAuthorityDid: string, resource?: string): Promise<RecognitionResponse> => {
      if (!service) {
        return {
          entity_id: foreignAuthorityDid,
          authority_id: '',
          action: 'recognize',
          resource: resource || 'governance',
          recognized: false,
          time_evaluated: new Date().toISOString(),
          message: 'Trust registry not enabled',
        }
      }
      return service.checkRecognition(foreignAuthorityDid, resource)
    },
    [service]
  )

  // Memoized context value
  const contextValue = useMemo<TrustRegistryContextValue>(
    () => ({
      isEnabled: config.enabled,
      isAvailable,
      metadata,
      checkIssuerAuthorization,
      checkVerifierAuthorization,
      checkRecognition,
      refreshMetadata,
      clearCache,
    }),
    [
      config.enabled,
      isAvailable,
      metadata,
      checkIssuerAuthorization,
      checkVerifierAuthorization,
      checkRecognition,
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
