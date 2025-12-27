import { TrustFramework } from '../types'

/**
 * Service for discovering Trust Authority from credentials or issuers
 * Phase 1: Support Discovery via termsOfUse (Credential-based)
 * Phase 2: Support Discovery via DID Document (Issuer-based) - Future
 */
export class AuthorityDiscoveryService {
    /**
     * Extract Trust Framework info from credential's termsOfUse
     * Supports W3C Standard 'TrustFrameworkPolicy'
     * 
     * @param credential - The verifiable credential object
     * @returns TrustFramework info or null if not found
     */
    static extractFromCredential(credential: any): TrustFramework | null {
        if (!credential) {
            console.log('[AuthorityDiscovery] No credential provided for extraction')
            return null
        }

        // Log full credential structure for debugging
        console.log('[AuthorityDiscovery] Inspecting Full Credential Structure:', JSON.stringify(credential, null, 2))

        // Helper to get terms from various possible locations
        const getTerms = (obj: any) => {
            if (obj.termsOfUse) return obj.termsOfUse
            if (obj.credential?.termsOfUse) return obj.credential.termsOfUse
            if (obj.json?.termsOfUse) return obj.json.termsOfUse
            if (obj.credential?.credentialSubject?.termsOfUse) return obj.credential.credentialSubject.termsOfUse
            if (obj.attributes?.termsOfUse) return obj.attributes.termsOfUse
            return null
        }

        const termsOfUse = getTerms(credential)

        // Log inspection for debugging
        if (termsOfUse) {
            console.log('[AuthorityDiscovery] Found termsOfUse in credential:', JSON.stringify(termsOfUse, null, 2))
        } else {
            console.log('[AuthorityDiscovery] No termsOfUse found in credential structure. Keys checked:', Object.keys(credential))
        }

        if (!termsOfUse) return null

        // Normalize termsOfUse to array
        const termsArray = Array.isArray(termsOfUse)
            ? termsOfUse
            : [termsOfUse]

        for (const terms of termsArray) {
            // Check for TrustFrameworkPolicy type (W3C Standard)
            if (terms.type === 'TrustFrameworkPolicy') {
                console.log('[AuthorityDiscovery] Found TrustFrameworkPolicy:', terms)

                // Structure 1: Nested trustFramework object (Recommended)
                // Example: { type: "TrustFrameworkPolicy", trustFramework: { id: "did:web:ed.gov" } }
                if (terms.trustFramework && typeof terms.trustFramework === 'object') {
                    if (terms.trustFramework.id) {
                        return {
                            id: terms.trustFramework.id,
                            name: terms.trustFramework.name,
                            registryUrl: terms.trustFramework.registryUrl
                        }
                    }
                }

                // Structure 2: Direct properties (Alternative format)
                // Example: { type: "TrustFrameworkPolicy", authorityId: "did:web:ed.gov" }
                if (terms.authorityId || terms.authority) {
                    return {
                        id: terms.authorityId || terms.authority,
                        name: terms.authorityName,
                        registryUrl: terms.registryUrl
                    }
                }
            } else {
                console.log('[AuthorityDiscovery] Inspecting terms type:', terms.type)
            }
        }

        return null
    }

    /**
     * Extract Trust Framework info from credential's evidence field
     * Alternative location for trust authority information
     * 
     * @param credential - The verifiable credential object
     * @returns TrustFramework info or null if not found
     */
    static extractFromEvidence(credential: any): TrustFramework | null {
        if (!credential || !credential.evidence) {
            return null
        }

        const evidenceArray = Array.isArray(credential.evidence)
            ? credential.evidence
            : [credential.evidence]

        for (const evidence of evidenceArray) {
            if (evidence.type === 'TrustRegistryEvidence') {
                if (evidence.authority || evidence.authorityId) {
                    return {
                        id: evidence.authority || evidence.authorityId,
                        name: evidence.authorityName,
                        registryUrl: evidence.registryUrl || evidence.id
                    }
                }
            }
        }

        return null
    }

    /**
     * Phase 2 Placeholder: Extract from Issuer DID Document
     * This will resolve the issuer's DID and look for TrustRegistryService endpoint
     * 
     * @param issuerDid - The DID of the issuer
     * @returns TrustFramework info or null if not found
     */
    static async extractFromDid(issuerDid: string): Promise<TrustFramework | null> {
        // TODO: Phase 2 Implementation
        // 1. Resolve DID Document (did:web, did:key, etc.)
        // 2. Find service endpoint with type "TrustRegistryService"
        // 3. Extract authority_id from serviceEndpoint
        // Example DID Document structure:
        // {
        //   "service": [{
        //     "type": "TrustRegistryService",
        //     "serviceEndpoint": {
        //       "authority_id": "did:web:ed.gov"
        //     }
        //   }]
        // }

        return null
    }

    /**
     * Main discovery method - tries multiple strategies
     * Priority: Credential termsOfUse > Credential evidence > DID Document (Phase 2)
     * 
     * @param issuerDid - The DID of the issuer
     * @param credential - Optional credential object
     * @returns TrustFramework info or null if not found
     */
    static async findAuthority(
        issuerDid: string,
        credential?: any
    ): Promise<TrustFramework | null> {
        // Strategy 1: Try Credential termsOfUse (Fastest, Offline-capable, W3C Recommended)
        if (credential) {
            const fromTermsOfUse = this.extractFromCredential(credential)
            if (fromTermsOfUse) {
                return fromTermsOfUse
            }

            // Strategy 2: Try Credential evidence (Alternative location)
            const fromEvidence = this.extractFromEvidence(credential)
            if (fromEvidence) {
                return fromEvidence
            }
        }

        // Strategy 3: Try DID Document (Network call) - Phase 2 Future Implementation
        // const fromDid = await this.extractFromDid(issuerDid)
        // if (fromDid) return fromDid

        return null
    }
}
