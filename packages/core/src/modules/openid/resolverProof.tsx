import {
  Agent,
  ClaimFormat,
  CredentialMultiInstanceUseMode,
  type DcqlCredentialsForRequest,
  type DcqlValidCredential,
  type DifPexCredentialsForRequest,
  type JsonObject,
  type MdocNameSpaces,
} from '@credo-ts/core'
import {
  acceptAuthorizationRequest,
  resolveAuthorizationRequest,
  type DcqlQueryResult,
  type DidDocument,
  type SelectedDcqlCredentials,
} from '@bifold/openid4vp'
import { ParseInvitationResult } from '../../utils/parsers'
import { OpenId4VPRequestRecord } from './types'
import { getHostNameFromUrl } from './utils/utils'
import { Linking } from 'react-native'
import { BifoldAgent } from '../../utils/agent'

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

const hasJsonSerializer = (didDocument: Partial<JsonSerializableDidDocument> | DidDocument): didDocument is JsonSerializableDidDocument =>
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

    // Step 1: Fetch credentials and Resolve via bifold wrapper 
    const [w3cCredentials, w3cV2Credentials, sdJwtVcCredentials, mdocCredentials] = await Promise.all([
      agent.w3cCredentials.getAll(),
      agent.w3cV2Credentials.getAll(),
      agent.sdJwtVc.getAll(),
      agent.mdoc.getAll(),
    ])

    const walletCredentials = [
      ...w3cCredentials,
      ...w3cV2Credentials,
      ...sdJwtVcCredentials,
      ...mdocCredentials,
    ].filter(Boolean)

    let resolved = await resolveAuthorizationRequest({
      didDocumentResolver: (did) => resolveDidDocumentWithAgent(agent, did),
      request,
      walletCredentials: walletCredentials as unknown as Array<Record<string, unknown>>,
    })

    // Step 2: If the bifold wrapper returned pex/dcql but NOT presentationExchange or dcql.queryResult,
    // fall back to Credo resolver which handles PEX credential matching and DCQL evaluation internally.
    // The upstream @openid4vc/openid4vp returns PEX data under 'pex' not 'presentationExchange',
    // and DCQL without credential matching. Credo's resolver fills both gaps.
    const hasCredoFallback = !!(agent as { modules?: { openid4vc?: { holder?: { resolveOpenId4VpAuthorizationRequest?: unknown } } } }).modules?.openid4vc?.holder?.resolveOpenId4VpAuthorizationRequest
    const needsCredoFallback =
      hasCredoFallback &&
      ((resolved.pex && !resolved.presentationExchange) ||
        (resolved.dcql && !resolved.dcql?.queryResult) ||
        (!resolved.presentationExchange && !resolved.dcql))

    if (needsCredoFallback) {
      agent.config.logger.info(
        resolved.pex
          ? 'Resolved OpenID4VP request contains PEX data. Falling back to Credo PEX credential matching.'
          : 'Resolved OpenID4VP request needs DCQL evaluation. Falling back to Credo resolver.'
      )
      try {
        // Pass the original request string (URI like openid://?client_id=...&request_uri=...).
        // Credo's resolver will re-parse the URI, fetch the JWT from request_uri,
        // and run its internal PEX/DCQL credential matching via presentationExchangeService/dcqlService.
        // This gives us the properly populated `presentationExchange` and `dcql.queryResult`.
        const credoResult = await agent.modules.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(request)
        resolved = {
          ...resolved,
          presentationExchange: credoResult.presentationExchange,
          dcql: credoResult.dcql as typeof resolved.dcql,
        }
      } catch (credoErr) {
        agent.config.logger.warn(
          `Credo resolver fallback failed (${(credoErr as Error).message}). ` +
          'Proceeding with bifold-resolved data — presentation may be partial.'
        )
      }
    }

    if (!resolved.presentationExchange && !resolved.dcql) {
      throw new Error('Unsupported authorization request: missing presentation exchange or dcql parameters.')
    }

    const requestRecord: OpenId4VPRequestRecord = {
      ...resolved,
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
): DcqlCredentialsForRequest[string][number] => {
  const useMode = CredentialMultiInstanceUseMode.NewOrFirst

  switch (validCredential.record.type) {
    case 'MdocRecord':
      return {
        claimFormat: ClaimFormat.MsoMdoc,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.claims.valid_claim_sets[0].output as MdocNameSpaces,
        useMode,
      }
    case 'SdJwtVcRecord':
      return {
        claimFormat: ClaimFormat.SdJwtDc,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.claims.valid_claim_sets[0].output as JsonObject,
        useMode,
      }
    case 'W3cCredentialRecord':
      return {
        claimFormat: validCredential.record.firstCredential.claimFormat as ClaimFormat.JwtVc | ClaimFormat.LdpVc,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.record.firstCredential.jsonCredential as JsonObject,
        useMode,
      }
    case 'W3cV2CredentialRecord':
      return {
        claimFormat: validCredential.record.firstCredential.claimFormat as
          | ClaimFormat.JwtW3cVc
          | ClaimFormat.SdJwtW3cVc,
        credentialRecord: validCredential.record,
        disclosedPayload: validCredential.claims.valid_claim_sets[0].output as JsonObject,
        useMode,
      }
  }
}

const getDcqlCredentialsForRequest = (
  queryResult: DcqlQueryResult,
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
 * This function takes:
 * - the resolved request record created by {@link getCredentialsForProofRequest}
 * - the user's final credential selections from the proof UI
 *
 * It then maps those selections into the Credo input expected for either
 * presentation exchange or DCQL and submits the authorization response.
 */
export const shareProof = async ({
  requestRecord,
  selectedProofCredentials,
}: {
  agent: Agent
  requestRecord: OpenId4VPRequestRecord
  selectedProofCredentials: SelectedProofCredentials
}) => {
  try {
    const selectedCredentials = requestRecord.presentationExchange
      ? getPexCredentialsForRequest(
          requestRecord.presentationExchange.credentialsForRequest as DifPexCredentialsForRequest,
          selectedProofCredentials
        )
      : undefined

    const dcql =
      !selectedCredentials && requestRecord.dcql?.queryResult
        ? getDcqlCredentialsForRequest(requestRecord.dcql.queryResult, selectedProofCredentials)
        : undefined

    if (!selectedCredentials && !dcql) {
      throw new Error('Unsupported authorization request: missing presentation exchange or dcql parameters.')
    }

    const result = await acceptAuthorizationRequest({
      authorizationRequestPayload: requestRecord.authorizationRequestPayload,
      selectedCredentials: (selectedCredentials ?? dcql) as SelectedDcqlCredentials,
    })
    const serverResponse = result.serverResponse as
      | {
          status?: number
          body?: unknown
        }
      | Record<string, unknown>
      | string
      | undefined
    const responseBody =
      serverResponse && typeof serverResponse === 'object' && 'body' in serverResponse
        ? serverResponse.body
        : serverResponse

    // if redirect_uri is provided, open it in the browser
    // Even if the response returned an error, we must open this uri
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
    // Handle biometric authentication errors
    throw new Error(`Error accepting proof request. ${(error as Error)?.message ?? error}`)
  }
}
