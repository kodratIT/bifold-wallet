import {
  createVerifyJwtCallback,
  didWebToDidDocumentUrl,
  getX509CertificateMetadata,
  hash,
  jwkFromDidJwk,
  verifyDidDocumentSignature,
  verifyDidJwkSignature,
  verifyJwt,
  verifyX5cSignature,
  x5cToPem,
} from '../src'

import { createDidJwkJwtFixture, createDidWebJwtFixture, createX5cJwtFixture } from '../__fixtures__/crypto-fixtures'

describe('OpenID4VP crypto helpers', () => {
  it('verifies did:jwk signed JWTs', async () => {
    const fixture = await createDidJwkJwtFixture()

    await expect(verifyDidJwkSignature(fixture.jwt, fixture.kid, fixture.alg)).resolves.toBe(true)
  })

  it('throws for unsupported algorithms', async () => {
    const fixture = await createDidJwkJwtFixture()

    await expect(verifyDidJwkSignature(fixture.jwt, fixture.kid, 'HS256')).rejects.toThrow(
      /Unsupported JWT signature algorithm/
    )
  })

  it('throws clear did:jwk parsing errors', () => {
    expect(() => jwkFromDidJwk('did:example:verifier#key-1')).toThrow(/did:jwk/)
    expect(() => jwkFromDidJwk('did:jwk:zInvalid')).toThrow(/base64url/)
    expect(() => jwkFromDidJwk('did:jwk:not-json')).toThrow(/decode/)
  })

  it('maps did:web identifiers to DID Document URLs', () => {
    expect(didWebToDidDocumentUrl('did:web:verifier.example.com')).toBe(
      'https://verifier.example.com/.well-known/did.json'
    )
    expect(didWebToDidDocumentUrl('did:web:verifier.example.com:path')).toBe(
      'https://verifier.example.com/path/did.json'
    )
    expect(didWebToDidDocumentUrl('did:web:localhost%3A3000')).toBe(
      'https://localhost:3000/.well-known/did.json'
    )
  })

  it('verifies did:web signed JWTs through resolved DID Documents', async () => {
    const fixture = await createDidWebJwtFixture()
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
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
    })

    await expect(
      verifyDidDocumentSignature(fixture.jwt, fixture.kid, fixture.alg, {
        expectedClientId: fixture.did,
        fetch,
      })
    ).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledWith('https://verifier.example.com/.well-known/did.json')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('verifies path-based did:web signed JWTs', async () => {
    const fixture = await createDidWebJwtFixture({
      did: 'did:web:verifier.example.com:path',
    })
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: fixture.did,
        verificationMethod: [
          {
            id: '#key-1',
            controller: fixture.did,
            publicKeyJwk: fixture.jwk,
            type: 'JsonWebKey2020',
          },
        ],
      }),
    })

    await expect(
      verifyDidDocumentSignature(fixture.jwt, fixture.kid, fixture.alg, {
        expectedClientId: fixture.did,
        fetch,
      })
    ).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledWith('https://verifier.example.com/path/did.json')
  })

  it('verifies did:webvh signed JWTs through an injected resolver adapter', async () => {
    const fixture = await createDidWebJwtFixture({
      did: 'did:webvh:QmVerifier:verifier.example.com',
    })

    await expect(
      verifyDidDocumentSignature(fixture.jwt, fixture.kid, fixture.alg, {
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
        expectedClientId: fixture.did,
      })
    ).resolves.toBe(true)
  })

  it('rejects DID verifier requests with mismatched client_id and kid DID', async () => {
    const fixture = await createDidWebJwtFixture({
      clientId: 'did:web:other.example.com',
    })

    await expect(
      verifyDidDocumentSignature(fixture.jwt, fixture.kid, fixture.alg, {
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
      })
    ).rejects.toThrow(/client_id DID does not match JWT kid DID/)
  })

  it('rejects DID Documents without a supported verification method', async () => {
    const fixture = await createDidWebJwtFixture()

    await expect(
      verifyDidDocumentSignature(fixture.jwt, fixture.kid, fixture.alg, {
        didDocumentResolver: async () => ({
          id: fixture.did,
          verificationMethod: [
            {
              id: fixture.kid,
              controller: fixture.did,
              type: 'Multikey',
            },
          ],
        }),
      })
    ).rejects.toThrow(/publicKeyJwk/)
  })

  it('verifies x5c signed JWTs', async () => {
    const fixture = await createX5cJwtFixture()

    await expect(verifyX5cSignature(fixture.jwt, fixture.x5c, fixture.alg)).resolves.toBe(true)
    expect(x5cToPem(fixture.x5c[0])).toContain('BEGIN CERTIFICATE')
  })

  it('throws for invalid x5c inputs', async () => {
    const fixture = await createX5cJwtFixture()

    await expect(verifyX5cSignature(fixture.jwt, [], fixture.alg)).rejects.toThrow(/x5c/)
    expect(() => x5cToPem('')).toThrow(/Invalid x5c/)
  })

  it('exposes a verifyJwt callback for upstream library usage', async () => {
    const fixture = await createDidJwkJwtFixture()
    const result = await verifyJwt(
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
        payload: {},
      }
    )

    expect(result.verified).toBe(true)
  })

  it('supports jwk and x5c signer methods in the verifyJwt callback', async () => {
    const didFixture = await createDidJwkJwtFixture()
    const x5cFixture = await createX5cJwtFixture()

    await expect(
      verifyJwt(
        {
          alg: didFixture.alg,
          method: 'jwk',
          publicJwk: didFixture.jwk,
        },
        {
          compact: didFixture.jwt,
          header: {
            alg: didFixture.alg,
          },
          payload: {},
        }
      )
    ).resolves.toMatchObject({
      verified: true,
    })

    await expect(
      verifyJwt(
        {
          alg: x5cFixture.alg,
          method: 'x5c',
          x5c: x5cFixture.x5c,
        },
        {
          compact: x5cFixture.jwt,
          header: {
            alg: x5cFixture.alg,
          },
          payload: {},
        }
      )
    ).resolves.toMatchObject({
      verified: true,
    })
  })

  it('supports did:web and did:webvh signer methods in injected verifyJwt callbacks', async () => {
    const webFixture = await createDidWebJwtFixture()
    const webvhFixture = await createDidWebJwtFixture({
      did: 'did:webvh:QmVerifier:verifier.example.com',
    })
    const callback = createVerifyJwtCallback({
      didDocumentResolver: async (did) => ({
        id: did,
        verificationMethod: [
          {
            id: `${did}#key-1`,
            controller: did,
            publicKeyJwk: did === webFixture.did ? webFixture.jwk : webvhFixture.jwk,
            type: 'JsonWebKey2020',
          },
        ],
      }),
    })

    await expect(
      callback(
        {
          alg: webFixture.alg,
          didUrl: webFixture.kid,
          method: 'did',
        },
        {
          compact: webFixture.jwt,
          header: {
            alg: webFixture.alg,
          },
          payload: {
            client_id: webFixture.did,
          },
        }
      )
    ).resolves.toMatchObject({
      verified: true,
    })

    await expect(
      callback(
        {
          alg: webvhFixture.alg,
          didUrl: webvhFixture.kid,
          method: 'did',
        },
        {
          compact: webvhFixture.jwt,
          header: {
            alg: webvhFixture.alg,
          },
          payload: {
            client_id: webvhFixture.did,
          },
        }
      )
    ).resolves.toMatchObject({
      verified: true,
    })
  })

  it('returns false for unsupported verifyJwt signer methods', async () => {
    const fixture = await createDidJwkJwtFixture()

    await expect(
      verifyJwt(
        {
          alg: fixture.alg,
          method: 'custom',
        },
        {
          compact: fixture.jwt,
          header: {
            alg: fixture.alg,
          },
          payload: {},
        }
      )
    ).resolves.toEqual({
      verified: false,
    })
  })

  it('hashes using the upstream hash callback shape', async () => {
    const digest = await hash(new Uint8Array([1, 2, 3]), 'sha-256')

    expect(digest).toBeInstanceOf(Uint8Array)
    expect(digest.byteLength).toBe(32)
    await expect(hash(new Uint8Array([1, 2, 3]), 'sha-384')).resolves.toHaveLength(48)
    await expect(hash(new Uint8Array([1, 2, 3]), 'sha-512')).resolves.toHaveLength(64)
  })

  it('returns empty x509 metadata arrays for optional verifier metadata checks', () => {
    expect(getX509CertificateMetadata()).toEqual({
      sanDnsNames: [],
      sanUriNames: [],
    })
  })
})
