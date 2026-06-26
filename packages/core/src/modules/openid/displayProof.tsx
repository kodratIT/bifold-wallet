import {
  ClaimFormat,
  type DcqlValidCredential,
  type DifPexCredentialsForRequest,
} from '@credo-ts/core'
import { type DcqlQueryResult } from '@bifold/openid4vp'

import { filterAndMapSdJwtKeys, getCredentialForDisplay } from './display'
import { OpenIDCredentialRecord } from './credentialRecord'
import { FormattedSubmission, FormattedSubmissionEntry, OpenId4VPRequestRecord } from './types'

const getDcqlClaimFormat = (record: OpenIDCredentialRecord): ClaimFormat => {
  switch (record.type) {
    case 'MdocRecord':
      return ClaimFormat.MsoMdoc
    case 'SdJwtVcRecord':
      return ClaimFormat.SdJwtDc
    default:
      return record.firstCredential.claimFormat
  }
}

const dcqlPathToSegments = (path: Array<string | number | null>): string[] => {
  if (path.length === 1 && typeof path[0] === 'string') {
    return path[0]
      .replace(/^\$\./, '')
      .replace(/^\$/, '')
      .replace(/\[['"]?([^'"\]]+)['"]?\]/g, '.$1')
      .split('.')
      .filter(Boolean)
  }

  return path.filter((item): item is string | number => item !== null && item !== '$').map(String)
}

const formatDcqlDisplayClaimPath = (path: Array<string | number | null>): string => {
  const segments = dcqlPathToSegments(path)
  const credentialSubjectIndex = segments.indexOf('credentialSubject')

  if (credentialSubjectIndex >= 0 && segments[credentialSubjectIndex + 1]) {
    return segments.slice(credentialSubjectIndex + 1).join('.')
  }

  return segments.join('.')
}

const getDcqlRequestedAttributes = (credentialQuery: DcqlQueryResult['credentials'][number]): string[] => {
  if (credentialQuery.format === 'mso_mdoc') {
    return (
      credentialQuery.claims?.map((claim) => {
        if (claim.claim_name) return claim.claim_name
        const path = dcqlPathToSegments(claim.path ?? [])
        return path[path.length - 1] ?? ''
      }) ?? []
    )
  }

  return credentialQuery.claims?.map((claim) => formatDcqlDisplayClaimPath(claim.path ?? [])) ?? []
}

const getDcqlCredentialName = (credentialQuery: DcqlQueryResult['credentials'][number]): string => {
  if (credentialQuery.format === 'mso_mdoc') {
    return credentialQuery.meta?.doctype_value ?? credentialQuery.id
  }

  if (
    (credentialQuery.format === 'vc+sd-jwt' && credentialQuery.meta && 'vct_values' in credentialQuery.meta) ||
    credentialQuery.format === 'dc+sd-jwt'
  ) {
    return credentialQuery.meta?.vct_values?.[0]
      ? credentialQuery.meta.vct_values[0].replace('https://', '')
      : credentialQuery.id
  }

  return credentialQuery.id
}

