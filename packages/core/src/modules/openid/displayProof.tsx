import {
  ClaimFormat,
  type DcqlQueryResult,
  type DcqlValidCredential,
  type DifPexCredentialsForRequest,
} from '@credo-ts/core'

import { filterAndMapSdJwtKeys, getCredentialForDisplay } from './display'
import { OpenIDCredentialRecord } from './credentialRecord'
import { ClaimSetGroup, FormattedSubmission, FormattedSubmissionEntry, OpenId4VPRequestRecord } from './types'

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const flattenMdocDisclosedPayload = (value: unknown): Record<string, unknown> =>
  Object.fromEntries(
    Object.values(asRecord(value)).flatMap((entry) =>
      entry && typeof entry === 'object' && !Array.isArray(entry) ? Object.entries(entry) : []
    )
  )

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

const getDcqlDisclosedPayload = (validCredential: DcqlValidCredential): Record<string, unknown> => {
  const output = validCredential.claims.valid_claim_sets[0].output

  if (validCredential.record.type === 'MdocRecord') {
    return flattenMdocDisclosedPayload(output)
  }

  if (validCredential.record.type === 'SdJwtVcRecord') {
    return filterAndMapSdJwtKeys(asRecord(output)).visibleProperties
  }

  return asRecord(output)
}

const formatDcqlClaimPath = (path: Array<string | number | null>): string =>
  path.filter((item) => item !== null).join('.')
const dcqlClaimToKey = (claim: Record<string, unknown>): string => {
  if ('path' in claim && Array.isArray(claim.path)) {
    return formatDcqlClaimPath(claim.path as Array<string | number | null>)
  }
  const ns = claim.namespace as string | undefined
  const name = claim.claim_name as string | undefined
  return [ns, name].filter(Boolean).join('.')
}


const getDcqlRequestedAttributes = (credentialQuery: DcqlQueryResult['credentials'][number]): string[] => {
  if (credentialQuery.format === 'mso_mdoc') {
    const attrs = (
      credentialQuery.claims?.map((claim) =>
        'path' in claim ? formatDcqlClaimPath(claim.path) : [claim.namespace, claim.claim_name].join('.')
      ) ?? []
    )
    console.log(`[DEBUG] getDcqlRequestedAttributes (mso_mdoc) for ${credentialQuery.id}:`, attrs)
    return attrs
  }

  const attrs = credentialQuery.claims?.map((claim) => formatDcqlClaimPath(claim.path)) ?? []
  console.log(`[DEBUG] getDcqlRequestedAttributes for ${credentialQuery.id}:`, attrs)
  return attrs
}
 const getDcqlNonRequiredClaimKeys = (credentialQuery: DcqlQueryResult['credentials'][number]): string[] => {
   const claims = credentialQuery.claims ?? []
   return claims
     .filter((c) => (c as Record<string, unknown>)?.required === false)
     .map(dcqlClaimToKey)
 }


