/**
 * **Feature: trust-registry, Property 1: Type Serialization Round-Trip**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 *
 * For any valid type object, serializing to JSON and parsing back
 * should produce an equivalent object.
 */

import * as fc from 'fast-check'
import {
  TrustRegistryConfig,
  TrustRegistryMetadata,
  IssuerInfo,
  VerifierInfo,
  AuthorizationRequest,
  AuthorizationResponse,
  TrustResult,
  EntityStatus,
  AccreditationLevel,
  TrustLevel,
  RegistryStatus,
} from '../../src/types'

// Arbitraries for generating test data
const entityStatusArb = fc.constantFrom<EntityStatus>('pending', 'active', 'suspended', 'revoked')
const accreditationLevelArb = fc.constantFrom<AccreditationLevel>('high', 'medium', 'low')
const registryStatusArb = fc.constantFrom<RegistryStatus>('operational', 'maintenance', 'degraded')
const trustLevelArb = fc.constantFrom<TrustLevel>(
  'trusted_high',
  'trusted_medium',
  'trusted_low',
  'untrusted',
  'suspended',
  'revoked',
  'unknown'
)

const credentialTypeInfoArb = fc.record({
  id: fc.option(fc.string(), { nil: undefined }),
  type: fc.string(),
  name: fc.option(fc.string(), { nil: undefined }),
})

const jurisdictionArb = fc.record({
  code: fc.string({ minLength: 2, maxLength: 3 }),
  name: fc.option(fc.string(), { nil: undefined }),
})

const registryInfoArb = fc.record({
  id: fc.option(fc.string(), { nil: undefined }),
  name: fc.string(),
  ecosystemDid: fc.option(fc.string(), { nil: undefined }),
})

const trustRegistryConfigArb: fc.Arbitrary<TrustRegistryConfig> = fc.record({
  enabled: fc.boolean(),
  url: fc.webUrl(),
  ecosystemDid: fc.string(),
  cacheTTL: fc.nat(),
  showWarningForUntrusted: fc.boolean(),
  blockUntrustedIssuers: fc.boolean(),
  blockUntrustedVerifiers: fc.boolean(),
})

const trustRegistryMetadataArb: fc.Arbitrary<TrustRegistryMetadata> = fc.record({
  name: fc.string(),
  version: fc.string(),
  protocol: fc.string(),
  status: registryStatusArb,
  supportedActions: fc.array(fc.string()),
  supportedDIDMethods: fc.array(fc.string()),
  features: fc.record({
    authorization: fc.boolean(),
    recognition: fc.boolean(),
    delegation: fc.boolean(),
    publicTrustedList: fc.boolean(),
  }),
})

const issuerInfoArb: fc.Arbitrary<IssuerInfo> = fc.record({
  did: fc.string(),
  name: fc.string(),
  status: entityStatusArb,
  accreditationLevel: fc.option(accreditationLevelArb, { nil: undefined }),
  credentialTypes: fc.array(credentialTypeInfoArb),
  jurisdictions: fc.option(fc.array(jurisdictionArb), { nil: undefined }),
  validFrom: fc.option(fc.date().map((d) => d.toISOString()), { nil: undefined }),
  validUntil: fc.option(fc.date().map((d) => d.toISOString()), { nil: undefined }),
  registry: fc.option(registryInfoArb, { nil: undefined }),
})

const verifierInfoArb: fc.Arbitrary<VerifierInfo> = fc.record({
  did: fc.string(),
  name: fc.string(),
  status: entityStatusArb,
  accreditationLevel: fc.option(accreditationLevelArb, { nil: undefined }),
  credentialTypes: fc.array(credentialTypeInfoArb),
  jurisdictions: fc.option(fc.array(jurisdictionArb), { nil: undefined }),
  registry: fc.option(registryInfoArb, { nil: undefined }),
})