export function formatDcqlCredentialsForRequest(queryResult: DcqlQueryResult): FormattedSubmission {
  const credentialSets: NonNullable<DcqlQueryResult['credential_sets']> = queryResult.credential_sets ?? [
    {
      required: true,
      options: [queryResult.credentials.map((credential) => credential.id)],
      matching_options: queryResult.can_be_satisfied
        ? [queryResult.credentials.map((credential) => credential.id)]
        : undefined,
    },
  ]

  const entries = credentialSets.flatMap((credentialSet) => {
    const credentialIds = credentialSet.matching_options?.[0] ?? credentialSet.options[0]

    return credentialIds.map((credentialId): FormattedSubmissionEntry => {
      const credentialQuery = queryResult.credentials.find((credential) => credential.id === credentialId)

      if (!credentialQuery) {
        throw new Error(`Credential '${credentialId}' not found in dcql query`)
      }

      const match = queryResult.credential_matches[credentialId]
      const validCredentials = (
        match?.success ? Array.from(match.valid_credentials ?? []) : []
      ) as DcqlValidCredential[]

      if (validCredentials.length === 0) {
        return {
          inputDescriptorId: credentialId,
          name: getDcqlCredentialName(credentialQuery),
          purpose: typeof credentialSet.purpose === 'string' ? credentialSet.purpose : undefined,
          description: undefined,
          isSatisfied: false,
          credentials: [
            {
              id: credentialId,
              credentialName: getDcqlCredentialName(credentialQuery),
              requestedAttributes: getDcqlRequestedAttributes(credentialQuery),
              claimFormat: ClaimFormat.JwtVc,
            },
          ],
        }
      }

      return {
        inputDescriptorId: credentialId,
        name: credentialId,
        purpose: typeof credentialSet.purpose === 'string' ? credentialSet.purpose : undefined,
        description: undefined,
        isSatisfied: validCredentials.length >= 1,
        credentials: validCredentials.map((validCredential) => {
          const { display, metadata } = getCredentialForDisplay(validCredential.record)

          return {
            id: validCredential.record.id,
            credentialName: display.name,
            issuerName: display.issuer.name,
            requestedAttributes: getDcqlRequestedAttributes(credentialQuery),
            metadata,
            backgroundColor: display.backgroundColor,
            textColor: display.textColor,
            backgroundImage: display.backgroundImage,
            claimFormat: getDcqlClaimFormat(validCredential.record),
          }
        }),
      }
    })
  })

  return {
    areAllSatisfied: entries.every((entry) => entry.isSatisfied),
    name: 'Unknown',
    purpose: credentialSets
      .map((credentialSet) => credentialSet.purpose)
      .find((purpose): purpose is string => typeof purpose === 'string'),
    entries,
  }
}

export function formatDifPexCredentialsForRequest(
  credentialsForRequest: DifPexCredentialsForRequest
): FormattedSubmission {
  const entries = credentialsForRequest.requirements.flatMap((requirement) => {
    return requirement.submissionEntry.map((submission): FormattedSubmissionEntry => {
      return {
        inputDescriptorId: submission.inputDescriptorId,
        name: submission.name ?? 'Unknown',
        purpose: submission.purpose,
        description: submission.purpose,
        isSatisfied: submission.verifiableCredentials.length >= 1,

        credentials: submission.verifiableCredentials.map((verifiableCredential) => {
          const { display, attributes, metadata, claimFormat } = getCredentialForDisplay(
            verifiableCredential.credentialRecord
          )

          let disclosedPayload = attributes
          if (verifiableCredential.claimFormat === ClaimFormat.SdJwtDc) {
            disclosedPayload = filterAndMapSdJwtKeys(verifiableCredential.disclosedPayload).visibleProperties
          } else if (verifiableCredential.claimFormat === ClaimFormat.MsoMdoc) {
            disclosedPayload = Object.fromEntries(
              Object.values(verifiableCredential.disclosedPayload).flatMap((entry) => Object.entries(entry))
            )
          }

          return {
            id: verifiableCredential.credentialRecord.id,
            credentialName: display.name,
            issuerName: display.issuer.name,
            requestedAttributes: [...Object.keys(disclosedPayload)],
            metadata,
            backgroundColor: display.backgroundColor,
            textColor: display.textColor,
            backgroundImage: display.backgroundImage,
            claimFormat,
          }
        }),
      }
    })
  })

  return {
    areAllSatisfied: entries.every((entry) => entry.isSatisfied),
    name: credentialsForRequest.name ?? 'Unknown',
    purpose: credentialsForRequest.purpose,
    entries,
  }
}

export function formatOpenIdProofRequest(record: OpenId4VPRequestRecord): FormattedSubmission | undefined {
  if (record.presentationExchange) {
    return formatDifPexCredentialsForRequest(record.presentationExchange.credentialsForRequest as DifPexCredentialsForRequest)
  }

  if (record.dcql?.queryResult) {
    return formatDcqlCredentialsForRequest(record.dcql.queryResult)
  }

  return undefined
}
