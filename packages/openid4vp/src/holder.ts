import {
  resolveOpenid4vpAuthorizationRequest,
  submitOpenid4vpAuthorizationResponse,
} from '@openid4vc/openid4vp'
import type {
  Openid4vpAuthorizationRequest,
  ResolveOpenid4vpAuthorizationRequestOptions,
  ResolvedOpenid4vpAuthorizationRequest,
  SubmitOpenid4vpAuthorizationResponseOptions,
} from '@openid4vc/openid4vp'

import { buildDcqlVpToken, evaluateDcqlQuery, type DcqlQuery, type WalletCredential } from './dcql'
import {
  createVerifyJwtCallback,
  type DidDocumentFetch,
  type DidDocumentResolver,
  getX509CertificateMetadata,
  hash,
} from './crypto'
import type {
  AcceptAuthorizationRequestOptions,
  AcceptAuthorizationRequestResult,
  DcqlQueryResult,
  ResolvedAuthorizationRequest,
} from './types'
import { fetchJwtFromUri, parseInvitationUrl, type FetchFunction } from './utils'

type UpstreamFetch = NonNullable<ResolveOpenid4vpAuthorizationRequestOptions['callbacks']['fetch']>

export interface ResolveAuthorizationRequestOptions {
  request: string
  walletCredentials?: WalletCredential[]
  fetch?: FetchFunction
  didDocumentFetch?: DidDocumentFetch
  didDocumentResolver?: DidDocumentResolver
  expectedOrigin?: string
  expectedUrl?: string
  responseMode?: ResolveOpenid4vpAuthorizationRequestOptions['responseMode']
  dependencies?: HolderDependencies
}

export interface HolderResolvedAuthorizationRequest extends ResolvedAuthorizationRequest {
  dcqlResult?: DcqlQueryResult
  vpFormatsSupported?: unknown
}

export interface HolderDependencies {
  fetchJwtFromUri?: typeof fetchJwtFromUri
  resolveOpenid4vpAuthorizationRequest?: typeof resolveOpenid4vpAuthorizationRequest
  submitOpenid4vpAuthorizationResponse?: typeof submitOpenid4vpAuthorizationResponse
  evaluateDcqlQuery?: typeof evaluateDcqlQuery
  buildDcqlVpToken?: typeof buildDcqlVpToken
}

export async function resolveAuthorizationRequest({
  request,
  walletCredentials = [],
  fetch,
  didDocumentFetch,
  didDocumentResolver,
  expectedOrigin = 'openid4vp://wallet',
  expectedUrl = 'openid4vp://wallet',
  responseMode,
  dependencies = {},
}: ResolveAuthorizationRequestOptions): Promise<HolderResolvedAuthorizationRequest> {
  const authorizationRequestPayload = await authorizationRequestPayloadFromRequest(
    request,
    dependencies.fetchJwtFromUri ?? fetchJwtFromUri,
    fetch
  )
  const callbackFetch = fetch as unknown as UpstreamFetch | undefined
  const resolved = await (dependencies.resolveOpenid4vpAuthorizationRequest ??
    resolveOpenid4vpAuthorizationRequest)({
    authorizationRequestPayload,
    callbacks: {
      fetch: callbackFetch,
      getX509CertificateMetadata,
      hash,
      verifyJwt: createVerifyJwtCallback({
        didDocumentResolver,
        fetch: didDocumentFetch,
        expectedClientId:
          typeof authorizationRequestPayload.client_id === 'string' ? authorizationRequestPayload.client_id : undefined,
      }),
      decryptJwe: unsupportedDecryptJwe,
    },
    responseMode:
      responseMode ??
      inferExpectedResponseMode(authorizationRequestPayload as Openid4vpAuthorizationRequest, expectedOrigin, expectedUrl),
  })

  validateAuthorizationRequestPayload(resolved.authorizationRequestPayload)

  const resolvedAuthorizationRequestPayload = resolved.authorizationRequestPayload as Record<string, unknown>
  const dcqlQuery = resolved.dcql?.query ?? resolvedAuthorizationRequestPayload.dcql_query ?? authorizationRequestPayload.dcql_query
  const dcqlResult =
    dcqlQuery && walletCredentials.length > 0
      ? (dependencies.evaluateDcqlQuery ?? evaluateDcqlQuery)(dcqlQuery as DcqlQuery, walletCredentials)
      : undefined

  return {
    ...resolved,
    dcql: resolved.dcql || dcqlQuery
      ? {
          ...resolved.dcql,
          query: dcqlQuery,
          queryResult: dcqlResult,
        }
      : undefined,
    dcqlResult,
    vpFormatsSupported: resolved.authorizationRequestPayload.client_metadata?.vp_formats_supported,
  }
}

