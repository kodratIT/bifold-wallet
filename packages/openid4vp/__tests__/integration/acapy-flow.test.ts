import {
  acceptAuthorizationRequest,
  evaluateDcqlQuery,
  resolveAuthorizationRequest,
  verifyDidJwkSignature,
} from '../../src'

import { createDidJwkJwtFixture } from '../../__fixtures__/crypto-fixtures'
import { dcqlQueryFixture, walletCredentialsFixture } from '../../__fixtures__/dcql-queries'

describe('OpenID4VP package integration flow', () => {
  it('verifies crypto, evaluates DCQL, resolves, and accepts with injected upstream calls', async () => {
    const didFixture = await createDidJwkJwtFixture()

    await expect(verifyDidJwkSignature(didFixture.jwt, didFixture.kid, didFixture.alg)).resolves.toBe(true)

    const dcqlResult = evaluateDcqlQuery(dcqlQueryFixture, walletCredentialsFixture)
    expect(dcqlResult.can_be_satisfied).toBe(true)

    const authorizationRequestPayload = {
      client_id: 'did:example:verifier',
      dcql_query: dcqlQueryFixture,
      nonce: 'abcdefghijklmnopqrstuvwxyz',
      response_mode: 'direct_post',
      response_type: 'vp_token',
      response_uri: 'https://verifier.example/response',
      state: 'state',
    } as const
    const resolved = await resolveAuthorizationRequest({
      dependencies: {
        fetchJwtFromUri: jest.fn().mockResolvedValue(didFixture.jwt),
        resolveOpenid4vpAuthorizationRequest: jest.fn().mockResolvedValue({
          authorizationRequestPayload,
          client: {},
          dcql: {
            query: dcqlQueryFixture,
          },
          jar: undefined,
          version: 100,
        }),
      },
      request:
        'openid://?client_id=did%3Aexample%3Averifier&request_uri=https%3A%2F%2Fverifier.example%2Frequest.jwt',
      walletCredentials: walletCredentialsFixture,
    })

    expect(resolved.dcqlResult?.can_be_satisfied).toBe(true)

    await expect(
      acceptAuthorizationRequest({
        authorizationRequestPayload: {
          response_uri: authorizationRequestPayload.response_uri,
        },
        dependencies: {
          submitOpenid4vpAuthorizationResponse: jest.fn().mockResolvedValue({
            response: {
              ok: true,
              text: jest.fn().mockResolvedValue('accepted'),
            },
            responseMode: 'direct_post',
          }),
        },
        selectedCredentials: {
          identity_sd_jwt: [walletCredentialsFixture[0]],
        },
      })
    ).resolves.toMatchObject({
      ok: true,
      serverResponse: 'accepted',
    })
  })
})
