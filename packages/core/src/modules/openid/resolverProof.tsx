import {
  Agent,
  ClaimFormat,
  CredentialMultiInstanceUseMode,
  type DcqlCredentialsForRequest,
  type DcqlQueryResult,
  type DcqlValidCredential,
  type DifPexCredentialsForRequest,
  type JsonObject,
  type MdocNameSpaces,
} from '@credo-ts/core'
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
    claimIndexes?: number[]
    disclosedClaims?: string[]
  }
>

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

    // DEBUG: log wallet credentials — FULL CONTENT
    try {
      const [w3c, w3cV2, sdjwt, mdoc] = await Promise.all([
        agent.w3cCredentials.getAll(),
        agent.w3cV2Credentials.getAll(),
        agent.sdJwtVc.getAll(),
        agent.mdoc.getAll(),
      ])
      agent.config.logger.info(`[DEBUG] Wallet credentials — w3c: ${w3c.length}, w3cV2: ${w3cV2.length}, sdJwt: ${sdjwt.length}, mdoc: ${mdoc.length}`)

      for (const cred of w3c) {
        const fc = 'firstCredential' in cred ? cred.firstCredential : undefined
        const jsonCred = fc && typeof fc === 'object' && 'jsonCredential' in fc ? fc.jsonCredential : undefined
        const plainCred = fc && typeof fc === 'object' && 'credential' in fc ? fc.credential : undefined
        agent.config.logger.info(`[DEBUG] Wallet w3c — id: ${cred.id}`)
        if (fc && typeof fc === 'object') {
          agent.config.logger.info(`[DEBUG] Wallet w3c firstCredential keys: ${Object.keys(fc as unknown as Record<string, unknown>).join(', ')}`)
        }
        if (jsonCred && typeof jsonCred === 'object') {
          agent.config.logger.info(`[DEBUG] Wallet w3c jsonCredential FULL: ${JSON.stringify(jsonCred)}`)
        }
        if (plainCred && typeof plainCred === 'object') {
          agent.config.logger.info(`[DEBUG] Wallet w3c credential FULL: ${JSON.stringify(plainCred)}`)
        }
      }

      for (const cred of w3cV2) {
        const fc = 'firstCredential' in cred ? cred.firstCredential : undefined
        agent.config.logger.info(`[DEBUG] Wallet w3cV2 — id: ${cred.id}`)
        if (fc && typeof fc === 'object') {
          agent.config.logger.info(`[DEBUG] Wallet w3cV2 firstCredential FULL: ${JSON.stringify(fc)}`)
        }
      }

      for (const cred of sdjwt) {
        agent.config.logger.info(`[DEBUG] Wallet sdJwt — id: ${cred.id}`)
        const tags = typeof cred.getTags === 'function' ? cred.getTags() as Record<string, unknown> : {}
        agent.config.logger.info(`[DEBUG] Wallet sdJwt tags: ${JSON.stringify(tags)}`)
        if ('credentialInstances' in cred) {
          const instances = cred.credentialInstances
          agent.config.logger.info(`[DEBUG] Wallet sdJwt instances count: ${Array.isArray(instances) ? instances.length : 'N/A'}`)
          if (Array.isArray(instances)) {
            for (let i = 0; i < instances.length; i++) {
              const inst = instances[i]
              if (inst && typeof inst === 'object') {
                agent.config.logger.info(`[DEBUG] Wallet sdJwt instance[${i}] keys: ${Object.keys(inst as unknown as Record<string, unknown>).join(', ')}`)
                const instAny = inst as { compactSdJwtVc?: string; compact?: string; sdJwtVc?: string }
                const compactToken = instAny.compactSdJwtVc ?? instAny.compact ?? instAny.sdJwtVc
                if (compactToken && typeof compactToken === 'string') {
                  agent.config.logger.info(`[DEBUG] Wallet sdJwt instance[${i}] compactSdJwtVc: ${compactToken}`)
                  // Parse SD-JWT: header.payload.signature~disclosures
                  const parts = compactToken.split('~')
                  const payloadPart = parts[0]?.split('.')?.[1]
                  if (payloadPart) {
                    try {
                      const decoded = JSON.parse(Buffer.from(payloadPart, 'base64url').toString())
                      agent.config.logger.info(`[DEBUG] Wallet sdJwt instance[${i}] payload: ${JSON.stringify(decoded)}`)
                      if (decoded.vct) agent.config.logger.info(`[DEBUG] Wallet sdJwt instance[${i}] vct claim: ${decoded.vct}`)
                    } catch {
                      agent.config.logger.info(`[DEBUG] Wallet sdJwt instance[${i}] FAILED to parse payload`)
                    }
                  }
                  // Parse disclosures
                  const disclosures = parts.slice(1, -1).filter(d => d.length > 0)
                  if (disclosures.length > 0) {
                    for (let d = 0; d < disclosures.length; d++) {
                      try {
                        const decoded = JSON.parse(Buffer.from(disclosures[d], 'base64url').toString())
                        agent.config.logger.info(`[DEBUG] Wallet sdJwt instance[${i}] disclosure[${d}]: ${JSON.stringify(decoded)}`)
                      } catch {
                        agent.config.logger.info(`[DEBUG] Wallet sdJwt instance[${i}] disclosure[${d}]: raw ${disclosures[d].substring(0, 80)}...`)
                      }
                    }
                  }
                }
                const disclosable = 'disclosablePayload' in inst ? inst.disclosablePayload : undefined
                if (disclosable && typeof disclosable === 'object') {
                  agent.config.logger.info(`[DEBUG] Wallet sdJwt instance[${i}] disclosablePayload: ${JSON.stringify(disclosable)}`)
                }
              }
            }
          }
        }
        const compactRoot = (cred as unknown as { compactSdJwtVc?: string }).compactSdJwtVc
        if (compactRoot && typeof compactRoot === 'string') {
          agent.config.logger.info(`[DEBUG] Wallet sdJwt compactSdJwtVc (root): ${compactRoot}`)
        }
      }

      for (const cred of mdoc) {
        agent.config.logger.info(`[DEBUG] Wallet mdoc — id: ${cred.id}`)
        if ('docType' in cred) agent.config.logger.info(`[DEBUG] Wallet mdoc docType: ${String(cred.docType)}`)
        if ('issuerCertificate' in cred) agent.config.logger.info(`[DEBUG] Wallet mdoc issuerCertificate: ${String(cred.issuerCertificate).substring(0, 100)}...`)
        if ('nameSpaces' in cred && cred.nameSpaces && typeof cred.nameSpaces === 'object') {
          agent.config.logger.info(`[DEBUG] Wallet mdoc nameSpaces keys: ${Object.keys(cred.nameSpaces as Record<string, unknown>).join(', ')}`)
          agent.config.logger.info(`[DEBUG] Wallet mdoc nameSpaces FULL: ${JSON.stringify(cred.nameSpaces)}`)
        }
      }
    } catch (walletErr) {
      agent.config.logger.error(`[DEBUG] Failed to list wallet credentials: ${walletErr instanceof Error ? walletErr.message : String(walletErr)}`)
    }
    const resolved = await agent.modules.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(request)
    if (resolved.dcql && 'query' in resolved.dcql) {
      const dcqlQuery = (resolved.dcql as { query: unknown }).query
      if (dcqlQuery && typeof dcqlQuery === 'object' && 'credentials' in dcqlQuery) {
        const dcqlCredentials = dcqlQuery.credentials
        if (Array.isArray(dcqlCredentials)) {
          agent.config.logger.info(`[DEBUG] DCQL credentials request count: ${dcqlCredentials.length}`)
          for (const cred of dcqlCredentials) {
            if (cred && typeof cred === 'object') {
              const id = 'id' in cred ? String(cred.id) : 'unknown'
              const format = 'format' in cred ? String(cred.format) : 'unknown'
              const claims = 'claims' in cred ? cred.claims : undefined
              agent.config.logger.info(`[DEBUG] DCQL credential — id: ${id}, format: ${format}, claims count: ${Array.isArray(claims) ? claims.length : 0}`)
              if (Array.isArray(claims)) {
                for (const claim of claims) {
                  if (claim && typeof claim === 'object') {
                    const path = claim && typeof claim === 'object' && 'path' in claim && Array.isArray(claim.path)
                      ? (claim.path as Array<string | number | null>).filter((p): p is string | number => p !== null).join('.')
                      : 'N/A'
                    const namespace = claim && typeof claim === 'object' && 'namespace' in claim ? String(claim.namespace) : 'N/A'
                    const claimName = claim && typeof claim === 'object' && 'claim_name' in claim ? String(claim.claim_name) : 'N/A'
                    agent.config.logger.info(`[DEBUG] DCQL claim — path: ${path}, namespace: ${namespace}, claim_name: ${claimName}`)
                  }
                }
              }
            }
          }
        }
      }

      const queryResult = resolved.dcql.queryResult
      if (queryResult && typeof queryResult === 'object') {
        const canBeSatisfied = 'can_be_satisfied' in queryResult ? String(queryResult.can_be_satisfied) : 'N/A'
        const qrCredentials = 'credentials' in queryResult ? queryResult.credentials : undefined
        agent.config.logger.info(`[DEBUG] DCQL queryResult can_be_satisfied: ${canBeSatisfied}`)
        agent.config.logger.info(`[DEBUG] DCQL queryResult credentials count: ${Array.isArray(qrCredentials) ? qrCredentials.length : 0}`)
        if (Array.isArray(qrCredentials)) {
          for (const qc of qrCredentials) {
            if (qc && typeof qc === 'object') {
              const qcId = 'id' in qc ? String(qc.id) : 'N/A'
              const qcFormat = 'format' in qc ? String(qc.format) : 'N/A'
              const qcMeta = 'meta' in qc ? qc.meta : undefined
              agent.config.logger.info(`[DEBUG] DCQL queryResult credential — id: ${qcId}, format: ${qcFormat}, meta: ${qcMeta && typeof qcMeta === 'object' ? JSON.stringify(qcMeta) : 'N/A'}`)
            }
          }
        }
      }
    }

    if (resolved.presentationExchange) {
      const pex = resolved.presentationExchange
      const credsForRequest = pex && typeof pex === 'object' && 'credentialsForRequest' in pex ? pex.credentialsForRequest : undefined
      agent.config.logger.info(`[DEBUG] PEX credentialsForRequest requirements count: ${credsForRequest && typeof credsForRequest === 'object' && 'requirements' in credsForRequest && Array.isArray(credsForRequest.requirements) ? credsForRequest.requirements.length : 0}`)
    }

    const requestRecord: OpenId4VPRequestRecord = {
      ...resolved,
      verifierHostName: resolved.authorizationRequestPayload.response_uri
        ? getHostNameFromUrl(String(resolved.authorizationRequestPayload.response_uri))
        : undefined,
      createdAt: new Date(),
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
  validCredential: DcqlValidCredential,
  disclosedClaims?: string[]
): DcqlCredentialsForRequest[string][number] => {
  const useMode = CredentialMultiInstanceUseMode.NewOrFirst

  const filterPayload = (payload: any) => {
    console.log('[DCQL-FILTER] Original Payload Keys:', Object.keys(payload))
    console.log('[DCQL-FILTER] Disclosed Claims (UI):', disclosedClaims)
    if (!disclosedClaims) return payload
    const rootKeys = disclosedClaims.map(path => path.split('.')[0])
    const filtered = Object.fromEntries(
      Object.entries(payload).filter(([key]) => rootKeys.includes(key))
    )
    console.log('[DCQL-FILTER] Filtered Payload Keys:', Object.keys(filtered))
    return filtered
  }

  console.log('[DCQL-FILTER] Record Type:', validCredential.record.type)

  switch (validCredential.record.type) {
    case 'MdocRecord':
      return {
        claimFormat: ClaimFormat.MsoMdoc,
        credentialRecord: validCredential.record,
        disclosedPayload: filterPayload(validCredential.claims.valid_claim_sets[0].output) as MdocNameSpaces,
        useMode,
      }
    case 'SdJwtVcRecord':
      return {
        claimFormat: ClaimFormat.SdJwtDc,
        credentialRecord: validCredential.record,
        disclosedPayload: filterPayload(validCredential.claims.valid_claim_sets[0].output) as JsonObject,
        useMode,
      }
    case 'W3cCredentialRecord':
      return {
        claimFormat: validCredential.record.firstCredential.claimFormat as ClaimFormat.JwtVc | ClaimFormat.LdpVc,
        credentialRecord: validCredential.record,
        disclosedPayload: filterPayload(validCredential.record.firstCredential.jsonCredential) as JsonObject,
        useMode,
      }
    case 'W3cV2CredentialRecord':
      return {
        claimFormat: validCredential.record.firstCredential.claimFormat as
          | ClaimFormat.JwtW3cVc
          | ClaimFormat.SdJwtW3cVc,
        credentialRecord: validCredential.record,
        disclosedPayload: filterPayload(validCredential.claims.valid_claim_sets[0].output) as JsonObject,
        useMode,
      }
  }
}

