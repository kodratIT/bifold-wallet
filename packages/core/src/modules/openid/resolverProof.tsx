/Users/kodrat/Public/SSI/bifold-wallet/packages/openid4vp/Users/kodrat/Public/SSI/bifold-wallet/packages/openid4vpimport {
  Agent,
  ClaimFormat,
  CredentialMultiInstanceUseMode,
  Hasher,
  type DifPexCredentialsForRequest,
  type DifPexInputDescriptorToCredentials,
  type DcqlCredentialsForRequest,
  type DcqlValidCredential,
  type JsonObject,
  Mdoc,
  type MdocNameSpaces,
  type SubmissionEntryCredential,
} from '@credo-ts/core'
import {
  OpenId4VpResolvedAuthorizationRequest,
} from '@credo-ts/openid4vc'
import { PEX, type IPresentationDefinition } from '@animo-id/pex'
import { decodeSdJwtSync, getClaimsSync } from '@sd-jwt/decode'
import {
  acceptAuthorizationRequest,
  resolveAuthorizationRequest,
  type AcceptAuthorizationRequestResult,
  type DidDocument,
  type SelectedDcqlCredentials,
  type DcqlQueryResult as BifoldDcqlQueryResult,
} from '@bifold/openid4vp'
import { ParseInvitationResult } from '../../utils/parsers'
import { OpenId4VPRequestRecord } from './types'
import { getHostNameFromUrl } from './utils/utils'
import { Linking } from 'react-native'
import { BifoldAgent } from '../../utils/agent'
import { mapSelectedToPexCredentials, mapSelectedToDcqlCredentials } from './utils/credoMapping'

type SelectedProofCredentials = Record<
  string,
  {
    id: string
    claimFormat: string
  }
>

type JsonSerializableDidDocument = {
  toJSON: () => DidDocument
}

type CredentialRecord = Record<string, unknown>

type PexCredentialCandidate = {
  credentialRecord: CredentialRecord
  disclosedPayload: JsonObject
  pexCredential: unknown
}

type PexSubmissionEntry = DifPexCredentialsForRequest['requirements'][number]['submissionEntry'][number]

type PexInputDescriptor = {
  id?: unknown
  name?: unknown
  purpose?: unknown
  format?: Record<string, unknown>
  constraints?: {
    fields?: Array<{
      path?: string[]
      filter?: {
        type?: string
        pattern?: string
        const?: unknown
        enum?: unknown[]
      }
    }>
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const getCredentialPayload = (credential: unknown): JsonObject => {
  const credentialRecord = asRecord(credential)
  const recordType = String(credentialRecord.type ?? '')

  // SdJwtVcRecord: decode compact SD-JWT to get disclosed claims
  if (recordType === 'SdJwtVcRecord') {
    const firstCredential = asRecord(credentialRecord.firstCredential)
    const compact = String(firstCredential.compact ?? '')
    if (compact) {
      try {
        const { disclosures, jwt } = decodeSdJwtSync(compact, (data, alg) => Hasher.hash(data, alg))
        const decodedPayload: Record<string, unknown> = getClaimsSync(jwt.payload, disclosures, (data, alg) =>
          Hasher.hash(data, alg)
        )
        return decodedPayload as JsonObject
      } catch {
        // fall through to generic extraction on decode failure
      }
    }
  }

  // MdocRecord: decode mdoc to get issuer-namespaced claims
  if (recordType === 'MdocRecord') {
    const firstCredential = asRecord(credentialRecord.firstCredential)
    const base64Url = String(firstCredential.base64Url ?? firstCredential.credential ?? '')
    if (base64Url) {
      try {
        const mdocInstance = Mdoc.fromBase64Url(base64Url)
        return Object.fromEntries(
          Object.entries(mdocInstance.issuerSignedNamespaces).flatMap(([namespace, claims]) =>
            Object.entries(claims).map(([key, value]) => [`${namespace}.${key}`, value])
          )
        ) as JsonObject
      } catch {
        // fall through to generic extraction on decode failure
      }
    }
  }

  // W3cCredentialRecord / W3cV2CredentialRecord: extract jsonCredential or credential object
  const firstCredential = asRecord(credentialRecord.firstCredential)
  const firstCredentialJsonCredential = asRecord(firstCredential.jsonCredential)
  if (Object.keys(firstCredentialJsonCredential).length > 0) {
    return firstCredentialJsonCredential as JsonObject
  }

  const firstCredentialCredential = asRecord(firstCredential.credential)
  if (Object.keys(firstCredentialCredential).length > 0) {
    return firstCredentialCredential as JsonObject
  }

  const credentialPayload = asRecord(credentialRecord.credential)
  if (Object.keys(credentialPayload).length > 0) {
    return credentialPayload as JsonObject
  }

  return credentialRecord as JsonObject
}

const getClaimFormat = (credential: CredentialRecord): ClaimFormat => {
  switch (credential.type) {
    case 'MdocRecord':
      return ClaimFormat.MsoMdoc
    case 'SdJwtVcRecord':
      return ClaimFormat.SdJwtDc
    case 'W3cCredentialRecord':
    case 'W3cV2CredentialRecord':
      return asRecord(credential.firstCredential).claimFormat as ClaimFormat
    default:
      return (credential.claimFormat ?? credential.format ?? ClaimFormat.JwtVc) as ClaimFormat
  }
}

const getInputDescriptors = (presentationDefinition: IPresentationDefinition): PexInputDescriptor[] => {
  const inputDescriptors = (presentationDefinition as { input_descriptors?: unknown }).input_descriptors

  return Array.isArray(inputDescriptors) ? (inputDescriptors as PexInputDescriptor[]) : []
}

const getRequestedFieldPaths = (inputDescriptor: PexInputDescriptor): string[] =>
  inputDescriptor.constraints?.fields?.flatMap((field) => field.path ?? []) ?? []

const pexPathToSegments = (path: string): Array<string | number> =>
  path
    .replace(/^\$\.?/, '')
    .replace(/\[['"]?([^'"\]]+)['"]?\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment))

const getValueAtPath = (value: unknown, segments: Array<string | number>): unknown =>
  segments.reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return (current as Record<string | number, unknown>)[segment]
    }

    return undefined
  }, value)

