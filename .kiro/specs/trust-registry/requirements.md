# Requirements Document

## Introduction

Dokumen ini mendefinisikan requirements untuk integrasi Trust Registry Protocol (ToIP TRQP v2) ke dalam Bifold Wallet. Trust Registry memungkinkan wallet untuk memverifikasi apakah issuer/verifier terdaftar dan berwenang dalam suatu trust ecosystem sebelum menerima credential atau membagikan proof.

Fitur ini akan diimplementasikan sebagai package terpisah (`@bifold/trust-registry`) untuk menjaga kompatibilitas dengan upstream Bifold dan memudahkan maintenance.

## Glossary

- **Trust Registry**: Layanan yang menyimpan dan menyediakan informasi tentang entitas (issuer/verifier) yang terdaftar dan berwenang dalam suatu trust ecosystem
- **ToIP TRQP**: Trust over IP Trust Registry Query Protocol - spesifikasi standar untuk query trust registry
- **Issuer**: Entitas yang menerbitkan verifiable credential
- **Verifier**: Entitas yang meminta dan memverifikasi verifiable credential
- **DID**: Decentralized Identifier - identifier unik untuk entitas dalam ekosistem SSI
- **Ecosystem DID**: DID yang merepresentasikan trust ecosystem/authority
- **Accreditation Level**: Tingkat akreditasi entitas (high, medium, low)
- **Entity Status**: Status entitas dalam registry (pending, active, suspended, revoked)
- **Trust Level**: Hasil evaluasi trust (trusted_high, trusted_medium, trusted_low, untrusted, suspended, revoked, unknown)
- **Credential Type**: Jenis credential yang dapat diterbitkan atau diverifikasi

## Requirements

### Requirement 1: Package Setup

**User Story:** As a developer, I want a separate trust-registry package, so that the implementation remains fork-friendly and does not conflict with upstream Bifold updates.

#### Acceptance Criteria

1. THE trust-registry package SHALL be created at `packages/trust-registry/` with proper package.json configuration
2. THE trust-registry package SHALL include TypeScript configuration that extends the base tsconfig
3. WHEN the package is built THEN the system SHALL output compiled JavaScript and type definitions to the build directory
4. THE trust-registry package SHALL declare @bifold/core as a workspace dependency

### Requirement 2: Type Definitions

**User Story:** As a developer, I want comprehensive TypeScript type definitions, so that I can work with trust registry data in a type-safe manner.

#### Acceptance Criteria

1. THE system SHALL define TrustRegistryConfig interface with properties: enabled, url, ecosystemDid, cacheTTL, showWarningForUntrusted, blockUntrustedIssuers, blockUntrustedVerifiers
2. THE system SHALL define TrustRegistryMetadata interface matching the ToIP TRQP v2 metadata response structure
3. THE system SHALL define IssuerInfo and VerifierInfo interfaces with properties: did, name, status, accreditationLevel, credentialTypes, jurisdictions, validFrom, validUntil, registry
4. THE system SHALL define AuthorizationRequest and AuthorizationResponse interfaces matching ToIP TRQP v2 specification
5. THE system SHALL define TrustLevel type with values: trusted_high, trusted_medium, trusted_low, untrusted, suspended, revoked, unknown
6. THE system SHALL define TrustResult interface with properties: level, found, entity, message, checkedAt

### Requirement 3: Trust Registry Service

**User Story:** As a wallet application, I want to query the trust registry API, so that I can verify the trust status of issuers and verifiers.

#### Acceptance Criteria

1. WHEN getMetadata is called THEN the TrustRegistryService SHALL send GET request to /v2/metadata and return TrustRegistryMetadata
2. WHEN lookupIssuer is called with a DID THEN the TrustRegistryService SHALL send GET request to /v2/public/lookup/issuer/{did} and return TrustResult
3. WHEN lookupVerifier is called with a DID THEN the TrustRegistryService SHALL send GET request to /v2/public/lookup/verifier/{did} and return TrustResult
4. WHEN checkIssuerAuthorization is called THEN the TrustRegistryService SHALL send POST request to /v2/authorization with action "issue" and return AuthorizationResponse
5. WHEN checkVerifierAuthorization is called THEN the TrustRegistryService SHALL send POST request to /v2/authorization with action "verify" and return AuthorizationResponse
6. WHEN a DID contains special characters THEN the TrustRegistryService SHALL URL-encode the DID before including it in the request path
7. IF a network error occurs THEN the TrustRegistryService SHALL throw a descriptive error that can be handled by the caller

### Requirement 4: Caching Layer

**User Story:** As a wallet application, I want trust registry responses to be cached, so that network requests are minimized and performance is improved.

