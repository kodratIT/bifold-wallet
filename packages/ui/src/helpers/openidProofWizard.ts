/* ------------------------------------------------------------------ */
/*  DCQL SD-JWT / mDOC multi-entry wizard helpers                     */
/*  Duplicated from packages/core to avoid modifying core.             */
/* ------------------------------------------------------------------ */
import {
  ClaimFormat,
  CredentialMultiInstanceUseMode,
  type Agent,
  type DcqlQueryResult,
  type DcqlValidCredential,
  type JsonObject,
  type MdocNameSpaces,
} from '@credo-ts/core'
import { Linking } from 'react-native'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SelectedCredentialsFormat = Record<string, { id: string; claimFormat: string }>

export interface WizardAttribute {
  key: string
  label: string
  value: string
  isRequired: boolean
  isTogglable: boolean
}

export interface WizardCredentialOption {
  id: string
  credentialName: string
  issuerName?: string
  claimFormat: ClaimFormat | 'AnonCreds'
  attributes: WizardAttribute[]
  backgroundColor?: string
  textColor?: string
}

export interface WizardEntry {
  entryId: string
  entryName: string
  purpose?: string
  credentials: WizardCredentialOption[]
}

export interface WizardData {
  entries: WizardEntry[]
  areAllSatisfied: boolean
}

type DcqlShareEntry = {
  claimFormat: ClaimFormat
  credentialRecord: unknown
  disclosedPayload: JsonObject | MdocNameSpaces
  useMode: CredentialMultiInstanceUseMode
}

const isSafeRedirectUri = (redirectUri: string): boolean => {
  try {
    const url = new URL(redirectUri)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

export const formatClaimLabel = (key: string): string => {
  if (!key) return ''
  return key
    .split(/[._]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' \u2794 ')
}

export const formatClaimValue = (value: unknown): string => {
  if (value === null || value === undefined) return '\u2014'
  if (typeof value === 'object') {
    const extractLeafValues = (obj: Record<string, unknown>): string[] => {
      const vals: string[] = []
      for (const k in obj) {
        if (typeof obj[k] === 'object' && obj[k] !== null) {
          vals.push(...extractLeafValues(obj[k] as Record<string, unknown>))
        } else {
          vals.push(String(obj[k]))
        }
      }
      return vals
    }
    return extractLeafValues(value as Record<string, unknown>).join(', ') || '\u2014'
  }
  return String(value)
}

export const getAttributeIcon = (key: string): string => {
  const k = key.toLowerCase()
  if (k.includes('name')) return 'person-outline'
  if (k.includes('birth') || k.includes('date')) return 'cake'
  if (k.includes('gender') || k.includes('sex')) return 'wc'
  if (k.includes('email')) return 'email'
  if (k.includes('phone') || k.includes('mobile')) return 'phone-iphone'
  if (k.includes('address') || k.includes('location') || k.includes('city') || k.includes('country')) return 'map'
  if (k.includes('over_') || k.includes('age')) return 'verified-user'
  if (k.includes('vct') || k.includes('type')) return 'fingerprint'
  return 'assignment'
}

/* ------------------------------------------------------------------ */
/*  DCQL helpers                                                       */
/* ------------------------------------------------------------------ */

const formatDcqlClaimPath = (path: Array<string | number | null>): string =>
  path.filter((item) => item !== null).join('.')

const getDcqlClaimFormat = (validCredential: DcqlValidCredential): ClaimFormat => {
  if (validCredential.record.type === 'MdocRecord') return ClaimFormat.MsoMdoc
  if (validCredential.record.type === 'SdJwtVcRecord') return ClaimFormat.SdJwtDc
  return validCredential.record.firstCredential.claimFormat as ClaimFormat
}

const getDcqlCredentialName = (credentialQuery: DcqlQueryResult['credentials'][number]): string => {
  const id = String(credentialQuery.id)
  const meta = credentialQuery.meta as { doctype_value?: unknown; vct_values?: unknown[] } | undefined

  if (credentialQuery.format === 'mso_mdoc') {
    return typeof meta?.doctype_value === 'string' ? meta.doctype_value : id
  }
  if (credentialQuery.format === 'vc+sd-jwt' || credentialQuery.format === 'dc+sd-jwt') {
    const vct = meta?.vct_values?.[0]
    return typeof vct === 'string' && vct.length > 0 ? vct.replace('https://', '') : id
  }
  return id
}

const getDcqlRequestedAttributes = (credentialQuery: DcqlQueryResult['credentials'][number]): string[] => {
  const claims = (credentialQuery.claims ?? []) as OptionalDcqlClaim[]
  return claims
    .map((claim) => {
      if (claim.path) return formatDcqlClaimPath(claim.path)
      return [claim.namespace, claim.claim_name].filter(Boolean).join('.')
    })
    .filter(Boolean)
}

type OptionalDcqlClaim = Record<string, unknown> & {
  path?: Array<string | number | null>
  namespace?: string
  claim_name?: string
}

const getOptionalDcqlClaimKeys = (queryResult: DcqlQueryResult | undefined, credentialQueryId: string): Set<string> => {
  const query = queryResult?.credentials.find((credentialQuery) => credentialQuery.id === credentialQueryId)
  const claims = (query?.claims ?? []) as OptionalDcqlClaim[]
  return new Set(
    claims
      .filter((claim) => claim.required === false)
      .map((claim) => {
        if (claim.path) return formatDcqlClaimPath(claim.path)
        return [claim.namespace, claim.claim_name].filter(Boolean).join('.')
      })
  )
}

/* ------------------------------------------------------------------ */
/*  Extract attribute values from DCQL output                          */
/* ------------------------------------------------------------------ */

const getNestedValue = (value: unknown, path: string): unknown => {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object' || Array.isArray(acc)) return undefined
    return (acc as Record<string, unknown>)[key]
  }, value)
}