const fieldValueMatchesFilter = (
  value: unknown,
  filter: NonNullable<NonNullable<PexInputDescriptor['constraints']>['fields']>[number]['filter']
): boolean => {
  if (!filter) {
    return true
  }

  const filterType = filter.type
  // If the value is not the expected type, it can't match
  if (filterType === 'string' && typeof value !== 'string') {
    return false
  }
  if (filterType === 'number' && typeof value !== 'number') {
    return false
  }

  // Const check (exact value match)
  if (filter.const !== undefined) {
    return value === filter.const
  }

  // Enum check (value must be in the list)
  if (filter.enum) {
    return filter.enum.some((e) => e === value)
  }

  // Pattern check (regex match for strings)
  if (filter.pattern && typeof value === 'string') {
    try {
      return new RegExp(filter.pattern).test(value)
    } catch {
      return false
    }
  }

  return true
}

const doesFormatMatch = (desiredFormat: string, recordFormat: string): boolean => {
  // Map PEX format identifiers to record types and claim formats
  const formatMap: Record<string, string[]> = {
    jwt_vc_json: ['W3cCredentialRecord', ClaimFormat.JwtVc],
    jwt_vc: ['W3cCredentialRecord', ClaimFormat.JwtVc],
    ldp_vc: ['W3cCredentialRecord', ClaimFormat.LdpVc],
    'vc+sd-jwt': ['SdJwtVcRecord', ClaimFormat.SdJwtDc, 'SdJwtW3cVc'],
    mso_mdoc: ['MdocRecord', ClaimFormat.MsoMdoc],
    jwt_vc_json_ld: ['W3cCredentialRecord'],
    'vc+sd-jwt+json-ld': ['SdJwtVcRecord'],
  }

  const mappedFormats = formatMap[desiredFormat]
  if (!mappedFormats) {
    // Unknown format — don't filter out
    return true
  }

  return mappedFormats.some((f) => recordFormat.includes(f))
}

const getPexCredentialFormat = (credentialRecord: CredentialRecord): string => {
  const type = String(credentialRecord.type ?? '')
  switch (type) {
    case 'SdJwtVcRecord':
      return ClaimFormat.SdJwtDc
    case 'MdocRecord':
      return ClaimFormat.MsoMdoc
    case 'W3cCredentialRecord':
      return String(asRecord(credentialRecord.firstCredential).claimFormat ?? ClaimFormat.JwtVc)
    case 'W3cV2CredentialRecord':
      return String(asRecord(credentialRecord.firstCredential).claimFormat ?? '')
    default:
      return type
  }
}