const getDcqlCredentialsForRequest = (
  agent: Agent,
  queryResult: DcqlQueryResult,
  selectedProofCredentials: SelectedProofCredentials
): DcqlCredentialsForRequest => {
  if (!queryResult.can_be_satisfied) {
    throw new Error('Cannot select the credentials for the dcql query presentation if the request cannot be satisfied')
  }

  // This is the same user-selection map as for PEX.
  // For DCQL, the map key is the credential query id instead of the input descriptor id.
  if (Object.keys(selectedProofCredentials).length === 0) {
    return agent.openid4vc.holder.selectCredentialsForDcqlRequest(queryResult)
  }

  return Object.fromEntries(
    Object.entries(selectedProofCredentials).map(([credentialQueryId, selectedCredential]) => {
      const match = queryResult.credential_matches[credentialQueryId]

      if (!match?.success) {
        throw new Error(`No matching DCQL credentials found for credential query id ${credentialQueryId}`)
      }

      const validCredentials = Array.from(match.valid_credentials) as DcqlValidCredential[]

      // Filter by claimIndexes if provided — enables selective disclosure
      const filtered = selectedCredential.claimIndexes?.length
        ? validCredentials.filter((_, idx) => selectedCredential.claimIndexes!.includes(idx))
        : validCredentials

      const validCredential = filtered.find((credential) => credential.record.id === selectedCredential.id) ?? filtered[0]

      if (!validCredential) {
        throw new Error(
          `Could not find credential record ${selectedCredential.id} in valid credential matches for credential query id ${credentialQueryId}`
        )
      }

      return [credentialQueryId, [getDcqlCredentialForRequest(validCredential, selectedCredential.disclosedClaims)]]
    })
  )
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
  agent,
  requestRecord,
  selectedProofCredentials,
}: {
  agent: Agent
  requestRecord: OpenId4VPRequestRecord
  selectedProofCredentials: SelectedProofCredentials
}) => {
  try {
    const presentationExchange = requestRecord.presentationExchange
      ? {
          credentials: getPexCredentialsForRequest(
            requestRecord.presentationExchange.credentialsForRequest,
            selectedProofCredentials
          ),
        }
      : undefined

    const dcql =
      !presentationExchange && requestRecord.dcql
        ? {
            credentials: getDcqlCredentialsForRequest(agent, requestRecord.dcql.queryResult, selectedProofCredentials),
          }
        : undefined

    if (!presentationExchange && !dcql) {
      throw new Error('Unsupported authorization request: missing presentation exchange or dcql parameters.')
    }

    const result = await agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: requestRecord.authorizationRequestPayload,
      presentationExchange,
      dcql,
      origin: requestRecord.origin,
    })

    // if redirect_uri is provided, open it in the browser
    // Even if the response returned an error, we must open this uri
    if (
      result.serverResponse &&
      typeof result.serverResponse.body === 'object' &&
      typeof result.serverResponse.body?.redirect_uri === 'string'
    ) {
      await Linking.openURL(result.serverResponse.body.redirect_uri)
    }

    if (result.serverResponse && (result.serverResponse.status < 200 || result.serverResponse.status > 299)) {
      throw new Error(`Error while accepting authorization request. ${result.serverResponse.body as string}`)
    }

    return result
  } catch (error) {
    // Handle biometric authentication errors
    throw new Error(`Error accepting proof request. ${(error as Error)?.message ?? error}`)
  }
}
