import { webcrypto } from 'node:crypto'

import { X509CertificateGenerator } from '@peculiar/x509'
import type { JWK } from 'jose'
import { base64url, exportJWK, generateKeyPair, SignJWT } from 'jose'

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
  })
}

const payload = {
  aud: 'did:example:wallet',
  nonce: 'abcdefghijklmnopqrstuvwxyz',
  response_type: 'vp_token',
}

export async function createDidJwkJwtFixture(): Promise<{
  alg: 'EdDSA'
  did: string
  jwk: JWK
  jwt: string
  kid: string
}> {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA', {
    extractable: true,
  })
  const jwk = await exportJWK(publicKey)
  const encodedJwk = base64url.encode(JSON.stringify(jwk))
  const did = `did:jwk:${encodedJwk}`
  const kid = `${did}#key-1`
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({
      alg: 'EdDSA',
      kid,
    })
    .sign(privateKey)

  return {
    alg: 'EdDSA',
    did,
    jwk,
    jwt,
    kid,
  }
}

export async function createDidWebJwtFixture({
  did = 'did:web:verifier.example.com',
  clientId = did,
  kid = `${did}#key-1`,
}: {
  did?: string
  clientId?: string
  kid?: string
} = {}): Promise<{
  alg: 'ES256'
  did: string
  jwk: JWK
  jwt: string
  kid: string
}> {
  const { privateKey, publicKey } = await generateKeyPair('ES256', {
    extractable: true,
  })
  const jwk = await exportJWK(publicKey)
  const jwt = await new SignJWT({
    ...payload,
    client_id: clientId,
  })
    .setProtectedHeader({
      alg: 'ES256',
      kid,
    })
    .sign(privateKey)

  return {
    alg: 'ES256',
    did,
    jwk,
    jwt,
    kid,
  }
}

export async function createX5cJwtFixture(): Promise<{
  alg: 'ES256'
  jwt: string
  x5c: string[]
}> {
  const algorithm = {
    name: 'ECDSA',
    namedCurve: 'P-256',
  }
  const signingAlgorithm = {
    hash: 'SHA-256',
    name: 'ECDSA',
  }
  const keys = await globalThis.crypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])
  const certificate = await X509CertificateGenerator.createSelfSigned({
    keys,
    name: 'CN=verifier.example',
    notAfter: new Date('2030-01-01T00:00:00.000Z'),
    notBefore: new Date('2026-01-01T00:00:00.000Z'),
    serialNumber: '01',
    signingAlgorithm,
  })
  const x5c = [certificate.toString('base64')]
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({
      alg: 'ES256',
      x5c,
    })
    .sign(keys.privateKey)

  return {
    alg: 'ES256',
    jwt,
    x5c,
  }
}
