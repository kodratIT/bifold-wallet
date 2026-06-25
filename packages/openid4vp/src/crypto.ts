import type {
  HashAlgorithm,
  HashCallback,
  Jwk,
  JwtSigner,
  VerifyJwtCallback,
} from '@openid4vc/oauth2'
import { ed25519 } from '@noble/curves/ed25519.js'
import { base64url, decodeJwt, importJWK, importX509, jwtVerify } from 'jose'

const SUPPORTED_ALGORITHMS = ['EdDSA', 'ES256'] as const

type SupportedAlgorithm = (typeof SUPPORTED_ALGORITHMS)[number]

type FetchResponse = {
  ok: boolean
  status?: number
  json: () => Promise<unknown>
}

export type DidDocumentFetch = (url: string) => Promise<FetchResponse>

export type DidDocumentResolver = (
  did: string,
  options?: {
    fetch?: DidDocumentFetch
  }
) => Promise<DidDocument>

export type DidDocumentVerificationMethod = {
  id: string
  controller?: string
  publicKeyJwk?: Jwk
  type?: string
}

export type DidDocument = {
  id: string
  verificationMethod?: DidDocumentVerificationMethod[]
}

export interface DidDocumentVerificationOptions {
  didDocumentResolver?: DidDocumentResolver
  expectedClientId?: string
  fetch?: DidDocumentFetch
}

export interface VerifyJwtCallbackOptions extends DidDocumentVerificationOptions {
  clockSkewInSeconds?: number
}

export async function verifyDidJwkSignature(
  jwt: string,
  kid: string,
  alg: string
): Promise<true> {
  assertSupportedAlgorithm(alg)

  const jwk = jwkFromDidJwk(kid)

  if (alg === 'EdDSA' && jwk.kty === 'OKP' && jwk.crv === 'Ed25519') {
    verifyEd25519CompactJwt(jwt, jwk)
    return true
  }

  const publicKey = await importJWK(jwk, alg)
  await jwtVerify(jwt, publicKey, { algorithms: [alg] })

  return true
}

function verifyEd25519CompactJwt(jwt: string, jwk: Jwk): void {
  const [encodedHeader, encodedPayload, encodedSignature] = jwt.split('.')

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('Invalid compact JWT format')
  }

  if (typeof jwk.x !== 'string') {
    throw new Error('Ed25519 did:jwk public key must contain x coordinate')
  }

  const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  const signature = base64url.decode(encodedSignature)
  const publicKey = base64url.decode(jwk.x)

  if (!ed25519.verify(signature, signingInput, publicKey)) {
    throw new Error('Invalid Ed25519 JWT signature')
  }
}

export async function verifyDidDocumentSignature(
  jwt: string,
  kid: string,
  alg: string,
  options: DidDocumentVerificationOptions = {}
): Promise<true> {
  await verifyDidDocumentSignatureAndReturnJwk(jwt, kid, alg, options)

  return true
}

async function verifyDidDocumentSignatureAndReturnJwk(
  jwt: string,
  kid: string,
  alg: string,
  options: DidDocumentVerificationOptions = {}
): Promise<Jwk> {
  assertSupportedAlgorithm(alg)

  const did = didFromDidUrl(kid)
  assertClientIdMatchesKidDid(jwt, did, options.expectedClientId)

  const didDocument = await resolveDidDocument(did, options)
  const verificationMethod = findVerificationMethod(didDocument, kid)

  if (!verificationMethod.publicKeyJwk) {
    throw new Error(`DID verification method ${kid} does not contain publicKeyJwk`)
  }

  const publicKey = await importJWK(verificationMethod.publicKeyJwk, alg)
  await jwtVerify(jwt, publicKey, { algorithms: [alg] })

  return verificationMethod.publicKeyJwk
}

export async function verifyX5cSignature(
  jwt: string,
  x5c: string[],
  alg: string
): Promise<true> {
  assertSupportedAlgorithm(alg)

  if (x5c.length === 0) {
    throw new Error('x5c certificate chain is required')
  }

  const publicKey = await importX509(x5cToPem(x5c[0]), alg)
  await jwtVerify(jwt, publicKey, { algorithms: [alg] })

  return true
}

