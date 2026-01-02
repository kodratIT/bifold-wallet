/**
* Development Mode DIDs
* Used when devMode is enabled in TrustRegistryConfig
*/

export const DevModeDids = {
    // Foreign Authority DID to be recognized
    ENTITY_ID: 'did:sov:kkZnmTfRA3GJ3vbxkky4Rd',

    // Local Anchor DID (Ecosystem DID)
    AUTHORITY_ID: 'did:sov:kSZnmTfRA3GJ3vbxkky4Rs',

    // Default Recognition Action
    ACTION: 'govern' as const,

    // Default Resource
    RESOURCE: 'vaksinTBC',
}