const setNestedValue = (target: Record<string, unknown>, path: string, value: unknown) => {
  const parts = path.split('.').filter(Boolean)
  if (parts.length === 0) return

  let current = target
  for (const part of parts.slice(0, -1)) {
    const existing = current[part]
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
}

const pickSelectedClaims = (output: unknown, selectedClaims: Record<string, boolean>): JsonObject => {
  const flatOutput = output as Record<string, unknown>
  const filtered: Record<string, unknown> = {}
  const entries = Object.entries(selectedClaims)

  // No selection data → include all output as fallback
  if (entries.length === 0) {
    console.warn('[pickSelectedClaims] selectedClaims empty, sending all output as fallback')
    return flatOutput
  }

  for (const [claimPath, isSelected] of entries) {
    if (!isSelected) continue

    if (Object.prototype.hasOwnProperty.call(flatOutput, claimPath)) {
      filtered[claimPath] = flatOutput[claimPath]
      continue
    }

    const nestedValue = getNestedValue(output, claimPath)
    if (nestedValue !== undefined) {
      setNestedValue(filtered, claimPath, nestedValue)
    }
  }

  // Fallback: if filtering yields empty result but output has claims, send all
  if (Object.keys(filtered).length === 0 && Object.keys(flatOutput).length > 0) {
    console.warn('[pickSelectedClaims] filtered result is empty but output has claims, sending all as safety fallback')
    return flatOutput
  }

  return filtered as JsonObject
}

/* ------------------------------------------------------------------ */
/*  Build WizardData from DCQL query result                            */
/* ------------------------------------------------------------------ */

export function buildWizardData(
  queryResult: DcqlQueryResult,
  dcqlCredential: { queryResult: DcqlQueryResult } | undefined
): WizardData {
  const credentialSets = queryResult.credential_sets ?? [
    {
      required: true,
      options: [queryResult.credentials.map((cred) => cred.id)],
      matching_options: queryResult.can_be_satisfied ? [queryResult.credentials.map((cred) => cred.id)] : undefined,
    },
  ]

  const entries: WizardEntry[] = credentialSets.flatMap((credentialSet) => {
    const credentialIds = credentialSet.matching_options?.[0] ?? credentialSet.options[0]

    return credentialIds.map((credentialId): WizardEntry => {
      const credentialQueryId = String(credentialId)
      const credentialQuery = queryResult.credentials.find((c) => String(c.id) === credentialQueryId)

      const purpose = typeof credentialSet.purpose === 'string' ? credentialSet.purpose : undefined

      if (!credentialQuery) {
        return {
          entryId: credentialQueryId,
          entryName: credentialQueryId,
          purpose,
          credentials: [],
        }
      }

      const match = queryResult.credential_matches[credentialQueryId]
      const validCredentials: DcqlValidCredential[] = match?.success ? Array.from(match.valid_credentials) : []

      if (validCredentials.length === 0) {
        return {
          entryId: credentialQueryId,
          entryName: getDcqlCredentialName(credentialQuery),
          purpose,
          credentials: [],
        }
      }

      const optionalKeys = getOptionalDcqlClaimKeys(dcqlCredential?.queryResult, credentialQueryId)

      const credentialOptions: WizardCredentialOption[] = validCredentials.map((validCredential) => {
        const output = validCredential.claims.valid_claim_sets[0].output
        const recordType = validCredential.record.type
        const cf = getDcqlClaimFormat(validCredential)

        // Extract attributes
        const requestedAttrs = getDcqlRequestedAttributes(credentialQuery)
        const supportsClaimSelection = recordType === 'SdJwtVcRecord' || recordType === 'MdocRecord'

        let flatOutput: Record<string, unknown> = {}

        if (recordType === 'SdJwtVcRecord') {
          flatOutput = output as Record<string, unknown>
        } else if (recordType === 'MdocRecord') {
          const nsOutput = output as Record<string, Record<string, unknown>>
          for (const [ns, claims] of Object.entries(nsOutput)) {
            for (const [key, val] of Object.entries(claims)) {
              flatOutput[`${ns}.${key}`] = val
            }
          }
        } else {
          flatOutput = output as Record<string, unknown>
        }

        // If we have requestedAttributes from the query, use those;
        // otherwise fall back to all output keys
        const attrKeys = requestedAttrs.length > 0 ? requestedAttrs : Object.keys(flatOutput)

        const attributes: WizardAttribute[] = attrKeys.map((key) => {
          const rawValue = flatOutput[key] ?? getNestedValue(output, key)
          return {
            key,
            label: formatClaimLabel(key),
            value: formatClaimValue(rawValue),
            isRequired: !optionalKeys.has(key),
            isTogglable: supportsClaimSelection,
          }
        })

        return {
          id: validCredential.record.id,
          credentialName: getDcqlCredentialName(credentialQuery),
          claimFormat: cf,
          attributes,
          backgroundColor: undefined,
          textColor: undefined,
        }
      })

      const credentialQueryName = getDcqlCredentialName(credentialQuery)

      return {
        entryId: credentialQueryId,
        entryName: credentialQueryName,
        purpose,
        credentials: credentialOptions,
      }
    })
  })

  return {
    entries,
    areAllSatisfied: entries.length > 0 && entries.every((e) => e.credentials.length > 0),
  }
}

/* ------------------------------------------------------------------ */
/*  Build filtered DCQL credentials for submission                     */
/* ------------------------------------------------------------------ */

export function buildFilteredDcqlCredentials(
  queryResult: DcqlQueryResult,
  selectedCredentials: SelectedCredentialsFormat,
  selectedClaimsByEntry: Record<string, Record<string, boolean>>
): Record<string, DcqlShareEntry[]> {
  const result: Record<string, DcqlShareEntry[]> = {}

  for (const [credentialQueryId, selected] of Object.entries(selectedCredentials)) {
    const match = queryResult.credential_matches[credentialQueryId]
    if (!match?.success) continue

    const validCredentials = Array.from(match.valid_credentials) as DcqlValidCredential[]
    const validCredential = validCredentials.find((vc) => vc.record.id === selected.id)
    if (!validCredential) continue

    const output = validCredential.claims.valid_claim_sets[0].output
    const recordType = validCredential.record.type
    const entryClaims = selectedClaimsByEntry[credentialQueryId] ?? {}

    console.log(
      `[buildFilteredDcqlCredentials] credentialQueryId="${credentialQueryId}", recordType="${recordType}"`
    )
    console.log(
      `[buildFilteredDcqlCredentials] entryClaims keys: ${JSON.stringify(Object.keys(entryClaims))}`
    )
    console.log(
      `[buildFilteredDcqlCredentials] entryClaims selected: ${JSON.stringify(
        Object.fromEntries(Object.entries(entryClaims).filter(([, v]) => v))
      )}`
    )
    console.log(
      `[buildFilteredDcqlCredentials] output keys: ${JSON.stringify(Object.keys(output as Record<string, unknown>))}`
    )

    let filteredDisclosedPayload: JsonObject | MdocNameSpaces

    if (recordType === 'SdJwtVcRecord') {
      filteredDisclosedPayload = pickSelectedClaims(output, entryClaims)
    } else if (recordType === 'MdocRecord') {
      const namespaceOutput = output as Record<string, Record<string, unknown>>
      const filtered: Record<string, Record<string, unknown>> = {}
      for (const [namespace, claims] of Object.entries(namespaceOutput)) {
        const filteredClaims = Object.fromEntries(
          Object.entries(claims).filter(([key]) => {
            const flatKey = `${namespace}.${key}`
            return entryClaims[flatKey] === true
          })
        )
        if (Object.keys(filteredClaims).length > 0) filtered[namespace] = filteredClaims
      }
      filteredDisclosedPayload = filtered as MdocNameSpaces
    } else {
      // Generic fallback: filter output by selected claims for any record type
      filteredDisclosedPayload = pickSelectedClaims(output, entryClaims)
    }

    result[credentialQueryId] = [
      {
        claimFormat: getDcqlClaimFormat(validCredential),
        credentialRecord: validCredential.record,
        disclosedPayload: filteredDisclosedPayload,
        useMode: CredentialMultiInstanceUseMode.NewOrFirst,
      },
    ]
  }

  return result
}

/* ------------------------------------------------------------------ */
/*  Submit DCQL share                                                  */
/* ------------------------------------------------------------------ */

export const handleDcqlShare = async (
  agent: Agent,
  requestRecord: {
    authorizationRequestPayload: Record<string, unknown>
    dcql: { queryResult: DcqlQueryResult }
    origin?: string
  },
  selectedCredentials: SelectedCredentialsFormat,
  selectedClaimsByEntry: Record<string, Record<string, boolean>>
) => {
  const dcqlCredentials = buildFilteredDcqlCredentials(
    requestRecord.dcql.queryResult,
    selectedCredentials,
    selectedClaimsByEntry
  )

  const submitPayload = {
    authorizationRequestPayload: requestRecord.authorizationRequestPayload,
    dcql: { credentials: dcqlCredentials },
    origin: requestRecord.origin,
  }

  const result = await agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest(submitPayload)

  const body = result.serverResponse?.body
  if (
    body &&
    typeof body === 'object' &&
    'redirect_uri' in body &&
    typeof (body as Record<string, unknown>).redirect_uri === 'string'
  ) {
    const redirectUri = (body as Record<string, string>).redirect_uri
    if (isSafeRedirectUri(redirectUri)) {
      await Linking.openURL(redirectUri)
    }
  }
  if (result.serverResponse && (result.serverResponse.status < 200 || result.serverResponse.status > 299)) {
    throw new Error(`Error while accepting authorization request. Status: ${result.serverResponse.status}`)
  }
  return result
}
