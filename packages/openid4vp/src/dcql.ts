import type { DcqlCredentialMatch, DcqlPresentation, DcqlQueryResult } from './types'

export type DcqlCredentialFormat = 'vc+sd-jwt' | 'mso_mdoc' | 'jwt_vc_json' | 'ldp_vc'

export interface DcqlClaimQuery {
  path?: Array<string | number | null>
  namespace?: string
  claim_name?: string
}

export interface DcqlInputCredentialQuery {
  id: string
  format: DcqlCredentialFormat | DcqlCredentialFormat[]
  claims?: DcqlClaimQuery[]
}

export interface DcqlCredentialSet {
  required?: boolean
  options: string[][] | string[]
}

export interface DcqlQuery {
  credentials: DcqlInputCredentialQuery[]
  credential_sets?: DcqlCredentialSet[]
}

export type WalletCredential = Record<string, unknown>

export function evaluateDcqlQuery(
  query: DcqlQuery,
  walletCredentials: WalletCredential[]
): DcqlQueryResult {
  const matches = query.credentials.reduce<Record<string, DcqlCredentialMatch[]>>(
    (result, credentialQuery) => ({
      ...result,
      [credentialQuery.id]: walletCredentials
        .filter((credential) => matchesCredentialQuery(credentialQuery, credential))
        .map((credential) => ({
          credential,
          presentation: presentationFromCredential(credential),
        })),
    }),
    {}
  )
  const credentialSets = query.credential_sets?.map((credentialSet) => {
    const options = normalizeCredentialSetOptions(credentialSet.options)
    const satisfied = options.some((option) =>
      option.every((credentialQueryId) => (matches[credentialQueryId]?.length ?? 0) > 0)
    )

    return {
      required: credentialSet.required !== false,
      matching_options: satisfied ? [options.find((option) =>
        option.every((credentialQueryId) => (matches[credentialQueryId]?.length ?? 0) > 0)
      ) ?? []] : undefined,
      satisfied,
      options,
    }
  })

  const canBeSatisfied = credentialSets
    ? credentialSets.every((credentialSet) => !credentialSet.required || credentialSet.satisfied)
    : query.credentials.every((credentialQuery) => matches[credentialQuery.id].length > 0)

  return {
    can_be_satisfied: canBeSatisfied,
    credential_sets: credentialSets,
    credential_matches: Object.fromEntries(
      Object.entries(matches).map(([credentialQueryId, credentialMatches]) => [
        credentialQueryId,
        {
          success: credentialMatches.length > 0,
          valid_credentials: credentialMatches.map((match) => ({
            record: match.credential,
            claims: {
              valid_claim_sets: [{ output: getCredentialPayload(match.credential as WalletCredential) }],
            },
          })),
        },
      ])
    ),
    credentials: query.credentials.map((credential) => ({
      ...credential,
      format: Array.isArray(credential.format) ? credential.format[0] : credential.format,
    })),
    matches,
    query,
  }
}

export function buildDcqlVpToken(
  selectedCredentials: Record<string, DcqlPresentation[] | WalletCredential[]>
): Record<string, DcqlPresentation[]> {
  return Object.fromEntries(
    Object.entries(selectedCredentials).map(([credentialQueryId, credentials]) => [
      credentialQueryId,
      credentials.map((credential) => presentationFromCredential(credential as WalletCredential)),
    ])
  )
}

function matchesCredentialQuery(query: DcqlInputCredentialQuery, credential: WalletCredential): boolean {
  return matchesFormat(query.format, credential) && matchesClaims(query.claims, credential)
}

function matchesFormat(
  requiredFormat: DcqlCredentialFormat | DcqlCredentialFormat[],
  credential: WalletCredential
): boolean {
  const requiredFormats = Array.isArray(requiredFormat) ? requiredFormat : [requiredFormat]
  const credentialRecord = asRecord(credential)
  const credentialPayload = getCredentialPayload(credential)
  const credentialFormat = String(
    credentialRecord.format ??
      credentialRecord.credentialFormat ??
      credentialRecord.type ??
      credentialRecord.recordType ??
      credentialPayload.format ??
      credentialPayload.credentialFormat ??
      credentialPayload.type ??
      credentialPayload.recordType ??
      ''
  )
  const constructorName = String((credential as { constructor?: { name?: string } }).constructor?.name ?? '')
  const payloadConstructorName = String((credentialPayload as { constructor?: { name?: string } }).constructor?.name ?? '')
  const candidates = [credentialFormat, constructorName, payloadConstructorName].map((value) => value.toLowerCase())

  return requiredFormats.some((format) =>
    formatAliases(format).some((alias) => candidates.some((candidate) => candidate.includes(alias)))
  )
}

