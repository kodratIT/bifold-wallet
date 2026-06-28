import type {
  ClientIdPrefix,
  Openid4vpAuthorizationRequest,
  Openid4vpAuthorizationRequestDcApi,
  Openid4vpAuthorizationRequestIae,
  Openid4vpAuthorizationResponse,
  ResolvedOpenid4vpAuthorizationRequest,
  SubmitOpenid4vpAuthorizationResponseOptions,
  ValidateOpenid4VpDcqlAuthorizationResponseResult,
} from '@openid4vc/openid4vp'

export type ClientIdScheme = Extract<ClientIdPrefix, 'did' | 'x509_san_dns' | 'decentralized_identifier'>

export type AuthRequestPayload =
  | Openid4vpAuthorizationRequest
  | Openid4vpAuthorizationRequestDcApi
  | Openid4vpAuthorizationRequestIae

export interface PresentationExchangeResult {
  credentialsForRequest?: unknown
  [key: string]: unknown
}

export interface ResolvedAuthorizationRequest
  extends Omit<ResolvedOpenid4vpAuthorizationRequest, 'dcql' | 'pex'> {
  dcql?: {
    query?: unknown
    queryResult?: DcqlQueryResult
    [key: string]: unknown
  }
  origin?: string
  pex?: ResolvedOpenid4vpAuthorizationRequest['pex']
  presentationExchange?: PresentationExchangeResult
}

export interface AcceptAuthorizationRequestOptions {
  authorizationRequestPayload:
    | SubmitOpenid4vpAuthorizationResponseOptions['authorizationRequestPayload']
    | AuthRequestPayload
    | Record<string, unknown>
  authorizationResponsePayload?: Openid4vpAuthorizationResponse
  callbacks?: SubmitOpenid4vpAuthorizationResponseOptions['callbacks']
  selectedCredentials?: SelectedDcqlCredentials
  dcql?: DcqlQueryResult
}

export interface AcceptAuthorizationRequestResult {
  ok: boolean
  responseMode?: string
  serverResponse?: unknown
}

export type UpstreamDcqlQueryResult = ValidateOpenid4VpDcqlAuthorizationResponseResult['dcql']

export type DcqlPresentation = string | Record<string, unknown>

export type SelectedDcqlCredentials = Record<string, DcqlPresentation[]>

export interface DcqlCredentialMatch {
  credential: unknown
  presentation: DcqlPresentation
}

export interface DcqlCredentialSetResult {
  required: boolean
  satisfied?: boolean
  options: string[][]
  matching_options?: string[][]
  purpose?: unknown
}

export interface DcqlCredentialQuery {
  id: string
  format: string
  claims?: Array<{
    claim_name?: string
    namespace?: string
    path?: Array<string | number | null>
  }>
  meta?: {
    doctype_value?: string
    vct_values?: string[]
    [key: string]: unknown
  }
}

export interface DcqlCredentialMatchResult {
  success?: boolean
  valid_credentials?: Iterable<unknown>
}

export interface DcqlQueryResult {
  can_be_satisfied: boolean
  credential_matches: Record<string, DcqlCredentialMatchResult>
  credentials: DcqlCredentialQuery[]
  matches: Record<string, DcqlCredentialMatch[]>
  credential_sets?: DcqlCredentialSetResult[]
  presentations?: UpstreamDcqlQueryResult['presentations']
  query?: UpstreamDcqlQueryResult['query']
}
