import {
  ClaimFormat,
  type DifPexCredentialsForRequest,
  type DifPexInputDescriptorToCredentials,
  type DcqlCredentialsForRequest,
  type SubmissionEntryCredential,
} from '@credo-ts/core'
import type { DcqlQueryResult } from '@bifold/openid4vp'

/**
 * Maps user-selected credentials (from the proof UI) to Credo's
 * DifPexInputDescriptorToCredentials format, used by
 * acceptOpenId4VpAuthorizationRequest({ presentationExchange: { credentials } }).
 *
 * The UI provides selectedProofCredentials in the format:
 *   Record<string, { id: string, claimFormat: string }>
 * where the key is the input descriptor id and the value contains the credential record id.
 *
 * Credo expects:
 *   Record<string, SubmissionEntryCredential[]>
 * where SubmissionEntryCredential includes claimFormat, credentialRecord, and optionally disclosedPayload.
 */
export function mapSelectedToPexCredentials(
  credentialsForRequest: DifPexCredentialsForRequest,
  selectedProofCredentials: Record<string, { id: string; claimFormat: string }>
): DifPexInputDescriptorToCredentials {
  const selected: DifPexInputDescriptorToCredentials = {}

  for (const requirement of credentialsForRequest.requirements) {
    for (const entry of requirement.submissionEntry) {
      const inputDescriptorId = entry.inputDescriptorId
      const selectedCred = selectedProofCredentials[inputDescriptorId]

      if (!selectedCred) {
        // If no explicit selection, use the first available credential
        if (entry.verifiableCredentials.length > 0) {
          selected[inputDescriptorId] = [entry.verifiableCredentials[0]]
        }
        continue
      }

      // Find the matching credential record
      const matched = entry.verifiableCredentials.find(
        (vc) => vc.credentialRecord.id === selectedCred.id
      )

      if (matched) {
        selected[inputDescriptorId] = [matched]
      } else if (entry.verifiableCredentials.length > 0) {
        // Fallback to first available if the selected one is not found
        selected[inputDescriptorId] = [entry.verifiableCredentials[0]]
      }
    }
  }

  return selected
}

/**
 * Maps user-selected credentials (from the proof UI) to Credo's
 * DcqlCredentialsForRequest format, used by
 * acceptOpenId4VpAuthorizationRequest({ dcql: { credentials } }).
 *
 * The UI provides selectedProofCredentials where the key is the credential query id.
 *
 * Credo expects:
 *   Record<string, NonEmptyArray<{ claimFormat, credentialRecord, disclosedPayload, useMode? }>>
 */
export function mapSelectedToDcqlCredentials(
  queryResult: DcqlQueryResult,
  selectedProofCredentials: Record<string, { id: string; claimFormat: string }>
): DcqlCredentialsForRequest {
  const selected: DcqlCredentialsForRequest = {} as DcqlCredentialsForRequest

  for (const [credentialQueryId, match] of Object.entries(queryResult.credential_matches)) {
    if (!match?.success) continue

    const validCredentials = [...(match.valid_credentials ?? [])] as Array<Record<string, unknown>>
    if (validCredentials.length === 0) continue

    const selectedCred = selectedProofCredentials[credentialQueryId]

    if (selectedCred) {
      // Find the matching credential by record id
      const matched = validCredentials.filter((vc) =>
        (vc.record as Record<string, unknown> | undefined)?.id === selectedCred.id
      )
      if (matched.length > 0) {
        selected[credentialQueryId] = matched.slice(0, 1) as unknown as DcqlCredentialsForRequest[string]
      } else {
        // Use first valid credential
        selected[credentialQueryId] = validCredentials.slice(0, 1) as unknown as DcqlCredentialsForRequest[string]
      }
    } else {
      // Auto-select: use first valid credential for this query
      selected[credentialQueryId] = validCredentials.slice(0, 1) as unknown as DcqlCredentialsForRequest[string]
    }
  }

  return selected
}