function matchesClaims(claims: DcqlClaimQuery[] | undefined, credential: WalletCredential): boolean {
  if (!claims || claims.length === 0) {
    return true
  }

  return claims.every((claim) => {
    if (claim.namespace && claim.claim_name) {
      return getMdocClaimValue(credential, claim.namespace, claim.claim_name) !== undefined
    }

    if (claim.path && claim.path.length > 0) {
      return getJsonPathValue(credential, claim.path) !== undefined
    }

    return true
  })
}

function getMdocClaimValue(
  credential: WalletCredential,
  namespace: string,
  claimName: string
): unknown {
  const credentialRecord = asRecord(credential)
  const credentialPayload = getCredentialPayload(credential)
  const namespaces = (credentialRecord.namespaces ??
    credentialRecord.claims ??
    credentialRecord.credential ??
    credentialPayload.namespaces ??
    credentialPayload.claims ??
    credentialPayload.credential) as Record<string, Record<string, unknown>> | undefined

  return namespaces?.[namespace]?.[claimName]
}

function getJsonPathValue(credential: WalletCredential, path: Array<string | number | null>): unknown {
  const credentialPayload = getCredentialPayload(credential)
  const segments = normalizeDcqlPath(path)

  const valueFromPayload = getValueAtPath(credentialPayload, segments)
  if (valueFromPayload !== undefined) {
    return valueFromPayload
  }

  const credentialSubject = asRecord(credentialPayload).credentialSubject
  if (credentialSubject && !segments.includes('credentialSubject')) {
    return getValueAtPath(credentialSubject, segments)
  }

  return undefined
}

function normalizeDcqlPath(path: Array<string | number | null>): Array<string | number> {
  if (path.length === 1 && typeof path[0] === 'string') {
    return pathStringToSegments(path[0])
  }

  return path.filter((segment): segment is string | number => segment !== null && segment !== '$' && segment !== '')
}

function pathStringToSegments(path: string): Array<string | number> {
  return path
    .replace(/^\$\./, '')
    .replace(/^\$/, '')
    .replace(/\[['"]?([^'"\]]+)['"]?\]/g, '.$1')
    .split('.')
    .filter(Boolean)
}

function getValueAtPath(value: unknown, segments: Array<string | number>): unknown {
  return segments.reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return (current as Record<string | number, unknown>)[segment]
    }

    return undefined
  }, value)
}

function getCredentialPayload(credential: WalletCredential): Record<string, unknown> {
  const credentialRecord = asRecord(credential)
  const firstCredential = asRecord(credentialRecord.firstCredential)
  const firstCredentialJsonCredential = asRecord(firstCredential.jsonCredential)
  if (Object.keys(firstCredentialJsonCredential).length > 0) {
    return firstCredentialJsonCredential
  }

  const firstCredentialCredential = asRecord(firstCredential.credential)
  if (Object.keys(firstCredentialCredential).length > 0) {
    return firstCredentialCredential
  }

  const credentialPayload = asRecord(credentialRecord.credential)
  if (Object.keys(credentialPayload).length > 0) {
    return credentialPayload
  }

  return credentialRecord
}

function presentationFromCredential(credential: WalletCredential | DcqlPresentation): DcqlPresentation {
  if (typeof credential === 'string') {
    return credential
  }

  const credentialRecord = asRecord(credential)

  return (
    credentialRecord.presentation ??
    credentialRecord.vpToken ??
    credentialRecord.credential ??
    credentialRecord.raw ??
    credential
  ) as DcqlPresentation
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function normalizeCredentialSetOptions(options: string[][] | string[]): string[][] {
  if (options.length === 0) {
    return []
  }

  return Array.isArray(options[0]) ? (options as string[][]) : (options as string[]).map((option) => [option])
}

function formatAliases(format: DcqlCredentialFormat): string[] {
  switch (format) {
    case 'vc+sd-jwt':
      return ['vc+sd-jwt', 'dc+sd-jwt', 'sdjwt', 'sd-jwt', 'sdjwtvcrecord']
    case 'mso_mdoc':
      return ['mso_mdoc', 'mdoc', 'mdocrecord']
    case 'jwt_vc_json':
      return ['jwt_vc_json', 'jwt-vc-json', 'jwtvc', 'w3ccredentialrecord']
    case 'ldp_vc':
      return ['ldp_vc', 'ldp-vc', 'ldpvc', 'w3ccredentialrecord']
    default:
      return [format]
  }
}
