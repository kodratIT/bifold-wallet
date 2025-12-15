/**
 * Hooks Tests
 * Unit tests for trust registry hooks
 */

import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react-native'
import { TrustRegistryProvider } from '../../src/contexts/TrustRegistryContext'
import { useIssuerTrust } from '../../src/hooks/useIssuerTrust'
import { useVerifierTrust } from '../../src/hooks/useVerifierTrust'
import { useTrustRegistryStatus } from '../../src/hooks/useTrustRegistryStatus'
import { TrustRegistryConfig } from '../../src/types'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

const testConfig: TrustRegistryConfig = {
  enabled: true,
  url: 'https://trust-registry.example.com',
  ecosystemDid: 'did:web:ecosystem.example.com',
  cacheTTL: 5 * 60 * 1000,
  showWarningForUntrusted: true,
  blockUntrustedIssuers: false,
  blockUntrustedVerifiers: false,
}

const disabledConfig: TrustRegistryConfig = {
  ...testConfig,
  enabled: false,
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TrustRegistryProvider config={testConfig}>{children}</TrustRegistryProvider>
)

const disabledWrapper = ({ children }: { children: React.ReactNode }) => (
  <TrustRegistryProvider config={disabledConfig}>{children}</TrustRegistryProvider>
)

describe('useIssuerTrust', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    // Mock metadata endpoint
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/v2/metadata')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            name: 'Test Registry',
            version: '2.0.0',
            protocol: 'ToIP TRQP v2',
            status: 'operational',
            supportedActions: ['issue', 'verify'],
            supportedDIDMethods: ['web', 'key'],
            features: {
              authorization: true,
              recognition: true,
              delegation: false,
              publicTrustedList: true,
            },
          }),
        })
      }
      if (url.includes('/v2/public/lookup/issuer/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              found: true,
              issuer: {
                did: 'did:web:issuer.example.com',
                name: 'Test Issuer',
                status: 'active',
                accreditationLevel: 'high',
                credentialTypes: [],
              },
            },
          }),
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })
  })

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useIssuerTrust('did:web:issuer.example.com'), { wrapper })
    expect(result.current.isLoading).toBe(true)
  })

  it('should return trust result after loading', async () => {
    const { result } = renderHook(() => useIssuerTrust('did:web:issuer.example.com'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.trustResult).toBeDefined()
    expect(result.current.trustResult?.found).toBe(true)
    expect(result.current.trustResult?.level).toBe('trusted_high')
  })

  it('should return null when DID is undefined', () => {
    const { result } = renderHook(() => useIssuerTrust(undefined), { wrapper })
    expect(result.current.trustResult).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should return null when trust registry is disabled', () => {
    const { result } = renderHook(() => useIssuerTrust('did:web:issuer.example.com'), {
      wrapper: disabledWrapper,
    })
    expect(result.current.trustResult).toBeNull()
  })

  it('should support refresh function', async () => {
    const { result } = renderHook(() => useIssuerTrust('did:web:issuer.example.com'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.trustResult).toBeDefined()
  })
})

describe('useVerifierTrust', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/v2/metadata')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            name: 'Test Registry',
            version: '2.0.0',
            protocol: 'ToIP TRQP v2',
            status: 'operational',
            supportedActions: ['issue', 'verify'],
            supportedDIDMethods: ['web', 'key'],
            features: {
              authorization: true,
              recognition: true,
              delegation: false,
              publicTrustedList: true,
            },
          }),
        })
      }
      if (url.includes('/v2/public/lookup/verifier/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              found: true,
              verifier: {
                did: 'did:web:verifier.example.com',
                name: 'Test Verifier',
                status: 'active',
                accreditationLevel: 'medium',
                credentialTypes: [],
              },
            },
          }),
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })
  })

  it('should return trust result for verifier', async () => {
    const { result } = renderHook(() => useVerifierTrust('did:web:verifier.example.com'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.trustResult).toBeDefined()
    expect(result.current.trustResult?.found).toBe(true)
    expect(result.current.trustResult?.level).toBe('trusted_medium')
  })
})

describe('useTrustRegistryStatus', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/v2/metadata')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            name: 'Test Registry',
            version: '2.0.0',
            protocol: 'ToIP TRQP v2',
            status: 'operational',
            supportedActions: ['issue', 'verify'],
            supportedDIDMethods: ['web', 'key'],
            features: {
              authorization: true,
              recognition: true,
              delegation: false,
              publicTrustedList: true,
            },
          }),
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })
  })

  it('should return isEnabled based on config', () => {
    const { result } = renderHook(() => useTrustRegistryStatus(), { wrapper })
    expect(result.current.isEnabled).toBe(true)
  })

  it('should return isEnabled=false when disabled', () => {
    const { result } = renderHook(() => useTrustRegistryStatus(), { wrapper: disabledWrapper })
    expect(result.current.isEnabled).toBe(false)
  })

  it('should return metadata after loading', async () => {
    const { result } = renderHook(() => useTrustRegistryStatus(), { wrapper })

    await waitFor(() => {
      expect(result.current.metadata).not.toBeNull()
    })

    expect(result.current.metadata?.name).toBe('Test Registry')
    expect(result.current.isAvailable).toBe(true)
  })
})