const matchesInputDescriptorFields = (
  candidate: PexCredentialCandidate,
  inputDescriptor: PexInputDescriptor
): boolean => {
  // Check format constraint on the input descriptor level
  if (inputDescriptor.format && Object.keys(inputDescriptor.format).length > 0) {
    const recordFormat = getPexCredentialFormat(candidate.credentialRecord)
    const formatKeys = Object.keys(inputDescriptor.format)
    const formatMatch = formatKeys.some((fmt) => doesFormatMatch(fmt, recordFormat))
    if (!formatMatch) {
      return false
    }
  }

  const fields = inputDescriptor.constraints?.fields ?? []
  if (fields.length === 0) {
    return true
  }

  return fields.every((field) => {
    const paths = field.path ?? []

    return paths.some((path) => {
      // Use disclosedPayload (decoded claims) for path-based field matching,
      // since pexCredential may be a raw string (e.g. compact SD-JWT)
      const value = getValueAtPath(candidate.disclosedPayload, pexPathToSegments(path))
      if (value === undefined) {
        return false
      }

      // Also evaluate filter constraints on the value
      return fieldValueMatchesFilter(value, field.filter)
    })
  })
}

const getPexPresentationDefinition = (resolved: {
  pex?: { presentation_definition?: unknown }
  authorizationRequestPayload?: Record<string, unknown>
}): IPresentationDefinition | undefined => {
  const presentationDefinition =
    resolved.pex?.presentation_definition ?? resolved.authorizationRequestPayload?.presentation_definition

  return presentationDefinition && typeof presentationDefinition === 'object'
    ? (presentationDefinition as IPresentationDefinition)
    : undefined
}

const getPexCredential = (credential: unknown): unknown => {
  const credentialRecord = asRecord(credential)
  const recordType = String(credentialRecord.type ?? '')
  const firstCredential = asRecord(credentialRecord.firstCredential)

  // SD-JWT: PEX expects compact SD-JWT string for vc+sd-jwt format
  if (recordType === 'SdJwtVcRecord') {
    const compact = firstCredential.compact
    if (typeof compact === 'string' && compact) {
      return compact
    }
  }

  // mdoc: extract namespaces as a plain object (no toJson() available on Credo Mdoc)
  if (recordType === 'MdocRecord') {
    const base64Url = String(firstCredential.base64Url ?? firstCredential.credential ?? '')
    if (base64Url) {
      try {
        const mdocInstance = Mdoc.fromBase64Url(base64Url)
        return { issuerSignedNamespaces: mdocInstance.issuerSignedNamespaces } as JsonObject
      } catch {
        // fall through
      }
    }
  }

  // W3c: PEX expects the JSON credential object
  const firstCredentialJsonCredential = asRecord(firstCredential.jsonCredential)
  if (Object.keys(firstCredentialJsonCredential).length > 0) {
    return firstCredentialJsonCredential as JsonObject
  }

  const firstCredentialCredential = asRecord(firstCredential.credential)
  if (Object.keys(firstCredentialCredential).length > 0) {
    return firstCredentialCredential as JsonObject
  }

  const credentialPayload = asRecord(credentialRecord.credential)
  if (Object.keys(credentialPayload).length > 0) {
    return credentialPayload as JsonObject
  }

  return credentialRecord as JsonObject
}

const getPexCredentialCandidates = (walletCredentials: unknown[]): PexCredentialCandidate[] =>
  walletCredentials.map((credential) => {
    const credentialRecord = asRecord(credential)
    const disclosedPayload = getCredentialPayload(credential)

    return {
      credentialRecord,
      disclosedPayload,
      pexCredential: getPexCredential(credential),
    }
  })

const getSelectedCredentialIndexes = (
  result: ReturnType<PEX['selectFrom']>,
  candidates: PexCredentialCandidate[]
): number[] => {
  const vcIndexes = result.vcIndexes ?? []
  if (vcIndexes.length > 0) {
    return vcIndexes
  }

  const selectedCredentials = result.verifiableCredential ?? []

  return selectedCredentials.flatMap((selectedCredential) => {
    const index = candidates.findIndex((candidate) => candidate.pexCredential === selectedCredential)

    return index >= 0 ? [index] : []
  })
}

const candidatesToSubmissionCredentials = (
  candidates: PexCredentialCandidate[]
): PexSubmissionEntry['verifiableCredentials'] =>
  candidates.map((candidate) => ({
    claimFormat: getClaimFormat(candidate.credentialRecord),
    credentialRecord: candidate.credentialRecord,
    disclosedPayload: candidate.disclosedPayload,
  })) as unknown as PexSubmissionEntry['verifiableCredentials']

const getFieldMatchedSubmissionCredentials = (
  candidates: PexCredentialCandidate[],
  inputDescriptor: PexInputDescriptor
): PexSubmissionEntry['verifiableCredentials'] =>
  candidatesToSubmissionCredentials(
    candidates.filter((candidate) => matchesInputDescriptorFields(candidate, inputDescriptor))
  )