export function jwkFromDidJwk(kidOrDid: string): Jwk {
  const did = kidOrDid.split('#')[0]

  if (!did.startsWith('did:jwk:')) {
    throw new Error('kid must reference a did:jwk identifier')
  }

  const encodedJwk = did.slice('did:jwk:'.length)

  if (!encodedJwk || encodedJwk.startsWith('z')) {
    throw new Error('Only base64url-encoded did:jwk identifiers are supported')
  }

  try {
    const bytes = base64url.decode(encodedJwk)
    const json = String.fromCharCode(...bytes)
    return JSON.parse(json) as Jwk
  } catch {
    throw new Error('Unable to decode did:jwk public key')
  }
}

export function didWebToDidDocumentUrl(did: string): string {
  if (!did.startsWith('did:web:')) {
    throw new Error('DID Web identifier must start with did:web:')
  }

  const methodSpecificId = did.slice('did:web:'.length)
  if (!methodSpecificId) {
    throw new Error('DID Web identifier is missing a domain')
  }

  const parts = methodSpecificId.split(':').map((part) => decodeURIComponent(part))
  const [domain, ...path] = parts

  if (!domain) {
    throw new Error('DID Web identifier is missing a domain')
  }

  if (path.length === 0) {
    return `https://${domain}/.well-known/did.json`
  }

  return `https://${domain}/${path.join('/')}/did.json`
}

export function x5cToPem(certificate: string): string {
  const body = certificate
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '')
    .match(/.{1,64}/g)
    ?.join('\n')

  if (!body) {
    throw new Error('Invalid x5c certificate')
  }

  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`
}

export const hash: HashCallback = async (data, alg) => {
  const subtle = globalThis.crypto?.subtle

  if (!subtle) {
    throw new Error('WebCrypto subtle digest is required for OpenID4VP hashing')
  }

  const digestInput = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  const digest = await subtle.digest(hashAlgorithmToWebCrypto(alg), digestInput)
  return new Uint8Array(digest)
}

export const getX509CertificateMetadata = (): {
  sanDnsNames: string[]
  sanUriNames: string[]
} => ({
  sanDnsNames: [],
  sanUriNames: [],
})

export const createVerifyJwtCallback =
  (options: VerifyJwtCallbackOptions = {}): VerifyJwtCallback =>
  async (jwtSigner, jwt) => {
    try {
      const expectedClientId =
        options.expectedClientId ?? (typeof jwt.payload.client_id === 'string' ? jwt.payload.client_id : undefined)
      const signerJwk = await verifyJwtSigner(jwtSigner, jwt.compact, {
        ...options,
        expectedClientId,
      })
      applyClockSkewTolerance(jwt.payload, options.clockSkewInSeconds ?? 300)

      return {
        verified: true,
        signerJwk,
      }
    } catch (error) {
      console.error('[openid4vp] JWT verification failed', {
        message: error instanceof Error ? error.message : String(error),
        signer: jwtSigner,
        alg: 'alg' in jwtSigner ? jwtSigner.alg : undefined,
        clientId: typeof jwt.payload.client_id === 'string' ? jwt.payload.client_id : undefined,
        hasCrypto: typeof globalThis.crypto !== 'undefined',
        hasSubtle: typeof globalThis.crypto?.subtle !== 'undefined',
      })

      return {
        verified: false,
      }
    }
  }

export const verifyJwt: VerifyJwtCallback = createVerifyJwtCallback()

function applyClockSkewTolerance(payload: Record<string, unknown>, clockSkewInSeconds: number): void {
  const nowInSeconds = Math.floor(Date.now() / 1000)

  if (typeof payload.nbf === 'number' && nowInSeconds < payload.nbf && payload.nbf - nowInSeconds <= clockSkewInSeconds) {
    payload.nbf = nowInSeconds
  }

  if (typeof payload.exp === 'number' && nowInSeconds > payload.exp && nowInSeconds - payload.exp <= clockSkewInSeconds) {
    payload.exp = nowInSeconds
  }
}

async function verifyJwtSigner(
  jwtSigner: JwtSigner,
  jwt: string,
  options: DidDocumentVerificationOptions = {}
): Promise<Jwk> {
  if (jwtSigner.method === 'did') {
    const did = didFromDidUrl(jwtSigner.didUrl)

    if (did.startsWith('did:jwk:')) {
      await verifyDidJwkSignature(jwt, jwtSigner.didUrl, jwtSigner.alg)
      return jwkFromDidJwk(jwtSigner.didUrl)
    }

    if (did.startsWith('did:web:') || did.startsWith('did:webvh:')) {
      return verifyDidDocumentSignatureAndReturnJwk(jwt, jwtSigner.didUrl, jwtSigner.alg, options)
    }

    throw new Error(`Unsupported DID method for JWT signer: ${did}`)
  }

  if (jwtSigner.method === 'jwk' && 'publicJwk' in jwtSigner) {
    assertSupportedAlgorithm(jwtSigner.alg)
    const publicKey = await importJWK(jwtSigner.publicJwk, jwtSigner.alg)
    await jwtVerify(jwt, publicKey, { algorithms: [jwtSigner.alg] })
    return jwtSigner.publicJwk
  }

  if (jwtSigner.method === 'x5c') {
    await verifyX5cSignature(jwt, jwtSigner.x5c, jwtSigner.alg)
    return {
      kty: 'EC',
    }
  }

  throw new Error(`Unsupported JWT signer method: ${jwtSigner.method}`)
}

async function resolveDidDocument(
  did: string,
  options: DidDocumentVerificationOptions
): Promise<DidDocument> {
  const resolver = options.didDocumentResolver ?? defaultDidDocumentResolver
  const didDocument = await resolver(did, {
    fetch: options.fetch,
  })

  if (didDocument.id !== did) {
    throw new Error(`Resolved DID Document id ${didDocument.id} does not match ${did}`)
  }

  return didDocument
}

const defaultDidDocumentResolver: DidDocumentResolver = async (did, options) => {
  if (!did.startsWith('did:web:')) {
    throw new Error(`No DID Document resolver configured for ${did}`)
  }

  const fetchDidDocument = options?.fetch ?? defaultFetch
  const url = didWebToDidDocumentUrl(did)
  const response = await fetchDidDocument(url)

  if (!response.ok) {
    throw new Error(`Unable to resolve DID Web document ${url}: HTTP ${response.status ?? 'error'}`)
  }

  return response.json() as Promise<DidDocument>
}

async function defaultFetch(url: string): Promise<FetchResponse> {
  if (!globalThis.fetch) {
    throw new Error('fetch is required to resolve did:web documents')
  }

  return globalThis.fetch(url) as Promise<FetchResponse>
}

function findVerificationMethod(didDocument: DidDocument, kid: string): DidDocumentVerificationMethod {
  const did = didDocument.id
  const kidFragment = kid.includes('#') ? `#${kid.split('#')[1]}` : undefined
  const verificationMethod = didDocument.verificationMethod?.find((method) => {
    const methodId = method.id.startsWith('#') ? `${did}${method.id}` : method.id
    return methodId === kid || (kidFragment !== undefined && method.id === kidFragment)
  })

  if (!verificationMethod) {
    throw new Error(`DID Document does not contain verification method ${kid}`)
  }

  return verificationMethod
}

