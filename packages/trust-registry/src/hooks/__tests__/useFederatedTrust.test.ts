/**
 * Unit Tests for useFederatedTrust Hook
 */

import { renderHook, waitFor } from '@testing-library/react-native'
import { useFederatedTrust } from '../useFederatedTrust'
import { useTrustRegistry } from '../../contexts/TrustRegistryContext'
import { AuthorityDiscoveryService } from '../../services/AuthorityDiscoveryService'

// Mock the dependencies
jest.mock('../../contexts/TrustRegistryContext')
jest.mock('../../services/AuthorityDiscoveryService')

const mockUseTrustRegistry = useTrustRegistry as jest.MockedFunction<typeof useTrustRegistry>
// Get the mocked class
const MockAuthorityDiscoveryService = AuthorityDiscoveryService as jest.Mocked<typeof AuthorityDiscoveryService>

describe('useFederatedTrust', () => {
    const mockCheckIssuerAuthorization = jest.fn()
    const mockCheckRecognition = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()

        mockUseTrustRegistry.mockReturnValue({
            isEnabled: true,
            isAvailable: true,
            metadata: null,
            checkIssuerAuthorization: mockCheckIssuerAuthorization,
            checkVerifierAuthorization: jest.fn(),
            checkRecognition: mockCheckRecognition,
            refreshMetadata: jest.fn(),
            clearCache: jest.fn(),
        })
    })

    describe('when trust registry is disabled', () => {
        it('should return unknown status', async () => {
            mockUseTrustRegistry.mockReturnValue({
                isEnabled: false,
                isAvailable: false,
                metadata: null,
                checkIssuerAuthorization: mockCheckIssuerAuthorization,
                checkVerifierAuthorization: jest.fn(),
                checkRecognition: mockCheckRecognition,
                refreshMetadata: jest.fn(),
                clearCache: jest.fn(),
            })

            const { result } = renderHook(() =>
                useFederatedTrust('did:web:issuer.edu', undefined, 'UniversityDegree')
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.level).toBe('unknown')
            expect(result.current.authorized).toBe(false)
            expect(result.current.message).toContain('not enabled')
        })
    })

    describe('when issuerDid is not provided', () => {
        it('should return unknown status', async () => {
            const { result } = renderHook(() =>
                useFederatedTrust(undefined, undefined, 'UniversityDegree')
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.level).toBe('unknown')
            expect(result.current.message).toContain('No issuer DID')
        })
    })

    describe('when issuer is authorized locally', () => {
        it('should return trusted_high with local source', async () => {
            mockCheckIssuerAuthorization.mockResolvedValue({
                entity_id: 'did:web:issuer.edu',
                authority_id: 'did:web:kemdikbud.go.id',
                action: 'issue',
                resource: 'UniversityDegree',
                authorized: true,
                time_evaluated: new Date().toISOString(),
                message: 'Authorized by local authority',
            })

            const { result } = renderHook(() =>
                useFederatedTrust('did:web:issuer.edu', undefined, 'UniversityDegree')
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.level).toBe('trusted_high')
            expect(result.current.authorized).toBe(true)
            expect(result.current.trustSource).toBe('local')
            expect(mockCheckIssuerAuthorization).toHaveBeenCalledWith(
                'did:web:issuer.edu',
                'UniversityDegree'
            )
        })
    })

    describe('when issuer is not authorized locally but recognized via federation', () => {
        it('should return trusted_federation', async () => {
            const credential = {
                termsOfUse: [{
                    type: 'TrustFrameworkPolicy',
                    trustFramework: {
                        id: 'did:web:ed.gov',
                        name: 'US Department of Education'
                    }
                }]
            }

            mockCheckIssuerAuthorization.mockResolvedValue({
                entity_id: 'did:web:mit.edu',
                authority_id: 'did:web:kemdikbud.go.id',
                action: 'issue',
                resource: 'UniversityDegree',
                authorized: false,
                time_evaluated: new Date().toISOString(),
                message: 'Not authorized locally',
            })

            mockCheckRecognition.mockResolvedValue({
                entity_id: 'did:web:ed.gov',
                authority_id: 'did:web:kemdikbud.go.id',
                action: 'recognize',
                resource: 'UniversityDegree',
                recognized: true,
                time_evaluated: new Date().toISOString(),
                message: 'Recognized via bilateral agreement',
            })

            // Mock successful discovery
            MockAuthorityDiscoveryService.findAuthority.mockResolvedValue({
                id: 'did:web:ed.gov',
                name: 'US Department of Education',
                registryUrl: 'https://trust.ed.gov'
            })

            const { result } = renderHook(() =>
                useFederatedTrust('did:web:mit.edu', credential, 'UniversityDegree')
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.level).toBe('trusted_federation')
            expect(result.current.authorized).toBe(true)
            expect(result.current.trustSource).toBe('federation')
            expect(result.current.trustAuthority?.id).toBe('did:web:ed.gov')
            expect(result.current.trustAuthority?.name).toBe('US Department of Education')
        })
    })

    describe('when issuer is not authorized and no foreign authority found', () => {
        it('should return untrusted', async () => {
            mockCheckIssuerAuthorization.mockResolvedValue({
                entity_id: 'did:web:unknown.com',
                authority_id: 'did:web:kemdikbud.go.id',
                action: 'issue',
                resource: 'SomeCred',
                authorized: false,
                time_evaluated: new Date().toISOString(),
                message: 'Not authorized',
            })

            const { result } = renderHook(() =>
                useFederatedTrust('did:web:unknown.com', {}, 'SomeCred')
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.level).toBe('untrusted')
            expect(result.current.authorized).toBe(false)
            expect(result.current.trustSource).toBe('unknown')
        })
    })

    describe('when foreign authority is not recognized', () => {
        it('should return untrusted', async () => {
            const credential = {
                termsOfUse: [{
                    type: 'TrustFrameworkPolicy',
                    trustFramework: {
                        id: 'did:web:unknown-authority.gov',
                        name: 'Unknown Authority'
                    }
                }]
            }

            mockCheckIssuerAuthorization.mockResolvedValue({
                entity_id: 'did:web:issuer.edu',
                authority_id: 'did:web:kemdikbud.go.id',
                action: 'issue',
                resource: 'Cred',
                authorized: false,
                time_evaluated: new Date().toISOString(),
                message: 'Not authorized locally',
            })

            mockCheckRecognition.mockResolvedValue({
                entity_id: 'did:web:unknown-authority.gov',
                authority_id: 'did:web:kemdikbud.go.id',
                action: 'recognize',
                resource: 'Cred',
                recognized: false,
                time_evaluated: new Date().toISOString(),
                message: 'Foreign authority not recognized',
            })

            // Mock successful discovery but unrecognized
            MockAuthorityDiscoveryService.findAuthority.mockResolvedValue({
                id: 'did:web:unknown-authority.gov',
                name: 'Unknown Authority',
                registryUrl: 'https://unknown.gov'
            })

            const { result } = renderHook(() =>
                useFederatedTrust('did:web:issuer.edu', credential, 'Cred')
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.level).toBe('untrusted')
            expect(result.current.authorized).toBe(false)
            expect(result.current.trustSource).toBe('unknown')
            expect(result.current.trustAuthority?.id).toBe('did:web:unknown-authority.gov')
        })
    })

    describe('error handling', () => {
        it('should handle authorization check error', async () => {
            mockCheckIssuerAuthorization.mockRejectedValue(new Error('Network error'))

            const { result } = renderHook(() =>
                useFederatedTrust('did:web:issuer.edu', undefined, 'Cred')
            )

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false)
            })

            expect(result.current.level).toBe('unknown')
            expect(result.current.authorized).toBe(false)
            expect(result.current.error).toBeDefined()
            expect(result.current.error?.message).toContain('Network error')
        })
    })
})