const getPexVerifiableCredentialsForInputDescriptor = (
  pex: PEX,
  presentationDefinition: IPresentationDefinition,
  inputDescriptor: PexInputDescriptor,
  candidates: PexCredentialCandidate[]
): PexSubmissionEntry['verifiableCredentials'] => {
  const definitionForDescriptor = {
    ...presentationDefinition,
    input_descriptors: [inputDescriptor],
    submission_requirements: undefined,
  } as IPresentationDefinition

  try {
    const result = pex.selectFrom(
      definitionForDescriptor,
      candidates.map((candidate) => candidate.pexCredential) as Parameters<PEX['selectFrom']>[1]
    )
    const selectedIndexes = getSelectedCredentialIndexes(result, candidates)

    return selectedIndexes.length > 0
      ? candidatesToSubmissionCredentials(selectedIndexes.map((index) => candidates[index]))
      : getFieldMatchedSubmissionCredentials(candidates, inputDescriptor)
  } catch (pexErr) {
    console.warn(
      `[PEX] selectFrom failed for input descriptor "${String(inputDescriptor.id ?? '')}": ${(pexErr as Error).message}`
    )
    return getFieldMatchedSubmissionCredentials(candidates, inputDescriptor)
  }
}

const getLocalPexCredentialsForRequest = (
  presentationDefinition: IPresentationDefinition,
  walletCredentials: unknown[]
): DifPexCredentialsForRequest => {
  const pex = new PEX()
  const candidates = getPexCredentialCandidates(walletCredentials)
  const inputDescriptors = getInputDescriptors(presentationDefinition)
  const submissionEntry = inputDescriptors.map((inputDescriptor): PexSubmissionEntry => {
    const inputDescriptorId = String(inputDescriptor.id ?? '')
    const verifiableCredentials = getPexVerifiableCredentialsForInputDescriptor(
      pex,
      presentationDefinition,
      inputDescriptor,
      candidates
    )

    return {
      inputDescriptorId,
      name: typeof inputDescriptor.name === 'string' ? inputDescriptor.name : undefined,
      purpose: typeof inputDescriptor.purpose === 'string' ? inputDescriptor.purpose : undefined,
      verifiableCredentials,
      requestedAttributes: getRequestedFieldPaths(inputDescriptor),
    } as PexSubmissionEntry
  })

  return {
    areRequirementsSatisfied: submissionEntry.every((entry) => entry.verifiableCredentials.length > 0),
    name: typeof presentationDefinition.name === 'string' ? presentationDefinition.name : undefined,
    purpose: typeof presentationDefinition.purpose === 'string' ? presentationDefinition.purpose : undefined,
    requirements: [
      {
        submissionEntry,
      },
    ],
  } as DifPexCredentialsForRequest
}

const getOpenIdCredentialRecords = async (agent: BifoldAgent): Promise<unknown[]> => {
  const getAll = async (repository: { getAll?: () => Promise<unknown[]> } | undefined) => repository?.getAll?.() ?? []
  const [w3cCredentials, w3cV2Credentials, sdJwtVcCredentials, mdocCredentials] = await Promise.all([
    getAll(agent.w3cCredentials),
    getAll(agent.w3cV2Credentials),
    getAll(agent.sdJwtVc),
    getAll(agent.mdoc),
  ])

  return [...w3cCredentials, ...w3cV2Credentials, ...sdJwtVcCredentials, ...mdocCredentials].filter(Boolean)
}

const hasJsonSerializer = (
  didDocument: Partial<JsonSerializableDidDocument> | DidDocument
): didDocument is JsonSerializableDidDocument =>
  typeof (didDocument as JsonSerializableDidDocument).toJSON === 'function'

const resolveDidDocumentWithAgent = async (agent: BifoldAgent, did: string): Promise<DidDocument> => {
  const didDocument = (await agent.dids.resolveDidDocument(did)) as Partial<JsonSerializableDidDocument> | DidDocument

  return hasJsonSerializer(didDocument) ? didDocument.toJSON() : (didDocument as DidDocument)
}

function handleTextResponse(text: string): ParseInvitationResult {
  // If the text starts with 'ey' we assume it's a JWT and thus an OpenID authorization request
  if (text.startsWith('ey')) {
    return {
      success: true,
      result: {
        format: 'parsed',
        type: 'openid-authorization-request',
        data: text,
      },
    }
  }

  // Otherwise we still try to parse it as JSON
  try {
    const json: unknown = JSON.parse(text)
    return handleJsonResponse(json)

    // handel like above
  } catch (error) {
    throw new Error(`[handleTextResponse] Error:${error}`)
  }
}

