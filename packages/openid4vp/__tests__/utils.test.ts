import {
  DEFAULT_FETCH_TIMEOUT_MS,
  extractHostname,
  fetchJwtFromUri,
  parseInvitationUrl,
  postForm,
} from '../src'

describe('OpenID4VP utility helpers', () => {
  describe('parseInvitationUrl', () => {
    it('extracts client_id and request_uri from openid invitations', () => {
      const invitation = [
        'openid://?',
        'client_id=did%3Aexample%3Averifier',
        '&request_uri=https%3A%2F%2Fverifier.example%2Frequest.jwt',
      ].join('')

      expect(parseInvitationUrl(invitation)).toEqual({
        clientId: 'did:example:verifier',
        requestUri: 'https://verifier.example/request.jwt',
      })
    })

    it('rejects invitations missing required parameters', () => {
      expect(() => parseInvitationUrl('openid://?client_id=did:example:verifier')).toThrow(
        /request_uri/
      )
      expect(() => parseInvitationUrl('openid://?request_uri=https://verifier.example/request.jwt')).toThrow(
        /client_id/
      )
      expect(() => parseInvitationUrl('not a url')).toThrow(/Invalid/)
    })
  })

  describe('extractHostname', () => {
    it('returns the URL hostname', () => {
      expect(extractHostname('https://verifier.example/path?request=1')).toBe('verifier.example')
    })
  })

  describe('fetchJwtFromUri', () => {
    it('fetches and returns the raw JWT string', async () => {
      const jwt = 'header.payload.signature'
      const response = {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: jest.fn().mockResolvedValue(jwt),
      } as unknown as Response
      const fetchMock = jest.fn().mockResolvedValue(response)

      await expect(fetchJwtFromUri('https://verifier.example/request.jwt', { fetch: fetchMock })).resolves.toBe(jwt)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://verifier.example/request.jwt',
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(Object),
        })
      )
    })

    it('uses a ten second default timeout', async () => {
      const response = {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: jest.fn().mockResolvedValue('header.payload.signature'),
      } as unknown as Response
      const fetchMock = jest.fn().mockResolvedValue(response)

      await fetchJwtFromUri('https://verifier.example/request.jwt', { fetch: fetchMock })

      expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(10_000)
    })

    it('throws for non-2xx responses', async () => {
      const response = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn(),
      } as unknown as Response
      const fetchMock = jest.fn().mockResolvedValue(response)

      await expect(fetchJwtFromUri('https://verifier.example/missing.jwt', { fetch: fetchMock })).rejects.toThrow(
        /404/
      )
    })

    it('throws for empty JWT responses and missing fetch implementations', async () => {
      const response = {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: jest.fn().mockResolvedValue('  '),
      } as unknown as Response
      const fetchMock = jest.fn().mockResolvedValue(response)
      const originalFetch = globalThis.fetch

      await expect(fetchJwtFromUri('https://verifier.example/empty.jwt', { fetch: fetchMock })).rejects.toThrow(
        /empty JWT/
      )

      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: undefined,
      })
      await expect(fetchJwtFromUri('https://verifier.example/request.jwt')).rejects.toThrow(/fetch/)
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: originalFetch,
      })
    })
  })

  describe('postForm', () => {
    it('sends application/x-www-form-urlencoded POST bodies', async () => {
      const response = {
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response
      const fetchMock = jest.fn().mockResolvedValue(response)

      await expect(
        postForm(
          'https://verifier.example/response',
          {
            state: 'abc',
            vp_token: 'header.payload.signature',
            skipped: undefined,
          },
          { fetch: fetchMock }
        )
      ).resolves.toBe(response)

      const [, requestInit] = fetchMock.mock.calls[0]
      expect(requestInit).toMatchObject({
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      expect(requestInit.body.toString()).toBe('state=abc&vp_token=header.payload.signature')
    })

    it('accepts URLSearchParams bodies', async () => {
      const response = {
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response
      const fetchMock = jest.fn().mockResolvedValue(response)
      const body = new URLSearchParams({
        state: 'abc',
      })

      await postForm('https://verifier.example/response', body, { fetch: fetchMock })

      expect(fetchMock.mock.calls[0][1].body).toBe(body)
    })
  })
})