const authorizationRequestArb: fc.Arbitrary<AuthorizationRequest> = fc.record({
  entity_id: fc.string(),
  authority_id: fc.string(),
  action: fc.constantFrom<'issue' | 'verify'>('issue', 'verify'),
  resource: fc.string(),
  context: fc.option(
    fc.record({
      time: fc.option(fc.date().map((d) => d.toISOString()), { nil: undefined }),
    }),
    { nil: undefined }
  ),
})

const authorizationResponseArb: fc.Arbitrary<AuthorizationResponse> = fc.record({
  entity_id: fc.string(),
  authority_id: fc.string(),
  action: fc.string(),
  resource: fc.string(),
  authorized: fc.boolean(),
  time_requested: fc.option(fc.date().map((d) => d.toISOString()), { nil: undefined }),
  time_evaluated: fc.date().map((d) => d.toISOString()),
  message: fc.string(),
  // Use simple string values to avoid JSON serialization issues with complex nested objects
  context: fc.option(fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.boolean())), { nil: undefined }),
})

const trustResultArb: fc.Arbitrary<TrustResult> = fc.record({
  level: trustLevelArb,
  found: fc.boolean(),
  entity: fc.option(fc.oneof(issuerInfoArb, verifierInfoArb), { nil: undefined }),
  message: fc.option(fc.string(), { nil: undefined }),
  checkedAt: fc.date(),
})

describe('Type Serialization Round-Trip', () => {
  const numRuns = 100

  it('TrustRegistryConfig serializes and deserializes correctly', () => {
    fc.assert(
      fc.property(trustRegistryConfigArb, (config) => {
        const serialized = JSON.stringify(config)
        const deserialized = JSON.parse(serialized) as TrustRegistryConfig
        expect(deserialized).toEqual(config)
      }),
      { numRuns }
    )
  })

  it('TrustRegistryMetadata serializes and deserializes correctly', () => {
    fc.assert(
      fc.property(trustRegistryMetadataArb, (metadata) => {
        const serialized = JSON.stringify(metadata)
        const deserialized = JSON.parse(serialized) as TrustRegistryMetadata
        expect(deserialized).toEqual(metadata)
      }),
      { numRuns }
    )
  })

  it('IssuerInfo serializes and deserializes correctly', () => {
    fc.assert(
      fc.property(issuerInfoArb, (issuer) => {
        const serialized = JSON.stringify(issuer)
        const deserialized = JSON.parse(serialized) as IssuerInfo
        expect(deserialized).toEqual(issuer)
      }),
      { numRuns }
    )
  })

  it('VerifierInfo serializes and deserializes correctly', () => {
    fc.assert(
      fc.property(verifierInfoArb, (verifier) => {
        const serialized = JSON.stringify(verifier)
        const deserialized = JSON.parse(serialized) as VerifierInfo
        expect(deserialized).toEqual(verifier)
      }),
      { numRuns }
    )
  })

  it('AuthorizationRequest serializes and deserializes correctly', () => {
    fc.assert(
      fc.property(authorizationRequestArb, (request) => {
        const serialized = JSON.stringify(request)
        const deserialized = JSON.parse(serialized) as AuthorizationRequest
        expect(deserialized).toEqual(request)
      }),
      { numRuns }
    )
  })

  it('AuthorizationResponse serializes and deserializes correctly', () => {
    fc.assert(
      fc.property(authorizationResponseArb, (response) => {
        const serialized = JSON.stringify(response)
        const deserialized = JSON.parse(serialized) as AuthorizationResponse
        expect(deserialized).toEqual(response)
      }),
      { numRuns }
    )
  })

  it('TrustResult serializes and deserializes correctly (with date conversion)', () => {
    fc.assert(
      fc.property(trustResultArb, (result) => {
        const serialized = JSON.stringify(result)
        const deserialized = JSON.parse(serialized)
        // Date needs special handling - convert back to Date object
        deserialized.checkedAt = new Date(deserialized.checkedAt)
        expect(deserialized.level).toEqual(result.level)
        expect(deserialized.found).toEqual(result.found)
        expect(deserialized.message).toEqual(result.message)
        expect(deserialized.checkedAt.getTime()).toEqual(result.checkedAt.getTime())
      }),
      { numRuns }
    )
  })
})
