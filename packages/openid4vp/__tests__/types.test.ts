import type {
  AcceptAuthorizationRequestOptions,
  AcceptAuthorizationRequestResult,
  AuthRequestPayload,
  ClientIdScheme,
  DcqlQueryResult,
  ResolvedAuthorizationRequest,
} from '../src'

describe('OpenID4VP public types', () => {
  it('exposes story-facing aliases backed by upstream library types', () => {
    const didScheme: ClientIdScheme = 'did'
    const x509Scheme: ClientIdScheme = 'x509_san_dns'
    const authRequest: AuthRequestPayload = {
      response_type: 'vp_token',
      client_id: 'did:example:verifier',
      nonce: 'nonce',
    }
    const dcqlResult: DcqlQueryResult = {
      can_be_satisfied: true,
      credential_matches: {},
      credentials: [],
      matches: {},
      presentations: {
        credential_query: ['header.payload.signature'],
      },
      query: {
        credentials: [],
      },
    }
    const acceptOptions = {
      authorizationRequestPayload: {
        response_uri: 'https://verifier.example/response',
      },
      authorizationResponsePayload: {
        vp_token: 'header.payload.signature',
      },
      callbacks: {
        fetch: jest.fn(),
      },
    } satisfies AcceptAuthorizationRequestOptions
    const resolvedRequest = undefined as unknown as ResolvedAuthorizationRequest
    const acceptResult = undefined as unknown as AcceptAuthorizationRequestResult

    expect(didScheme).toBe('did')
    expect(x509Scheme).toBe('x509_san_dns')
    expect(authRequest.client_id).toBe('did:example:verifier')
    expect(dcqlResult.presentations.credential_query[0]).toBe('header.payload.signature')
    expect(acceptOptions.authorizationRequestPayload.response_uri).toBe('https://verifier.example/response')
    expect(resolvedRequest).toBeUndefined()
    expect(acceptResult).toBeUndefined()
  })
})