export async function acceptAuthorizationRequest(
  options: AcceptAuthorizationRequestOptions & {
    dependencies?: HolderDependencies
  }
): Promise<AcceptAuthorizationRequestResult> {
  const buildVpToken = options.dependencies?.buildDcqlVpToken ?? buildDcqlVpToken
  const submit = options.dependencies?.submitOpenid4vpAuthorizationResponse ?? submitOpenid4vpAuthorizationResponse
  const authorizationResponsePayload =
    options.authorizationResponsePayload ??
    ({
      vp_token: buildVpToken(options.selectedCredentials ?? {}),
    } as SubmitOpenid4vpAuthorizationResponseOptions['authorizationResponsePayload'])
  const result = await submit({
    authorizationRequestPayload:
      options.authorizationRequestPayload as SubmitOpenid4vpAuthorizationResponseOptions['authorizationRequestPayload'],
    authorizationResponsePayload,
    callbacks: options.callbacks ?? {
      fetch: undefined,
    },
  })
  const serverResponse = await readServerResponse(result.response)

  return {
    ok: result.response.ok,
    responseMode: result.responseMode,
    serverResponse,
  }
}

export function validateAuthorizationRequestPayload(
  payload: ResolvedOpenid4vpAuthorizationRequest['authorizationRequestPayload']
): void {
  if (payload.response_type !== 'vp_token') {
    throw new Error('OpenID4VP authorization request must use response_type vp_token')
  }

  if ('transaction_data' in payload && payload.transaction_data && payload.transaction_data.length > 0) {
    throw oauthInvalidRequest('transaction_data is not supported by this wallet')
  }

  if (!payload.nonce || !isUrlSafeAsciiNonce(payload.nonce)) {
    throw oauthInvalidRequest('nonce must be at least 128 bits and URL-safe ASCII')
  }

  if ('state' in payload && !payload.state) {
    throw oauthInvalidRequest('state is required')
  }

  if ('client_id' in payload && !payload.client_id) {
    throw oauthInvalidRequest('client_id is required')
  }

  if (
    'response_mode' in payload &&
    payload.response_mode === 'direct_post' &&
    !payload.response_uri
  ) {
    throw oauthInvalidRequest('response_uri is required for direct_post')
  }
}

async function authorizationRequestPayloadFromRequest(
  request: string,
  fetchRequestJwt: typeof fetchJwtFromUri,
  fetch?: FetchFunction
): Promise<Record<string, unknown>> {
  const trimmedRequest = request.trim()

  if (trimmedRequest.startsWith('openid://') || trimmedRequest.startsWith('openid4vp://')) {
    const { clientId, requestUri } = parseInvitationUrl(trimmedRequest)
    const jwt = await fetchRequestJwt(requestUri, { fetch })

    return {
      client_id: clientId,
      request: jwt,
    }
  }

  return {
    request: trimmedRequest,
  }
}

function inferExpectedResponseMode(
  payload: Openid4vpAuthorizationRequest,
  expectedOrigin: string,
  expectedUrl: string
): ResolveOpenid4vpAuthorizationRequestOptions['responseMode'] {
  const responseMode = String(payload.response_mode ?? '')

  if (responseMode === 'dc_api' || responseMode === 'dc_api.jwt') {
    return {
      expectedOrigin,
      type: 'dc_api',
    }
  }

  if (responseMode === 'iae_post' || responseMode === 'iae_post.jwt') {
    return {
      expectedUrl,
      type: 'iae',
    }
  }

  return {
    type: 'direct_post',
  }
}

function isUrlSafeAsciiNonce(nonce: string): boolean {
  return nonce.length >= 16 && /^[A-Za-z0-9_-]+$/.test(nonce)
}

function oauthInvalidRequest(errorDescription: string): Error & {
  error: 'invalid_request'
  error_description: string
} {
  return Object.assign(new Error(errorDescription), {
    error: 'invalid_request' as const,
    error_description: errorDescription,
  })
}

async function unsupportedDecryptJwe(): Promise<never> {
  throw new Error('JWE decryption is not configured')
}

async function readServerResponse(response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text) {
    return undefined
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