function handleJsonResponse(json: unknown): ParseInvitationResult {
  // We expect a JSON object
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('[handleJsonResponse] Invitation not recognized.')
  }

  if ('@type' in json) {
    return {
      success: true,
      result: {
        format: 'parsed',
        type: 'didcomm',
        data: json,
      },
    }
  }

  if ('credential_issuer' in json) {
    return {
      success: true,
      result: {
        format: 'parsed',
        type: 'openid-credential-offer',
        data: json,
      },
    }
  }

  throw new Error('[handleJsonResponse] Invitation not recognized.')
}

export async function fetchInvitationDataUrl(dataUrl: string): Promise<ParseInvitationResult> {
  // If we haven't had a response after 10 seconds, we will handle as if the invitation is not valid.
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), 10000)

  try {
    // If we still don't know what type of invitation it is, we assume it is a URL that we need to fetch to retrieve the invitation.
    const response = await fetch(dataUrl, {
      headers: {
        // for DIDComm out of band invitations we should include application/json
        // but we are flexible and also want to support other types of invitations
        // as e.g. the OpenID SIOP request is a signed encoded JWT string
        Accept: 'application/json, text/plain, */*',
      },
    })
    clearTimeout(timeout)
    if (!response.ok) {
      throw new Error('[retrieve_invitation_error] Unable to retrieve invitation.')
    }

    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      const json: unknown = await response.json()
      return handleJsonResponse(json)
    }
    const text = await response.text()
    return handleTextResponse(text)
  } catch (error) {
    clearTimeout(timeout)
    throw new Error(`[retrieve_invitation_error] Unable to retrieve invitation: ${error}`)
  }
}

/**
 * Entry point for the OpenID4VP flow after QR scanning / deeplink / paste handling
 * has identified an OpenID authorization request.
 *
 * This is the resolve phase only:
 * - accept the raw request string coming from scan/deeplink handling
 * - ask Credo to resolve the request into PEX or DCQL details
 * - return a record that the proof UI can render
 *
 * It does not send anything to the verifier. The later submit phase is handled by
 * {@link shareProof}, after the user explicitly opts in to share credentials.
 *
 * Uses Credo's resolver as the PRIMARY path to get properly populated
 * presentationExchange.credentialsForRequest and dcql.queryResult.
 * Falls back to bifold's lightweight resolver only if Credo is unavailable.
 */
export const getCredentialsForProofRequest = async ({
  agent,
  request,
}: {
  agent: BifoldAgent
  request: string
}): Promise<OpenId4VPRequestRecord | undefined> => {
  try {
    agent.config.logger.info(`$$Receiving openid authorization request ${request}`)

    // Step 1: Try Credo resolver first (primary path)
    const credoModule = (
      agent as unknown as { modules?: { openid4vc?: { holder?: { resolveOpenId4VpAuthorizationRequest?: (req: string) => Promise<OpenId4VpResolvedAuthorizationRequest> } } } }
    ).modules?.openid4vc?.holder

    if (credoModule?.resolveOpenId4VpAuthorizationRequest) {
      try {
        const credoResult = await credoModule.resolveOpenId4VpAuthorizationRequest(request)
        agent.config.logger.info(
          credoResult.presentationExchange
            ? 'Resolved via Credo with PEX credentials.'
            : credoResult.dcql
              ? 'Resolved via Credo with DCQL query result.'
              : 'Resolved via Credo.'
        )

        const requestRecord: OpenId4VPRequestRecord = {
          authorizationRequestPayload: credoResult.authorizationRequestPayload,
          presentationExchange: credoResult.presentationExchange ? {
            credentialsForRequest: credoResult.presentationExchange.credentialsForRequest,
            definition: credoResult.presentationExchange.definition,
          } : undefined,
          dcql: credoResult.dcql ? {
            queryResult: credoResult.dcql.queryResult as unknown as BifoldDcqlQueryResult,
          } : undefined,
          verifier: credoResult.authorizationRequestPayload.response_uri
            ? { verifierHostName: getHostNameFromUrl(String(credoResult.authorizationRequestPayload.response_uri)) }
            : undefined,
          verifierHostName: credoResult.authorizationRequestPayload.response_uri
            ? getHostNameFromUrl(String(credoResult.authorizationRequestPayload.response_uri))
            : undefined,
          createdAt: new Date().toISOString(),
          type: 'OpenId4VPRequestRecord',
        }

        return requestRecord
      } catch (credoErr) {
        agent.config.logger.warn(
          `Credo resolver failed (${(credoErr as Error).message}). Falling back to bifold resolver.`
        )
      }
    }

    // Step 2: Fallback to bifold's lightweight resolver (if Credo unavailable or errored)
    const walletCredentials = await getOpenIdCredentialRecords(agent)

    let resolved = await resolveAuthorizationRequest({
      didDocumentResolver: (did) => resolveDidDocumentWithAgent(agent, did),
      request,
      walletCredentials: walletCredentials as unknown as Array<Record<string, unknown>>,
    })

    // Step 3: If bifold wrapper returned pex but no presentationExchange, use local PEX matching
    if (!resolved.presentationExchange) {
      const presentationDefinition = getPexPresentationDefinition(resolved)
      if (presentationDefinition) {
        const credentialsForRequest = getLocalPexCredentialsForRequest(presentationDefinition, walletCredentials)
        if (!credentialsForRequest.areRequirementsSatisfied) {
          agent.config.logger.warn('OpenID4VP PEX request could not be fully satisfied by local credential matching.')
        }

        resolved = {
          ...resolved,
          presentationExchange: {
            credentialsForRequest,
          },
        }
      }
    }

    if (!resolved.presentationExchange && !resolved.dcql) {
      throw new Error('Unsupported authorization request: missing presentation exchange or dcql parameters.')
    }

    const requestRecord: OpenId4VPRequestRecord = {
      authorizationRequestPayload: resolved.authorizationRequestPayload,
      presentationExchange: resolved.presentationExchange ? {
        credentialsForRequest: resolved.presentationExchange.credentialsForRequest as DifPexCredentialsForRequest,
      } : undefined,
      dcql: resolved.dcql ? {
        queryResult: resolved.dcql.queryResult as BifoldDcqlQueryResult,
      } : undefined,
      dcqlResult: resolved.dcqlResult,
      vpFormatsSupported: resolved.vpFormatsSupported,
      pex: resolved.pex,
      verifierHostName: resolved.authorizationRequestPayload.response_uri
        ? getHostNameFromUrl(String(resolved.authorizationRequestPayload.response_uri))
        : undefined,
      createdAt: new Date().toISOString(),
      type: 'OpenId4VPRequestRecord',
    }

    return requestRecord
  } catch (err) {
    agent.config.logger.error(`Parsing presentation request:  ${(err as Error)?.message ?? err}`)
    throw err
  }
}

