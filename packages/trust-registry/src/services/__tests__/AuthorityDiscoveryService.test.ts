/**
 * Unit Tests for AuthorityDiscoveryService
 */

import { AuthorityDiscoveryService } from '../AuthorityDiscoveryService'

describe('AuthorityDiscoveryService', () => {
    describe('extractFromCredential', () => {
        it('should extract authority from termsOfUse with nested trustFramework', () => {
            const credential = {
                termsOfUse: [{
                    type: 'TrustFrameworkPolicy',
                    trustFramework: {
                        id: 'did:web:ed.gov',
                        name: 'US Department of Education',
                        registryUrl: 'https://trust.ed.gov'
                    }
                }]
            }

            const result = AuthorityDiscoveryService.extractFromCredential(credential)

            expect(result).not.toBeNull()
            expect(result?.id).toBe('did:web:ed.gov')
            expect(result?.name).toBe('US Department of Education')
            expect(result?.registryUrl).toBe('https://trust.ed.gov')
        })

        it('should extract authority from termsOfUse with direct properties', () => {
            const credential = {
                termsOfUse: [{
                    type: 'TrustFrameworkPolicy',
                    authorityId: 'did:web:moe.gov.sg',
                    authorityName: 'MOE Singapore'
                }]
            }

            const result = AuthorityDiscoveryService.extractFromCredential(credential)

            expect(result).not.toBeNull()
            expect(result?.id).toBe('did:web:moe.gov.sg')
            expect(result?.name).toBe('MOE Singapore')
        })

        it('should handle array of termsOfUse and find correct one', () => {
            const credential = {
                termsOfUse: [
                    { type: 'SomeOtherPolicy' },
                    {
                        type: 'TrustFrameworkPolicy',
                        trustFramework: {
                            id: 'did:web:ed.gov'
                        }
                    }
                ]
            }

            const result = AuthorityDiscoveryService.extractFromCredential(credential)

            expect(result).not.toBeNull()
            expect(result?.id).toBe('did:web:ed.gov')
        })

        it('should handle single termsOfUse object', () => {
            const credential = {
                termsOfUse: {
                    type: 'TrustFrameworkPolicy',
                    trustFramework: {
                        id: 'did:web:ed.gov'
                    }
                }
            }

            const result = AuthorityDiscoveryService.extractFromCredential(credential)

            expect(result).not.toBeNull()
            expect(result?.id).toBe('did:web:ed.gov')
        })

        it('should return null if no termsOfUse', () => {
            const credential = {}
            const result = AuthorityDiscoveryService.extractFromCredential(credential)
            expect(result).toBeNull()
        })

        it('should return null if no TrustFrameworkPolicy type found', () => {
            const credential = {
                termsOfUse: [{
                    type: 'SomeOtherPolicy',
                    data: 'some data'
                }]
            }

            const result = AuthorityDiscoveryService.extractFromCredential(credential)
            expect(result).toBeNull()
        })

        it('should return null for undefined credential', () => {
            const result = AuthorityDiscoveryService.extractFromCredential(undefined)
            expect(result).toBeNull()
        })

        it('should return null for null credential', () => {
            const result = AuthorityDiscoveryService.extractFromCredential(null)
            expect(result).toBeNull()
        })
    })

    describe('extractFromEvidence', () => {
        it('should extract authority from evidence field', () => {
            const credential = {
                evidence: [{
                    type: 'TrustRegistryEvidence',
                    authority: 'did:web:ed.gov',
                    authorityName: 'US Dept of Education'
                }]
            }

            const result = AuthorityDiscoveryService.extractFromEvidence(credential)

            expect(result).not.toBeNull()
            expect(result?.id).toBe('did:web:ed.gov')
            expect(result?.name).toBe('US Dept of Education')
        })

        it('should handle authorityId field', () => {
            const credential = {
                evidence: [{
                    type: 'TrustRegistryEvidence',
                    authorityId: 'did:web:moe.gov.sg'
                }]
            }

            const result = AuthorityDiscoveryService.extractFromEvidence(credential)

            expect(result).not.toBeNull()
            expect(result?.id).toBe('did:web:moe.gov.sg')
        })

        it('should return null if no evidence', () => {
            const credential = {}
            const result = AuthorityDiscoveryService.extractFromEvidence(credential)
            expect(result).toBeNull()
        })

        it('should return null if no TrustRegistryEvidence type', () => {
            const credential = {
                evidence: [{
                    type: 'SomeOtherEvidence',
                    data: 'data'
                }]
            }

            const result = AuthorityDiscoveryService.extractFromEvidence(credential)
            expect(result).toBeNull()
        })
    })

    describe('findAuthority', () => {
        it('should try termsOfUse first', async () => {
            const credential = {
                termsOfUse: [{
                    type: 'TrustFrameworkPolicy',
                    trustFramework: {
                        id: 'did:web:ed.gov'
                    }
                }],
                evidence: [{
                    type: 'TrustRegistryEvidence',
                    authority: 'did:web:other.gov'
                }]
            }

            const result = await AuthorityDiscoveryService.findAuthority(
                'did:web:issuer.edu',
                credential
            )

            expect(result).not.toBeNull()
            expect(result?.id).toBe('did:web:ed.gov')
        })

        it('should fallback to evidence if termsOfUse not found', async () => {
            const credential = {
                evidence: [{
                    type: 'TrustRegistryEvidence',
                    authority: 'did:web:ed.gov'
                }]
            }

            const result = await AuthorityDiscoveryService.findAuthority(
                'did:web:issuer.edu',
                credential
            )

            expect(result).not.toBeNull()
            expect(result?.id).toBe('did:web:ed.gov')
        })

        it('should return null if no authority found', async () => {
            const credential = {}

            const result = await AuthorityDiscoveryService.findAuthority(
                'did:web:issuer.edu',
                credential
            )

            expect(result).toBeNull()
        })

        it('should handle no credential provided', async () => {
            const result = await AuthorityDiscoveryService.findAuthority('did:web:issuer.edu')
            expect(result).toBeNull()
        })
    })

    describe('extractFromDid', () => {
        it('should return null (Phase 2 placeholder)', async () => {
            const result = await AuthorityDiscoveryService.extractFromDid('did:web:issuer.edu')
            expect(result).toBeNull()
        })
    })
})
