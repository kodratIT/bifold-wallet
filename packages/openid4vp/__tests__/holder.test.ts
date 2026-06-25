import {
  acceptAuthorizationRequest,
  resolveAuthorizationRequest,
  validateAuthorizationRequestPayload,
} from '../src'

import { dcqlQueryFixture, walletCredentialsFixture } from '../__fixtures__/dcql-queries'
import { createDidWebJwtFixture } from '../__fixtures__/crypto-fixtures'

const validAuthorizationRequestPayload = {
  client_id: 'did:example:verifier',
  client_metadata: {
    vp_formats_supported: {
      'vc+sd-jwt': {},
    },
  },
  dcql_query: dcqlQueryFixture,
  nonce: 'abcdefghijklmnopqrstuvwxyz',
  response_mode: 'direct_post',
  response_type: 'vp_token',
  response_uri: 'https://verifier.example/response',
  state: 'state',
} as const

describe('holder service', () => {
  it('resolves invitation URLs through upstream callbacks and evaluates DCQL', async () => {
    const fetchJwtFromUri = jest.fn().mockResolvedValue('header.payload.signature')
    const resolveOpenid4vpAuthorizationRequest = jest.fn().mockResolvedValue({
      authorizationRequestPayload: validAuthorizationRequestPayload,
      client: {},
      dcql: {
        query: dcqlQueryFixture,
      },
      jar: undefined,
      version: 100,
    })

    const resolved = await resolveAuthorizationRequest({
      dependencies: {
        fetchJwtFromUri,
        resolveOpenid4vpAuthorizationRequest,
      },
      request:
        'openid://?client_id=did%3Aexample%3Averifier&request_uri=https%3A%2F%2Fverifier.example%2Frequest.jwt',
      walletCredentials: walletCredentialsFixture,
    })

    expect(fetchJwtFromUri).toHaveBeenCalledWith('https://verifier.example/request.jwt', {
      fetch: undefined,
    })
    expect(resolveOpenid4vpAuthorizationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        callbacks: expect.objectContaining({
          fetch: undefined,
          getX509CertificateMetadata: expect.any(Function),
          hash: expect.any(Function),
          verifyJwt: expect.any(Function),
        }),
      })
    )
    expect(resolved.dcqlResult?.can_be_satisfied).toBe(true)
    expect(resolved.vpFormatsSupported).toEqual({
      'vc+sd-jwt': {},
    })
  })

  it('passes DID Document resolver adapters into upstream verifyJwt callbacks', async () => {
    const fixture = await createDidWebJwtFixture({
      did: 'did:webvh:QmVerifier:verifier.example.com',
    })
    const fetchJwtFromUri = jest.fn().mockResolvedValue(fixture.jwt)
    const resolveOpenid4vpAuthorizationRequest = jest.fn().mockResolvedValue({
      authorizationRequestPayload: {
        ...validAuthorizationRequestPayload,
        client_id: fixture.did,
      },
      client: {},
      jar: undefined,
      version: 100,
    })

    await resolveAuthorizationRequest({
      dependencies: {
        fetchJwtFromUri,
        resolveOpenid4vpAuthorizationRequest,
      },
      didDocumentResolver: async () => ({
        id: fixture.did,
        verificationMethod: [
          {
            id: fixture.kid,
            controller: fixture.did,
            publicKeyJwk: fixture.jwk,
            type: 'JsonWebKey2020',
          },
        ],
      }),
      request:
        'openid://?client_id=did%3Awebvh%3AQmVerifier%3Averifier.example.com&request_uri=https%3A%2F%2Fverifier.example%2Frequest.jwt',
    })

    const verifyJwt = resolveOpenid4vpAuthorizationRequest.mock.calls[0][0].callbacks.verifyJwt

    await expect(
      verifyJwt(
        {
          alg: fixture.alg,
          didUrl: fixture.kid,
          method: 'did',
        },
        {
          compact: fixture.jwt,
          header: {
            alg: fixture.alg,
          },
          payload: {
            client_id: fixture.did,
          },
        }
      )
    ).resolves.toMatchObject({
      verified: true,
    })
  })

  it('rejects transaction_data with OAuth-style invalid_request errors', () => {
    expect(() =>
      validateAuthorizationRequestPayload({
        ...validAuthorizationRequestPayload,
        transaction_data: ['unsupported'],
      })
    ).toThrow(/transaction_data/)
  })

  it('rejects missing mandatory direct_post fields', () => {
    expect(() =>
      validateAuthorizationRequestPayload({
        ...validAuthorizationRequestPayload,
        response_type: 'code',
      } as never)
    ).toThrow(/response_type/)

    expect(() =>
      validateAuthorizationRequestPayload({
        ...validAuthorizationRequestPayload,
        state: '',
      })
    ).toThrow(/state/)

    expect(() =>
      validateAuthorizationRequestPayload({
        ...validAuthorizationRequestPayload,
        client_id: '',
      })
    ).toThrow(/client_id/)

    expect(() =>
      validateAuthorizationRequestPayload({
        ...validAuthorizationRequestPayload,
        response_uri: undefined,
      })
    ).toThrow(/response_uri/)
  })

  it('rejects non URL-safe nonce values', () => {
    expect(() =>
      validateAuthorizationRequestPayload({
        ...validAuthorizationRequestPayload,
        nonce: 'not long enough!',
      })
    ).toThrow(/nonce/)
  })

  it('accepts resolved requests by building a DCQL vp_token and submitting upstream', async () => {
    const submitOpenid4vpAuthorizationResponse = jest.fn().mockResolvedValue({
      response: {
        ok: true,
        text: jest.fn().mockResolvedValue('{"accepted":true}'),
      },
      responseMode: 'direct_post',
    })

    await expect(
      acceptAuthorizationRequest({
        authorizationRequestPayload: {
          response_uri: 'https://verifier.example/response',
        },
        dependencies: {
          submitOpenid4vpAuthorizationResponse,
        },
        selectedCredentials: {
          identity_sd_jwt: [walletCredentialsFixture[0]],
        },
      })
    ).resolves.toEqual({
      ok: true,
      responseMode: 'direct_post',
      serverResponse: {
        accepted: true,
      },
    })

    expect(submitOpenid4vpAuthorizationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationResponsePayload: {
          vp_token: {
            identity_sd_jwt: ['sd-jwt-presentation'],
          },
        },
      })
    )
  })

  it('resolves raw JWT requests and returns undefined for empty server responses', async () => {
    const resolveOpenid4vpAuthorizationRequest = jest.fn().mockResolvedValue({
      authorizationRequestPayload: validAuthorizationRequestPayload,
      client: {},
      jar: undefined,
      version: 100,
    })
    const resolved = await resolveAuthorizationRequest({
      dependencies: {
        resolveOpenid4vpAuthorizationRequest,
      },
      request: 'header.payload.signature',
      responseMode: {
        type: 'direct_post',
      },
    })

    expect(resolveOpenid4vpAuthorizationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationRequestPayload: {
          request: 'header.payload.signature',
        },
      })
    )
    expect(resolved.dcqlResult).toBeUndefined()

    await expect(
      acceptAuthorizationRequest({
        authorizationRequestPayload: {
          response_uri: 'https://verifier.example/response',
        },
        dependencies: {
          submitOpenid4vpAuthorizationResponse: jest.fn().mockResolvedValue({
            response: {
              ok: true,
              text: jest.fn().mockResolvedValue(''),
            },
            responseMode: 'direct_post',
          }),
        },
      })
    ).resolves.toEqual({
      ok: true,
      responseMode: 'direct_post',
      serverResponse: undefined,
    })
  })
})