const getPexCredentialsForRequest = (
  credentialsForRequest: DifPexCredentialsForRequest,
  selectedProofCredentials: SelectedProofCredentials
) => {
  if (!credentialsForRequest.areRequirementsSatisfied) {
    throw new Error('Requirements from proof request are not satisfied')
  }

  // `selectedProofCredentials` always represents the user's final UI choice.
  // For PEX, the map key is the input descriptor id.
  return Object.fromEntries(
    credentialsForRequest.requirements.flatMap((requirement) =>
      requirement.submissionEntry.map((entry) => {
        const credentialId = selectedProofCredentials[entry.inputDescriptorId].id
        const credential =
          entry.verifiableCredentials.find((vc) => vc.credentialRecord.id === credentialId) ??
          entry.verifiableCredentials[0]

        return [entry.inputDescriptorId, [credential]]
      })
    )
  )
}

const getDcqlCredentialForRequest = (
  validCredential: DcqlValidCredential
): SubmissionEntryCredential => {
  const useMode = CredentialMultiInstanceUseMode.NewOrFirst

  switch (validCredential.record.type) {
    case 'MdocRecord':
      return {
        claimFormat: ClaimFormat.MsoMdoc,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.claims.valid_claim_sets[0].output as MdocNameSpaces,
        useMode,
      } as SubmissionEntryCredential
    case 'SdJwtVcRecord':
      return {
        claimFormat: ClaimFormat.SdJwtDc,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.claims.valid_claim_sets[0].output as JsonObject,
        useMode,
      } as SubmissionEntryCredential
    case 'W3cCredentialRecord':
      return {
        claimFormat: validCredential.record.firstCredential.claimFormat as ClaimFormat.JwtVc | ClaimFormat.LdpVc,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.record.firstCredential.jsonCredential as JsonObject,
        useMode,
      } as SubmissionEntryCredential
    case 'W3cV2CredentialRecord':
      // NOTE: Credo's SubmissionEntryCredential doesn't include W3cV2CredentialRecord.
      // For DCQL flow, use DcqlCredentialsForRequest which does support it.
      // For PEX flow (which uses SubmissionEntryCredential), we cast generically.
      return {
        claimFormat: validCredential.record.firstCredential.claimFormat as ClaimFormat.JwtVc,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.claims.valid_claim_sets[0].output as JsonObject,
        useMode,
      } as unknown as SubmissionEntryCredential
  }
}

