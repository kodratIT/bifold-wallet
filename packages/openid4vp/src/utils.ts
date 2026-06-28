export const DEFAULT_FETCH_TIMEOUT_MS = 10_000

export interface ParsedInvitationUrl {
  clientId: string
  requestUri: string
}

export type FormBody = URLSearchParams | Record<string, string | number | boolean | null | undefined>

export type FetchResponse = {
  ok: boolean
  status: number
  statusText?: string
  text: () => Promise<string>
}

export type FetchInit = {
  method?: string
  headers?: Record<string, string>
  body?: string | URLSearchParams
  signal?: unknown
}

export type FetchFunction = (url: string, init?: FetchInit) => Promise<FetchResponse>

export interface FetchJwtFromUriOptions {
  fetch?: FetchFunction
  headers?: Record<string, string>
  timeoutMs?: number
}

export interface PostFormOptions {
  fetch?: FetchFunction
  headers?: Record<string, string>
  timeoutMs?: number
}

type AbortControllerLike = {
  abort: () => void
  signal: unknown
}

export function parseInvitationUrl(invitationUrl: string): ParsedInvitationUrl {
  const url = parseUrl(invitationUrl, 'Invalid OpenID4VP invitation URL')
  const clientId = url.searchParams.get('client_id')
  const requestUri = url.searchParams.get('request_uri')

  if (!clientId) {
    throw new Error('OpenID4VP invitation URL is missing client_id')
  }

  if (!requestUri) {
    throw new Error('OpenID4VP invitation URL is missing request_uri')
  }

  return {
    clientId,
    requestUri,
  }
}

export function extractHostname(url: string): string {
  return parseUrl(url, 'Invalid URL').hostname
}

export async function fetchJwtFromUri(
  uri: string,
  options: FetchJwtFromUriOptions = {}
): Promise<string> {
  const fetchImpl = getFetchImplementation(options.fetch)
  const { controller, clearTimeout: clearFetchTimeout } = createAbortController(
    options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  )

  try {
    const response = await fetchImpl(uri, {
      method: 'GET',
      headers: options.headers,
      signal: controller?.signal,
    })

    assertOkResponse(response, `Failed to fetch OpenID4VP request JWT from ${uri}`)

    const jwt = (await response.text()).trim()
    if (!jwt) {
      throw new Error(`OpenID4VP request URI returned an empty JWT: ${uri}`)
    }

    return jwt
  } finally {
    clearFetchTimeout()
  }
}

export async function postForm(
  url: string,
  body: FormBody,
  options: PostFormOptions = {}
): Promise<FetchResponse> {
  const fetchImpl = getFetchImplementation(options.fetch)
  const formBody = toUrlSearchParams(body)
  const { controller, clearTimeout: clearFetchTimeout } = createAbortController(
    options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  )

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        ...options.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
      signal: controller?.signal,
    })

    assertOkResponse(response, `Failed to post OpenID4VP form response to ${url}`)
    return response
  } finally {
    clearFetchTimeout()
  }
}

function parseUrl(url: string, message: string): URL {
  try {
    const trimmedUrl = url.trim()
    const normalizedUrl = trimmedUrl.includes('://?')
      ? trimmedUrl.replace('://?', '://wallet?')
      : trimmedUrl

    return new URL(normalizedUrl)
  } catch {
    throw new Error(message)
  }
}

function toUrlSearchParams(body: FormBody): URLSearchParams {
  if (body instanceof URLSearchParams) {
    return body
  }

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value))
    }
  }

  return params
}

function getFetchImplementation(fetchImpl?: FetchFunction): FetchFunction {
  const resolvedFetch = fetchImpl ?? (globalThis as { fetch?: FetchFunction }).fetch

  if (!resolvedFetch) {
    throw new Error('A fetch implementation is required')
  }

  return resolvedFetch
}

function createAbortController(timeoutMs: number): {
  clearTimeout: () => void
  controller?: AbortControllerLike
} {
  const AbortControllerConstructor = (
    globalThis as { AbortController?: new () => AbortControllerLike }
  ).AbortController

  if (!AbortControllerConstructor) {
    return {
      clearTimeout: () => undefined,
    }
  }

  const controller = new AbortControllerConstructor()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  return {
    clearTimeout: () => clearTimeout(timeoutId),
    controller,
  }
}

function assertOkResponse(response: FetchResponse, message: string): void {
  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : ''
    throw new Error(`${message}: ${response.status}${statusText}`)
  }
}