const getDcqlCredentialName = (credentialQuery: DcqlQueryResult['credentials'][number]): string => {
  if (credentialQuery.format === 'mso_mdoc') {
    return credentialQuery.meta?.doctype_value ?? credentialQuery.id
  }

  if (
    (credentialQuery.format === 'vc+sd-jwt' && credentialQuery.meta && 'vct_values' in credentialQuery.meta) ||
    credentialQuery.format === 'dc+sd-jwt'
  ) {
    return credentialQuery.meta && 'vct_values' in credentialQuery.meta && credentialQuery.meta.vct_values?.[0]
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
  console.log(`[DEBUG] formatDcqlCredentialsForRequest — credentialSets:`, JSON.stringify(credentialSets))

  const entries = credentialSets.flatMap((credentialSet) => {
    const credentialIds = credentialSet.matching_options?.[0] ?? credentialSet.options[0]

    return credentialIds.map((credentialId): FormattedSubmissionEntry => {
      const credentialQuery = queryResult.credentials.find((credential) => credential.id === credentialId)

      if (!credentialQuery) {
        throw new Error(`Credential '${credentialId}' not found in dcql query`)
      }

      const match = queryResult.credential_matches[credentialId]
      const validCredentials: DcqlValidCredential[] = match?.success ? Array.from(match.valid_credentials) : []
      console.log(`[DEBUG] formatDcql — entry ${credentialId}, validCredentials count: ${validCredentials.length}, canBeSatisfied: ${match?.success}`)
      if (validCredentials.length === 0) {
        const requestedAttrs = getDcqlRequestedAttributes(credentialQuery)
        console.log(`[DEBUG] formatDcql — unsatisfied entry ${credentialId}, requestedAttributes:`, requestedAttrs)
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
              requestedAttributes: requestedAttrs,
              claimSets: deriveClaimSetsFromQuery(credentialQuery),
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
          const disclosedPayload = getDcqlDisclosedPayload(validCredential)
          console.log(`[DEBUG] formatDcql — satisfied entry ${credentialId}, credential: ${validCredential.record.id}, disclosedPayload keys:`, Object.keys(disclosedPayload))

          // DCQL claims[] paths → some may have required:false (optional)
          const allDcqlClaimKeys = getDcqlRequestedAttributes(credentialQuery)
          const nonRequiredDcqlKeys = getDcqlNonRequiredClaimKeys(credentialQuery)

          // Essential = DCQL claims where required !== false (default true)
          const essentialAttributes = allDcqlClaimKeys.filter((key) => !nonRequiredDcqlKeys.includes(key))
          // Optional = DCQL claims with required:false + extra disclosed claims not in claims[]
          const allKeys = Object.keys(disclosedPayload)
          const extraDisclosed = allKeys.filter((key) => !allDcqlClaimKeys.includes(key))
          const optionalAttributes = [...nonRequiredDcqlKeys, ...extraDisclosed]

          console.log(`[DEBUG] formatDcql — essential (required!==false): ${essentialAttributes.join(', ')}, optional (required===false + extra): ${optionalAttributes.join(', ')}`)

          return {
            id: validCredential.record.id,
            credentialName: display.name,
            issuerName: display.issuer.name,
            requestedAttributes: essentialAttributes,
            optionalAttributes: optionalAttributes.length > 0 ? optionalAttributes : undefined,
            metadata,
            backgroundColor: display.backgroundColor,
            textColor: display.textColor,
            backgroundImage: display.backgroundImage,
            claimSets: deriveClaimSetsFromQuery(credentialQuery),
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
    console.log('[DEBUG] formatOpenIdProofRequest — using PEX path')
    return formatDifPexCredentialsForRequest(record.presentationExchange.credentialsForRequest)
  }

  if (record.dcql) {
    console.log('[DEBUG] formatOpenIdProofRequest — using DCQL path')
    return formatDcqlCredentialsForRequest(record.dcql.queryResult)
  }

  console.log('[DEBUG] formatOpenIdProofRequest — NO presentationExchange or dcql found, returning undefined')
  return undefined
}

/**
 * Extracts requested vs optional claims from a DCQL query result for selective disclosure UI.
 * Returns a Map of credentialId → { requested: string[], optional: string[] }.
 *
 * - `requested`: claim paths/keys explicitly requested by the verifier
 * - `optional`: visible claims in the credential NOT requested by the verifier (can be toggled)
 */
export function extractDcqlClaimInfo(queryResult: DcqlQueryResult): Map<string, { requested: string[]; optional: string[] }> {
  const result = new Map<string, { requested: string[]; optional: string[] }>()

  for (const credentialQuery of queryResult.credentials) {
    const requested = getDcqlRequestedAttributes(credentialQuery)

    const match = queryResult.credential_matches[credentialQuery.id]
    const validCredentials: DcqlValidCredential[] = match?.success ? Array.from(match.valid_credentials) : []

    const allVisible = validCredentials.length > 0 ? Object.keys(getDcqlDisclosedPayload(validCredentials[0])) : []
    const optional = allVisible.filter((key) => !requested.includes(key))

    result.set(credentialQuery.id, { requested, optional })
  }

  return result
}

/**
 * Categorizes a claim path into a semantic group label.
 */
function categorizeClaimPath(path: string): string | null {
  const rules: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /^age_|over_\d+/i, label: 'Age Verification' },
    { pattern: /name|given|family/i, label: 'Identity' },
    { pattern: /^address/i, label: 'Address' },
    { pattern: /^email/i, label: 'Contact' },
    { pattern: /^phone|mobile|tel/i, label: 'Contact' },
    { pattern: /^doc|^id_|identifier|number$/i, label: 'Document Info' },
  ]

  for (const rule of rules) {
    if (rule.pattern.test(path)) return rule.label
  }

  // Extract first meaningful segment from snake_case as fallback
  const firstSeg = path.split('_')[0]
  if (firstSeg && firstSeg.length > 2) {
    return firstSeg.charAt(0).toUpperCase() + firstSeg.slice(1)
  }

  return null
}

/**
 * Derives claim set groupings from a DCQL credential query.
 * Groups claims by semantic category (Age Verification, Identity, etc.).
 * Can be overridden by external claim set config (from `ii` config).
 */
export function deriveClaimSetsFromQuery(
  credentialQuery: DcqlQueryResult['credentials'][number]
): ClaimSetGroup[] {
  const claims = credentialQuery.claims ?? []
  if (claims.length === 0) return []

  const groups = new Map<string, string[]>()
  const uncategorized: string[] = []

  for (const claim of claims) {
    const path = 'path' in claim ? claim.path : [claim.claim_name ?? '']
    const key = formatDcqlClaimPath(path)
    if (!key) continue

    const category = categorizeClaimPath(key)
    if (category) {
      const existing = groups.get(category) ?? []
      existing.push(key)
      groups.set(category, existing)
    } else {
      uncategorized.push(key)
    }
  }

  const result: ClaimSetGroup[] = Array.from(groups.entries()).map(([label, claimKeys], idx) => ({
    id: `cs-${idx}`,
    label,
    claimKeys,
  }))

  if (uncategorized.length > 0) {
    result.push({
      id: `cs-other`,
      label: 'Other Information',
      claimKeys: uncategorized,
    })
  }

  return result
}
