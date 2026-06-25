import { Linking } from 'react-native'
import { acceptAuthorizationRequest, resolveAuthorizationRequest } from '@bifold/openid4vp'
import {
  fetchInvitationDataUrl,
  getCredentialsForProofRequest,
  shareProof,
} from '../../../src/modules/openid/resolverProof'

jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn(),
  },
}))

jest.mock('@bifold/openid4vp', () => ({
  acceptAuthorizationRequest: jest.fn(),
  resolveAuthorizationRequest: jest.fn(),
}))

const mockResolveAuthorizationRequest = resolveAuthorizationRequest as jest.Mock
const mockAcceptAuthorizationRequest = acceptAuthorizationRequest as jest.Mock

describe('getCredentialsForProofRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn() as jest.Mock
  })

  test('forwards a raw authorization request string unchanged', async () => {
    const request = 'eyJhbGciOiJFZERTQSJ9.eyJyZXNwb25zZV91cmkiOiJodHRwczovL3ZlcmlmaWVyLmV4YW1wbGUuY29tL2NhbGxiYWNrIn0.signature'
    mockResolveAuthorizationRequest.mockResolvedValue({
      presentationExchange: {
        definition: { id: 'definition-id', input_descriptors: [] },
        credentialsForRequest: undefined,
      },
      authorizationRequestPayload: {
        response_uri: 'https://verifier.example.com/callback',
      },
      verifier: {
        clientIdPrefix: 'redirect_uri',
        effectiveClientId: 'https://verifier.example.com/callback',
      },
    })

    const agent = {
      config: {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
        },
      },
      dids: {
        resolveDidDocument: jest.fn(),
      },
    }

    await getCredentialsForProofRequest({
      agent: agent as any,
      request,
    })

    expect(mockResolveAuthorizationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        didDocumentResolver: expect.any(Function),
        request,
      })
    )
  })

  test('injects a Credo agent DID Document resolver for did:web and did:webvh verifier auth', async () => {
    mockResolveAuthorizationRequest.mockResolvedValue({
      presentationExchange: {
        definition: { id: 'definition-id', input_descriptors: [] },
        credentialsForRequest: undefined,
      },
      authorizationRequestPayload: {
        response_uri: 'https://verifier.example.com/callback',
      },
      verifier: {
        clientIdPrefix: 'decentralized_identifier',
        effectiveClientId: 'did:web:verifier.example.com',
      },
    })
    const didDocumentJson = {
      id: 'did:web:verifier.example.com',
      verificationMethod: [
        {
          id: 'did:web:verifier.example.com#key-1',
          publicKeyJwk: {
            crv: 'P-256',
            kty: 'EC',
            x: 'x',
            y: 'y',
          },
        },
      ],
    }
    const agent = {
      config: {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
        },
      },
      dids: {
        resolveDidDocument: jest.fn().mockResolvedValue({
          toJSON: () => didDocumentJson,
        }),
      },
    }

    await getCredentialsForProofRequest({
      agent: agent as any,
      request: 'eyJhbGciOiJFUzI1NiJ9.payload.signature',
    })

    const didDocumentResolver = mockResolveAuthorizationRequest.mock.calls[0][0].didDocumentResolver

    await expect(didDocumentResolver('did:web:verifier.example.com')).resolves.toEqual(didDocumentJson)
    expect(agent.dids.resolveDidDocument).toHaveBeenCalledWith('did:web:verifier.example.com')
  })

  test('parses a fetched didcomm invitation from json', async () => {
    const fetchMock = global.fetch as jest.Mock

    fetchMock.mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn().mockReturnValue('application/json'),
      },
      json: jest.fn().mockResolvedValue({
        '@type': 'https://didcomm.org/out-of-band/2.0/invitation',
        id: 'invitation-id',
      }),
    })

    await expect(fetchInvitationDataUrl('https://example.com/invitation')).resolves.toEqual({
      success: true,
      result: {
        format: 'parsed',
        type: 'didcomm',
        data: {
          '@type': 'https://didcomm.org/out-of-band/2.0/invitation',
          id: 'invitation-id',
        },
      },
    })
  })

  test('parses a fetched authorization request from text', async () => {
    const jwt = 'eyJhbGciOiJFZERTQSJ9.payload.signature'
    const fetchMock = global.fetch as jest.Mock

    fetchMock.mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn().mockReturnValue('text/plain'),
      },
      text: jest.fn().mockResolvedValue(jwt),
    })

    await expect(fetchInvitationDataUrl('https://example.com/request')).resolves.toEqual({
      success: true,
      result: {
        format: 'parsed',
        type: 'openid-authorization-request',
        data: jwt,
      },
    })
  })

  test('wraps invitation fetch failures with a retrieval error', async () => {
    const fetchMock = global.fetch as jest.Mock

    fetchMock.mockResolvedValue({
      ok: false,
      headers: {
        get: jest.fn(),
      },
    })

    await expect(fetchInvitationDataUrl('https://example.com/fail')).rejects.toThrow(
      '[retrieve_invitation_error] Unable to retrieve invitation'
    )
  })

  test('returns a request record with verifier hostname extracted from response_uri', async () => {
    mockResolveAuthorizationRequest.mockResolvedValue({
      presentationExchange: {
        definition: { id: 'definition-id', input_descriptors: [] },
        credentialsForRequest: undefined,
      },
      authorizationRequestPayload: {
        response_uri: 'https://verifier.example.com/callback',
      },
      verifier: {
        clientIdPrefix: 'redirect_uri',
        effectiveClientId: 'https://verifier.example.com/callback',
      },
    })

    const agent = {
      config: {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
        },
      },
      dids: {
        resolveDidDocument: jest.fn(),
      },
    }

    const result = await getCredentialsForProofRequest({
      agent: agent as any,
      request: 'eyJhbGciOiJFZERTQSJ9.payload.signature',
    })

    expect(result?.verifierHostName).toBe('verifier.example.com')
    expect(result?.type).toBe('OpenId4VPRequestRecord')
  })

  test('logs and rethrows when the authorization request has neither pex nor dcql payload', async () => {
    mockResolveAuthorizationRequest.mockResolvedValue({
      presentationExchange: undefined,
      dcql: undefined,
      authorizationRequestPayload: {},
      verifier: {
        clientIdPrefix: 'redirect_uri',
        effectiveClientId: 'https://verifier.example.com/callback',
      },
    })
    const logger = {
      info: jest.fn(),
      error: jest.fn(),
    }
    const agent = {
      config: { logger },
      dids: {
        resolveDidDocument: jest.fn(),
      },
    }

    await expect(
      getCredentialsForProofRequest({
        agent: agent as any,
        request: 'eyJhbGciOiJFZERTQSJ9.payload.signature',
      })
    ).rejects.toThrow('Unsupported authorization request: missing presentation exchange or dcql parameters.')

    expect(logger.error).toHaveBeenCalledWith(
      'Parsing presentation request:  Unsupported authorization request: missing presentation exchange or dcql parameters.'
    )
  })

  test('shares a pex proof with the selected credential and opens redirect_uri when returned', async () => {
    const credentialA = { id: 'cred-a' }
    const credentialB = { id: 'cred-b' }
    mockAcceptAuthorizationRequest.mockResolvedValue({
      ok: true,
      serverResponse: {
        status: 200,
        body: {
          redirect_uri: 'https://wallet.example/complete',
        },
      },
    })
    const agent = {}
    const requestRecord = {
      authorizationRequestPayload: { client_id: 'verifier' },
      origin: 'https://verifier.example.com',
      presentationExchange: {
        credentialsForRequest: {
          areRequirementsSatisfied: true,
          requirements: [
            {
              submissionEntry: [
                {
                  inputDescriptorId: 'descriptor-1',
                  verifiableCredentials: [{ credentialRecord: credentialA }, { credentialRecord: credentialB }],
                },
              ],
            },
          ],
        },
      },
    }

    await shareProof({
      agent: agent as any,
      requestRecord: requestRecord as any,
      selectedProofCredentials: {
        'descriptor-1': {
          id: 'cred-b',
          claimFormat: 'jwt_vc_json',
        },
      },
    })

    expect(mockAcceptAuthorizationRequest).toHaveBeenCalledWith({
      authorizationRequestPayload: { client_id: 'verifier' },
      selectedCredentials: {
        'descriptor-1': [{ credentialRecord: credentialB }],
      },
    })
    expect(Linking.openURL).toHaveBeenCalledWith('https://wallet.example/complete')
  })

  test('selects first matching dcql credential when no credential is preselected', async () => {
    mockAcceptAuthorizationRequest.mockResolvedValue({
      ok: true,
      serverResponse: {
        status: 200,
        body: 'ok',
      },
    })
    const agent = {}
    const validCredential = {
      credentialRecord: { id: 'cred-a' },
      claimFormat: 'dcql',
    }
    const requestRecord = {
      authorizationRequestPayload: { client_id: 'verifier' },
      origin: 'https://verifier.example.com',
      dcql: {
        queryResult: {
          can_be_satisfied: true,
          credential_matches: {
            queryA: {
              success: true,
              valid_credentials: [validCredential],
            },
          },
        },
      },
    }

    await shareProof({
      agent: agent as any,
      requestRecord: requestRecord as any,
      selectedProofCredentials: {},
    })

    expect(mockAcceptAuthorizationRequest).toHaveBeenCalledWith({
      authorizationRequestPayload: { client_id: 'verifier' },
      selectedCredentials: {
        queryA: [validCredential],
      },
    })
  })

  test('throws before submission when proof requirements are not satisfied', async () => {
    await expect(
      shareProof({
        agent: {} as any,
        requestRecord: {
          presentationExchange: {
            credentialsForRequest: {
              areRequirementsSatisfied: false,
              requirements: [],
            },
          },
        } as any,
        selectedProofCredentials: {},
      })
    ).rejects.toThrow('Requirements from proof request are not satisfied')
  })

  test('wraps submission errors from the verifier response', async () => {
    mockAcceptAuthorizationRequest.mockResolvedValue({
      ok: true,
      serverResponse: {
        status: 400,
        body: 'Verifier rejected proof',
      },
    })

    await expect(
      shareProof({
        agent: {} as any,
        requestRecord: {
          authorizationRequestPayload: { client_id: 'verifier' },
          origin: 'https://verifier.example.com',
          presentationExchange: {
            credentialsForRequest: {
              areRequirementsSatisfied: true,
              requirements: [
                {
                  submissionEntry: [
                    {
                      inputDescriptorId: 'descriptor-1',
                      verifiableCredentials: [{ credentialRecord: { id: 'cred-a' } }],
                    },
                  ],
                },
              ],
            },
          },
        } as any,
        selectedProofCredentials: {
          'descriptor-1': {
            id: 'cred-a',
            claimFormat: 'jwt_vc_json',
          },
        },
      })
    ).rejects.toThrow('Error accepting proof request. Error while accepting authorization request. Verifier rejected proof')
  })

  test('completes a simulated openid invitation resolve and accept sequence', async () => {
    const credential = { id: 'cred-a' }
    mockResolveAuthorizationRequest.mockResolvedValue({
      presentationExchange: {
        credentialsForRequest: {
          areRequirementsSatisfied: true,
          requirements: [
            {
              submissionEntry: [
                {
                  inputDescriptorId: 'descriptor-1',
                  verifiableCredentials: [{ credentialRecord: credential }],
                },
              ],
            },
          ],
        },
      },
      authorizationRequestPayload: {
        response_uri: 'https://verifier.example.com/callback',
      },
    })
    mockAcceptAuthorizationRequest.mockResolvedValue({
      ok: true,
      serverResponse: {
        accepted: true,
      },
    })
    const agent = {
      config: {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
        },
      },
      dids: {
        resolveDidDocument: jest.fn(),
      },
    }

    const requestRecord = await getCredentialsForProofRequest({
      agent: agent as any,
      request:
        'openid://?client_id=did%3Aexample%3Averifier&request_uri=https%3A%2F%2Fverifier.example.com%2Frequest.jwt',
    })

    await expect(
      shareProof({
        agent: {} as any,
        requestRecord: requestRecord as any,
        selectedProofCredentials: {
          'descriptor-1': {
            claimFormat: 'jwt_vc_json',
            id: 'cred-a',
          },
        },
      })
    ).resolves.toMatchObject({
      ok: true,
    })

    expect(mockResolveAuthorizationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        didDocumentResolver: expect.any(Function),
        request:
          'openid://?client_id=did%3Aexample%3Averifier&request_uri=https%3A%2F%2Fverifier.example.com%2Frequest.jwt',
      })
    )
    expect(mockAcceptAuthorizationRequest).toHaveBeenCalledWith({
      authorizationRequestPayload: {
        response_uri: 'https://verifier.example.com/callback',
      },
      selectedCredentials: {
        'descriptor-1': [{ credentialRecord: credential }],
      },
    })
  })
})