function didFromDidUrl(didUrl: string): string {
  if (!didUrl.startsWith('did:')) {
    throw new Error('DID URL must start with did:')
  }

  return didUrl.split('#')[0]
}

function assertClientIdMatchesKidDid(jwt: string, kidDid: string, expectedClientId?: string): void {
  const payload = decodeJwt(jwt)
  const payloadClientId = typeof payload.client_id === 'string' ? payload.client_id : undefined
  const clientId = expectedClientId ?? payloadClientId

  if (!clientId?.startsWith('did:')) {
    return
  }

  const clientDid = didFromDidUrl(clientId)
  if (clientDid !== kidDid) {
    throw new Error('client_id DID does not match JWT kid DID')
  }
}

function assertSupportedAlgorithm(alg: string): asserts alg is SupportedAlgorithm {
  if (!SUPPORTED_ALGORITHMS.includes(alg as SupportedAlgorithm)) {
    throw new Error(`Unsupported JWT signature algorithm: ${alg}`)
  }
}

function hashAlgorithmToWebCrypto(alg: HashAlgorithm): string {
  switch (alg) {
    case 'sha-256':
      return 'SHA-256'
    case 'sha-384':
      return 'SHA-384'
    case 'sha-512':
      return 'SHA-512'
    default:
      throw new Error(`Unsupported hash algorithm: ${alg}`)
  }
}