#### Acceptance Criteria

1. THE cache utility SHALL store lookup results with configurable TTL (time-to-live)
2. WHEN a cached entry exists and has not expired THEN the system SHALL return the cached value without making a network request
3. WHEN a cached entry has expired THEN the system SHALL make a new network request and update the cache
4. WHEN clearCache is called THEN the system SHALL remove all cached entries
5. THE cache SHALL use a key format that uniquely identifies each query type and parameters

### Requirement 5: React Context and Hooks

**User Story:** As a React developer, I want context and hooks for trust registry, so that I can easily access trust registry functionality in UI components.

#### Acceptance Criteria

1. THE TrustRegistryProvider SHALL accept config prop and provide TrustRegistryService instance to child components
2. THE useTrustRegistry hook SHALL return context value with: isEnabled, isAvailable, metadata, checkIssuer, checkVerifier, checkIssuerAuthorization, checkVerifierAuthorization, refreshMetadata, clearCache
3. WHEN useIssuerTrust hook is called with a DID THEN the hook SHALL return trustResult and isLoading state
4. WHEN useVerifierTrust hook is called with a DID THEN the hook SHALL return trustResult and isLoading state
5. WHEN useTrustRegistryStatus hook is called THEN the hook SHALL return isAvailable and metadata

### Requirement 6: Trust Badge Component

**User Story:** As a user, I want to see visual indicators of trust status, so that I can make informed decisions about accepting credentials or sharing proofs.

#### Acceptance Criteria

1. WHEN trustResult.level is trusted_high THEN the TrustBadge SHALL display a green checkmark icon with "Trusted - High Accreditation" label
2. WHEN trustResult.level is trusted_medium THEN the TrustBadge SHALL display a blue checkmark icon with "Trusted" label
3. WHEN trustResult.level is trusted_low THEN the TrustBadge SHALL display a gray checkmark icon with "Registered" label
4. WHEN trustResult.level is untrusted THEN the TrustBadge SHALL display a yellow warning icon with "Unregistered" label
5. WHEN trustResult.level is suspended THEN the TrustBadge SHALL display an orange warning icon with "Suspended" label
6. WHEN trustResult.level is revoked THEN the TrustBadge SHALL display a red X icon with "Revoked" label
7. WHEN trustResult.level is unknown THEN the TrustBadge SHALL display a gray question mark icon with "Unknown" label
8. THE TrustBadge SHALL support size prop with values: small, medium, large
9. THE TrustBadge SHALL support onPress prop for displaying detailed trust information

### Requirement 7: Trust Warning Component

**User Story:** As a user, I want to see warnings for untrusted entities, so that I am aware of potential risks before proceeding.

#### Acceptance Criteria

1. WHEN an issuer is not found in the registry THEN the TrustWarning SHALL display a dismissible warning banner with appropriate message
2. WHEN an issuer status is suspended or revoked THEN the TrustWarning SHALL display a non-dismissible warning banner with status reason
3. THE TrustWarning SHALL include a "Learn more" action that explains trust registry verification
4. THE TrustWarning SHALL be accessible with proper ARIA labels and roles

### Requirement 8: Issuer Info Card Component

**User Story:** As a user, I want to see detailed issuer information from the registry, so that I can verify the issuer's credentials and authorization.

#### Acceptance Criteria

1. THE IssuerInfoCard SHALL display issuer name and DID
2. THE IssuerInfoCard SHALL display accreditation level with appropriate visual indicator
3. THE IssuerInfoCard SHALL display list of credential types the issuer is authorized to issue
4. THE IssuerInfoCard SHALL display validity period (validFrom and validUntil) when available
5. THE IssuerInfoCard SHALL display registry name and ecosystem information

### Requirement 9: Container Integration

**User Story:** As a developer, I want trust registry service registered in the DI container, so that it can be accessed throughout the application.

#### Acceptance Criteria

1. THE system SHALL add TRUST_REGISTRY_TOKENS to container-api.ts with tokens for service and config
2. THE system SHALL register default TrustRegistryConfig in container-impl.ts with enabled set to false
3. WHEN trust registry is enabled THEN the container SHALL provide TrustRegistryService instance

### Requirement 10: Error Handling

**User Story:** As a user, I want graceful error handling when trust registry is unavailable, so that I can still use the wallet with appropriate warnings.

#### Acceptance Criteria

1. IF the trust registry service is unavailable THEN the system SHALL display a warning but allow the user to proceed
2. IF a network timeout occurs THEN the system SHALL retry once before showing an error
3. WHEN an error occurs THEN the system SHALL log the error with appropriate context for debugging
4. THE system SHALL provide clear error messages that help users understand what went wrong