const getDcqlCredentialsForRequest = (
  queryResult: BifoldDcqlQueryResult,
  selectedProofCredentials: SelectedProofCredentials
): SelectedDcqlCredentials => {
  if (!queryResult.can_be_satisfied) {
    throw new Error('Cannot select the credentials for the dcql query presentation if the request cannot be satisfied')
  }

  // This is the same user-selection map as for PEX.
  // For DCQL, the map key is the credential query id instead of the input descriptor id.
  if (Object.keys(selectedProofCredentials).length === 0) {
    const credentialMatches = queryResult.credential_matches ?? {}

    return Object.fromEntries(
      Object.entries(credentialMatches).flatMap(([credentialQueryId, match]) => {
        const validCredentials = match.success ? Array.from(match.valid_credentials ?? []) : []

        return validCredentials[0] ? [[credentialQueryId, [validCredentials[0]]]] : []
      })
    ) as SelectedDcqlCredentials
  }

  return Object.fromEntries(
    Object.entries(selectedProofCredentials).map(([credentialQueryId, selectedCredential]) => {
      const match = queryResult.credential_matches[credentialQueryId]

      if (!match?.success) {
        throw new Error(`No matching DCQL credentials found for credential query id ${credentialQueryId}`)
      }

      const validCredentials = Array.from(match.valid_credentials ?? []) as DcqlValidCredential[]
      const validCredential = validCredentials.find((credential) => credential.record.id === selectedCredential.id)

      if (!validCredential) {
        throw new Error(
          `Could not find credential record ${selectedCredential.id} in valid credential matches for credential query id ${credentialQueryId}`
        )
      }

      return [credentialQueryId, [getDcqlCredentialForRequest(validCredential)]]
    })
  ) as SelectedDcqlCredentials
}

/**
 * Submit phase for OpenID4VP after the user has reviewed the request and chosen
 * which credentials to share.
 *
 * Uses Credo's acceptOpenId4VpAuthorizationRequest() as the PRIMARY path.
 * Credo internally handles:
 * - Format-aware VP building (SD-JWT + KB-JWT, JWT-VP wrapping, mdoc DeviceResponse)
 * - holder binding (challenge/domain for nonce/audience)
 * - presentation_submission with correct formats
 * - HTTP submission to the verifier's response_uri
 *
 * Falls back to bifold's manual submission only if Credo is unavailable.
 */
export const shareProof = async ({
  agent,
  requestRecord,
  selectedProofCredentials,
}: {
  agent: Agent
  requestRecord: OpenId4VPRequestRecord
  selectedProofCredentials: SelectedProofCredentials
}) => {
  try {
    // Try Credo path first (primary)
    const credoModule = (
      agent as unknown as { modules?: { openid4vc?: { holder?: { acceptOpenId4VpAuthorizationRequest?: (opts: Record<string, unknown>) => Promise<{ ok: boolean; serverResponse?: unknown }> } } } }
    ).modules?.openid4vc?.holder

    if (credoModule?.acceptOpenId4VpAuthorizationRequest && requestRecord.presentationExchange?.credentialsForRequest) {
      try {
        // Map user-selected credentials to Credo's DifPexInputDescriptorToCredentials format
        const pexCredentials = mapSelectedToPexCredentials(
          requestRecord.presentationExchange.credentialsForRequest as DifPexCredentialsForRequest,
          selectedProofCredentials
        )

        const result = await credoModule.acceptOpenId4VpAuthorizationRequest({
          authorizationRequestPayload: requestRecord.authorizationRequestPayload,
          presentationExchange: {
            credentials: pexCredentials,
          },
        } as never)

        // Handle redirect_uri if present
        const responsePayload = (result as Record<string, unknown>).authorizationResponsePayload as Record<string, unknown> | undefined
        if (responsePayload) {
          const vpToken = responsePayload.vp_token as Record<string, unknown> | undefined
          if (vpToken && typeof vpToken === 'object' && 'redirect_uri' in vpToken) {
            const redirectUri = vpToken.redirect_uri as string
            if (typeof redirectUri === 'string') {
              await Linking.openURL(redirectUri)
            }
          }
        }

        if (!result.ok) {
          const serverResponse = (result as unknown as { serverResponse?: { body?: unknown; status?: number } }).serverResponse
          throw new Error(`Error while accepting authorization request. ${JSON.stringify(serverResponse?.body ?? serverResponse)}`)
        }

        return result as unknown as AcceptAuthorizationRequestResult
      } catch (credoErr) {
        agent.config.logger.warn(
          `Credo acceptAuthorization failed (${(credoErr as Error).message}). Falling back to bifold submission.`
        )
      }
    }

    // Fallback: use bifold's manual submission
    let result: AcceptAuthorizationRequestResult

    if (requestRecord.presentationExchange) {
      const selectedCredentials = getPexCredentialsForRequest(
        requestRecord.presentationExchange.credentialsForRequest as DifPexCredentialsForRequest,
        selectedProofCredentials
      )

      const entries = Object.values(selectedCredentials).flat()
      const firstEntry = entries[0]
      let vpToken = ''
      let credentialFormat = 'jwt_vc_json' // default format
      if (firstEntry) {
        const record = firstEntry.credentialRecord as unknown as Record<string, unknown>
        const recordType = String(record.type ?? '')
        const firstCred = (record.firstCredential as Record<string, unknown>) ?? {}

        // Detect credential format dynamically
        if (recordType === 'SdJwtVcRecord') {
          credentialFormat = 'vc+sd-jwt'
          if (typeof firstCred.compact === 'string' && firstCred.compact) {
            // SD-JWT: compact form is the credential itself (no KB-JWT in fallback)
            vpToken = firstCred.compact
          }
        } else if (recordType === 'MdocRecord') {
          credentialFormat = 'mso_mdoc'
          if (typeof firstCred.base64Url === 'string' && firstCred.base64Url) {
            vpToken = firstCred.base64Url
          } else if (typeof firstCred.credential === 'string' && firstCred.credential) {
            vpToken = firstCred.credential
          }
        } else if (recordType === 'W3cCredentialRecord' || recordType === 'W3cV2CredentialRecord') {
          // JWT-VC: check claimFormat from firstCredential
          const claimFormat = String(firstCred.claimFormat ?? '')
          if (claimFormat.includes('sd-jwt') || claimFormat.includes('sdjwt')) {
            credentialFormat = 'vc+sd-jwt'
          } else if (claimFormat.includes('ldp')) {
            credentialFormat = 'ldp_vc'
          } else {
            credentialFormat = 'jwt_vc_json'
          }

          if (typeof firstCred.credential === 'string' && firstCred.credential) {
            vpToken = firstCred.credential
          } else if (firstCred.credential && typeof firstCred.credential === 'object' && (firstCred.credential as Record<string, unknown>).serialized) {
            vpToken = String((firstCred.credential as Record<string, unknown>).serialized)
          } else if (typeof firstCred.encoded === 'string' && firstCred.encoded) {
            vpToken = firstCred.encoded
          }
        }
      }

      const presentationDefinition = (requestRecord as { pex?: { presentation_definition?: { id?: string } } }).pex?.presentation_definition
      const defId = presentationDefinition?.id ?? ''
      const descriptorMap = Object.keys(selectedCredentials).map((id) => ({
        id,
        format: credentialFormat,
        path: '$',
      }))

      // OID4VP spec: presentation_submission is a JSON object in the response payload
      const authorizationResponsePayload: Record<string, unknown> = {
        vp_token: vpToken,
        presentation_submission: {
          definition_id: defId,
          descriptor_map: descriptorMap,
        },
      }

      const reqPayload = requestRecord.authorizationRequestPayload as Record<string, unknown> | undefined
      if (typeof reqPayload?.state === 'string') {
        authorizationResponsePayload.state = reqPayload.state
      }

      result = await acceptAuthorizationRequest({
        authorizationRequestPayload: requestRecord.authorizationRequestPayload,
        authorizationResponsePayload: authorizationResponsePayload as unknown as Parameters<typeof acceptAuthorizationRequest>[0]['authorizationResponsePayload'],
      })
    } else if (requestRecord.dcql?.queryResult) {
      const dcqlCredentials = getDcqlCredentialsForRequest(requestRecord.dcql.queryResult, selectedProofCredentials)

      result = await acceptAuthorizationRequest({
        authorizationRequestPayload: requestRecord.authorizationRequestPayload,
        selectedCredentials: dcqlCredentials,
      })
    } else {
      throw new Error('Unsupported authorization request: missing presentation exchange or dcql parameters.')
    }

    const serverResponse = result.serverResponse as
      | { status?: number; body?: unknown }
      | Record<string, unknown>
      | string
      | undefined
    const responseBody =
      serverResponse && typeof serverResponse === 'object' && 'body' in serverResponse
        ? serverResponse.body
        : serverResponse

    if (
      responseBody &&
      typeof responseBody === 'object' &&
      typeof (responseBody as { redirect_uri?: unknown }).redirect_uri === 'string'
    ) {
      await Linking.openURL((responseBody as { redirect_uri: string }).redirect_uri)
    }

    if (
      !result.ok ||
      (serverResponse &&
        typeof serverResponse === 'object' &&
        'status' in serverResponse &&
        typeof serverResponse.status === 'number' &&
        (serverResponse.status < 200 || serverResponse.status > 299))
    ) {
      throw new Error(`Error while accepting authorization request. ${String(responseBody)}`)
    }

    return result
  } catch (error) {
    throw new Error(`Error accepting proof request. ${(error as Error)?.message ?? error}`)
  }
}
