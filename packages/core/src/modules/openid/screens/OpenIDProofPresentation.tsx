import { useAgent } from '@bifold/react-hooks'
import { StackScreenProps } from '@react-navigation/stack'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DeviceEventEmitter,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialIcons'

import CommonRemoveModal from '../../../components/modals/CommonRemoveModal'
import { EventTypes } from '../../../constants'
import ProofRequestAccept from '../../../screens/ProofRequestAccept'
import { useTheme } from '../../../contexts/theme'
import { ThemedText } from '../../../components/texts/ThemedText'
import { formatOpenIdProofRequest } from '../displayProof'
import { shareProof } from '../resolverProof'
import { useOpenIDCredentials } from '../context/OpenIDCredentialRecordProvider'
import { OpenIDCredentialRecord } from '../credentialRecord'
import { BifoldError } from '../../../types/error'
import { DeliveryStackParams, Screens, TabStacks } from '../../../types/navigators'
import { ModalUsage } from '../../../types/remove'
import { getCredentialForDisplay } from '../display'
import CredentialCardGen from '../../../components/misc/CredentialCardGen'
import OpenIDProofRequestHeader from '../features/OpenIDProofPresentation/components/OpenIDProofRequestHeader'
import OpenIDProofPresentationFooter from '../features/OpenIDProofPresentation/components/OpenIDProofRequestFooter'

import type {
  Agent,
  DcqlQueryResult,
  DcqlValidCredential,
  JsonObject,
  MdocNameSpaces,
} from '@credo-ts/core'
import {
  ClaimFormat,
  CredentialMultiInstanceUseMode,
} from '@credo-ts/core'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Props = StackScreenProps<DeliveryStackParams, Screens.OpenIDProofPresentation>

type SelectedCredentialsFormat = Record<string, { id: string; claimFormat: string }>

interface DisclosableClaim {
  key: string
  label: string
  value: string
  isRequired: boolean
  isTogglable: boolean
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatClaimLabel = (key: string): string => {
  if (!key) return ''
  return key
    .split(/[._]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' \u2794 ')
}

const formatClaimValue = (value: unknown): string => {
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

const isDcqlRequest = (credential: { dcql?: unknown }): boolean => !!credential.dcql

const formatDcqlClaimPath = (path: Array<string | number | null>): string =>
  path.filter((item) => item !== null).join('.')

const getDcqlClaimKey = (claim: Record<string, unknown>): string => {
  if (Array.isArray(claim.path)) {
    return formatDcqlClaimPath(claim.path as Array<string | number | null>)
  }
  const namespace = typeof claim.namespace === 'string' ? claim.namespace : undefined
  const claimName = typeof claim.claim_name === 'string' ? claim.claim_name : undefined
  return [namespace, claimName].filter(Boolean).join('.')
}

const getOptionalDcqlClaimKeys = (queryResult: DcqlQueryResult | undefined, credentialQueryId: string): Set<string> => {
  const query = queryResult?.credentials.find((credentialQuery) => credentialQuery.id === credentialQueryId)
  const claims = query?.claims ?? []
  return new Set(
    claims
      .map((claim) => claim as Record<string, unknown>)
      .filter((claim) => claim.required === false)
      .map(getDcqlClaimKey)
      .filter(Boolean),
  )
}

const getNestedValue = (value: unknown, path: string): unknown => {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object' || Array.isArray(acc)) return undefined
    return (acc as Record<string, unknown>)[key]
  }, value)
}

const getAttributeIcon = (key: string): string => {
  const k = key.toLowerCase()
  if (k.includes('name')) return 'person-outline'
  if (k.includes('birth') || k.includes('date')) return 'cake'
  if (k.includes('gender') || k.includes('sex')) return 'wc'
  if (k.includes('email')) return 'mail-outline'
  if (k.includes('phone') || k.includes('mobile')) return 'phone-iphone'
  if (k.includes('address') || k.includes('location') || k.includes('city') || k.includes('country')) return 'map'
  if (k.includes('over_') || k.includes('age')) return 'verified-user'
  if (k.includes('vct') || k.includes('type')) return 'fingerprint'
  return 'assignment'
}

export type DcqlShareEntry = {
  claimFormat: ClaimFormat
  credentialRecord: unknown
  disclosedPayload: unknown
  useMode: CredentialMultiInstanceUseMode
}

export const getDcqlClaimFormat = (validCredential: DcqlValidCredential): ClaimFormat => {
  if (validCredential.record.type === 'MdocRecord') return ClaimFormat.MsoMdoc
  if (validCredential.record.type === 'SdJwtVcRecord') return ClaimFormat.SdJwtDc
  return validCredential.record.firstCredential.claimFormat as ClaimFormat
}

export const buildFilteredDcqlCredentials = (
  queryResult: DcqlQueryResult,
  selectedCredentials: SelectedCredentialsFormat,
  selectedClaims: Record<string, boolean>,
): Record<string, DcqlShareEntry[]> => {
  const result: Record<string, DcqlShareEntry[]> = {}
  for (const [credentialQueryId, selected] of Object.entries(selectedCredentials)) {
    const match = queryResult.credential_matches[credentialQueryId]
    if (!match?.success) continue
    const validCredentials = Array.from(match.valid_credentials) as DcqlValidCredential[]
    const validCredential = validCredentials.find((vc) => vc.record.id === selected.id)
    if (!validCredential) continue
    const output = validCredential.claims.valid_claim_sets[0].output
    const recordType = validCredential.record.type
    let filteredDisclosedPayload: JsonObject | MdocNameSpaces

    console.log(
      `[buildFilteredDcqlCredentials] credentialQueryId="${credentialQueryId}", recordType="${recordType}", recordId="${validCredential.record.id}"`
    )
    console.log(
      `[buildFilteredDcqlCredentials] raw output (valid_claim_sets[0].output):\n${JSON.stringify(output, null, 2)}`
    )

    if (recordType === 'SdJwtVcRecord') {
      const flatOutput = output as Record<string, unknown>

      // Log: which claims are in output but NOT in selectedClaims
      const outputKeys = Object.keys(flatOutput)
      const checkedKeys = outputKeys.filter((key) => selectedClaims[key] === true)
      const uncheckedKeys = outputKeys.filter((key) => selectedClaims[key] !== true)
      console.log(
        `[buildFilteredDcqlCredentials] outputKeys: ${JSON.stringify(outputKeys)}`
      )
      console.log(
        `[buildFilteredDcqlCredentials] CHECKED (included): ${JSON.stringify(checkedKeys)}`
      )
      console.log(
        `[buildFilteredDcqlCredentials] UNCHECKED (excluded): ${JSON.stringify(uncheckedKeys)}`
      )

      filteredDisclosedPayload = Object.fromEntries(
        Object.entries(flatOutput).filter(([key]) => selectedClaims[key] === true),
      ) as JsonObject

      if (Object.keys(filteredDisclosedPayload).length === 0) {
        console.warn(
          `[buildFilteredDcqlCredentials] ⚠️ WARNING: filteredDisclosedPayload is EMPTY! No claims will be disclosed.`
        )
      }
    } else if (recordType === 'MdocRecord') {
      const namespaceOutput = output as Record<string, Record<string, unknown>>
      const filtered: Record<string, Record<string, unknown>> = {}
      for (const [namespace, claims] of Object.entries(namespaceOutput)) {
        const filteredClaims = Object.fromEntries(
          Object.entries(claims).filter(([key]) => {
            const flatKey = `${namespace}.${key}`
            return selectedClaims[flatKey] === true
          }),
        )
        if (Object.keys(filteredClaims).length > 0) filtered[namespace] = filteredClaims
      }
      filteredDisclosedPayload = filtered as MdocNameSpaces
    } else {
      // Generic fallback: filter output by selected claims for any record type
      const flatOutput = output as Record<string, unknown>
      filteredDisclosedPayload = Object.fromEntries(
        Object.entries(flatOutput).filter(([key]) => selectedClaims[key] === true),
      ) as JsonObject
    }
    result[credentialQueryId] = [{
      claimFormat: getDcqlClaimFormat(validCredential),
      credentialRecord: validCredential.record,
      disclosedPayload: filteredDisclosedPayload,
      useMode: CredentialMultiInstanceUseMode.NewOrFirst,
    }]
  }
  return result
}

export const handleDcqlShare = async (
  agent: Agent,
  requestRecord: { authorizationRequestPayload: Record<string, unknown>; dcql: { queryResult: DcqlQueryResult }; origin?: string },
  selectedCredentials: SelectedCredentialsFormat,
  selectedClaims: Record<string, boolean>,
) => {
  agent.config.logger.info(
    `[handleDcqlShare] selectedCredentials:\n${JSON.stringify(selectedCredentials, null, 2)}`
  )
  agent.config.logger.info(
    `[handleDcqlShare] selectedClaims (user-toggled):\n${JSON.stringify(selectedClaims, null, 2)}`
  )

  const dcqlCredentials = buildFilteredDcqlCredentials(requestRecord.dcql.queryResult, selectedCredentials, selectedClaims)

  agent.config.logger.info(
    `[handleDcqlShare] filtered dcqlCredentials (disclosedPayload sent to verifier):\n${JSON.stringify(dcqlCredentials, null, 2)}`
  )

  const submitPayload = {
    authorizationRequestPayload: requestRecord.authorizationRequestPayload,
    dcql: { credentials: dcqlCredentials },
    origin: requestRecord.origin,
  }
  agent.config.logger.info(
    `[handleDcqlShare] FULL payload to acceptOpenId4VpAuthorizationRequest:\n${JSON.stringify(submitPayload, null, 2)}`
  )
  const result = await agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest(submitPayload)

  agent.config.logger.info(
    `[handleDcqlShare] serverResponse status: ${result.serverResponse?.status}, body: ${JSON.stringify(result.serverResponse?.body)}`
  )

  const body = result.serverResponse?.body
  if (body && typeof body === 'object' && 'redirect_uri' in body && typeof (body as Record<string, unknown>).redirect_uri === 'string') {
    await Linking.openURL((body as Record<string, string>).redirect_uri)
  }
  if (result.serverResponse && (result.serverResponse.status < 200 || result.serverResponse.status > 299)) {
    throw new Error(`Error while accepting authorization request. ${JSON.stringify(result.serverResponse.body)}`)
  }
  return result
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                        */
/* ------------------------------------------------------------------ */

const SelectiveDisclosureOpenIDProofPresentation: React.FC<Props> = ({
  navigation,
  route: {
    params: { credential },
  },
}) => {
  const { t } = useTranslation()
  const { ColorPalette, TextTheme, Spacing, ListItems } = useTheme()
  const { agent } = useAgent()
  const { getCredentialById } = useOpenIDCredentials()

  const [declineModalVisible, setDeclineModalVisible] = useState(false)
  const [buttonsVisible, setButtonsVisible] = useState(true)
  const [acceptModalVisible, setAcceptModalVisible] = useState(false)
  const [showValues, setShowValues] = useState(false)

  // Selected credential per input descriptor
  const [selectedCredentials, setSelectedCredentials] = useState<SelectedCredentialsFormat | undefined>()

  // All available credentials fetched for display (used for switching)
  const [allCredentials, setAllCredentials] = useState<OpenIDCredentialRecord[]>([])
  const [credentialRecord, setCredentialRecord] = useState<OpenIDCredentialRecord | undefined>()

  // Claim rows
  const [claimRows, setClaimRows] = useState<DisclosableClaim[]>([])
  const [selectedClaims, setSelectedClaims] = useState<Record<string, boolean>>({})

  // Derived
  const isDcql = useMemo(() => (credential ? isDcqlRequest(credential) : false), [credential])

  const submission = useMemo(
    () => (credential ? formatOpenIdProofRequest(credential) : undefined),
    [credential],
  )

  const verifierName = useMemo(() => credential?.verifierHostName ?? '', [credential])

  // Find all credentials available across all entries
  const allAvailableCreds = useMemo(() => {
    if (!submission) return []
    const seen = new Set<string>()
    const creds: { id: string; claimFormat: string; credentialName?: string }[] = []
    for (const entry of submission.entries) {
      for (const c of entry.credentials) {
        if (!seen.has(c.id)) {
          seen.add(c.id)
          creds.push(c)
        }
      }
    }
    return creds
  }, [submission])

  const hasAltCredentials = allAvailableCreds.length > 1

  // Auto-select first credential per entry
  useEffect(() => {
    if (!submission) return
    const firstEntry = submission.entries[0]
    if (!firstEntry || firstEntry.credentials.length === 0) return
    const firstCred = firstEntry.credentials[0]
    setSelectedCredentials({ [firstEntry.inputDescriptorId]: { id: firstCred.id, claimFormat: firstCred.claimFormat } })
  }, [submission])

  // Fetch all available credential records
  useEffect(() => {
    if (!selectedCredentials || !agent) return
    const ids = allAvailableCreds.map((c) => c.id)
    Promise.all(ids.map((id) => getCredentialById(id))).then((records) => {
      const valid = records.filter(Boolean) as OpenIDCredentialRecord[]
      setAllCredentials(valid)
    })
  }, [selectedCredentials, agent, getCredentialById, allAvailableCreds])

  // Keep credentialRecord in sync with selectedCredentials
  useEffect(() => {
    if (allCredentials.length === 0) return
    const selectedId = Object.values(selectedCredentials ?? {})[0]?.id
    const found = allCredentials.find((c) => c.id === selectedId)
    setCredentialRecord(found ?? allCredentials[0])
  }, [allCredentials, selectedCredentials])

  // Compute claim rows from the current credential
  useEffect(() => {
    if (!submission || !selectedCredentials || !credentialRecord) return

    const entry = submission.entries[0]
    if (!entry) return
    const matchedEntry = entry.credentials.find((c) => c.id === credentialRecord.id)
    if (!matchedEntry) return

    const inputDescriptorId = entry.inputDescriptorId
    const display = getCredentialForDisplay(credentialRecord)
    const displayAttributes = display.attributes as Record<string, unknown> | undefined
    const requestedKeys = matchedEntry.requestedAttributes ?? (displayAttributes ? Object.keys(displayAttributes) : [])
    const optionalKeys = getOptionalDcqlClaimKeys(credential?.dcql?.queryResult, inputDescriptorId)
    const supportsClaimSelection = isDcql && (credentialRecord.type === 'SdJwtVcRecord' || credentialRecord.type === 'MdocRecord')

    const rows: DisclosableClaim[] = []
    for (const key of requestedKeys) {
      const rawValue = displayAttributes?.[key] ?? getNestedValue(displayAttributes, key)
      rows.push({
        key,
        label: formatClaimLabel(key),
        value: formatClaimValue(rawValue),
        isRequired: !optionalKeys.has(key),
        isTogglable: supportsClaimSelection,
      })
    }
    setClaimRows(rows)
    setSelectedClaims(Object.fromEntries(rows.map((r) => [r.key, false])))
  }, [submission, selectedCredentials, credentialRecord, isDcql, credential?.dcql?.queryResult])

  // Switch to a different credential
  const handleAltCredChange = useCallback((_inputDescriptorId: string, newCredId: string) => {
    if (!submission) return
    const entry = submission.entries[0]
    if (!entry) return
    const matched = entry.credentials.find((c) => c.id === newCredId)
    if (!matched) return
    // Reset selection/claims for the new credential
    setSelectedCredentials({ [entry.inputDescriptorId]: { id: matched.id, claimFormat: matched.claimFormat } })
    setClaimRows([])
    setSelectedClaims({})
  }, [submission])

  const toggleDecline = useCallback(() => setDeclineModalVisible((p) => !p), [])

  const handleClaimToggle = useCallback((claimKey: string, value: boolean) => {
    setSelectedClaims((prev) => ({ ...prev, [claimKey]: value }))
  }, [])

  const handleAccept = useCallback(async () => {
    if (!agent || !selectedCredentials || !submission) return
    setButtonsVisible(false)
    try {
      if (isDcql && credential?.dcql) {
        await handleDcqlShare(
          agent,
          credential as { authorizationRequestPayload: Record<string, unknown>; dcql: { queryResult: DcqlQueryResult }; origin?: string },
          selectedCredentials,
          selectedClaims,
        )
      } else {
        await shareProof({ agent, requestRecord: credential, selectedProofCredentials: selectedCredentials })
      }
      setAcceptModalVisible(true)
    } catch (err: unknown) {
      setButtonsVisible(true)
      const error = new BifoldError(t('Error.Title1027'), t('Error.Message1027'), (err as Error)?.message ?? err, 1027)
      DeviceEventEmitter.emit(EventTypes.ERROR_ADDED, error)
    }
  }, [agent, selectedCredentials, selectedClaims, isDcql, submission, credential, t])

  const handleDecline = useCallback(() => {
    toggleDecline()
  }, [toggleDecline])

  const handleDismiss = useCallback(() => {
    toggleDecline()
    navigation.getParent()?.navigate(TabStacks.HomeStack, { screen: Screens.Home })
  }, [toggleDecline, navigation])

  /* ---------- render ---------- */
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: ColorPalette.brand.primaryBackground,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: Spacing.lg,
    },
    cardContainer: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    claimSectionTitle: {
      color: ColorPalette.grayscale.mediumGrey,
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
    },
    privacyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    privacyLabel: {
      color: ColorPalette.brand.primary,
      fontSize: 13,
      fontWeight: '500',
      marginLeft: 4,
    },
  })

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OpenIDProofRequestHeader
          selectedCredentialsSubmission={selectedCredentials}
          verifierName={verifierName}
          reason={submission?.purpose ?? ''}
        />

        {/* Credential card + alternative credential picker */}
        <View style={styles.cardContainer}>
          <CredentialCardGen credential={credentialRecord} hasAltCredentials={hasAltCredentials} />
          {hasAltCredentials && (
            <View style={{ flex: 1, flexDirection: 'row-reverse', paddingTop: Spacing.sm }}>
              <Pressable
                onPress={() => {
                  const currentId = Object.values(selectedCredentials ?? {})[0]?.id
                  const currentIndex = allAvailableCreds.findIndex((c) => c.id === currentId)
                  const nextIndex = (currentIndex + 1) % allAvailableCreds.length
                  const nextCred = allAvailableCreds[nextIndex]
                  if (nextCred && submission) {
                    const entry = submission.entries[0]
                    if (entry) handleAltCredChange(entry.inputDescriptorId, nextCred.id)
                  }
                }}
              >
                <ThemedText style={ListItems.recordLink}>{t('ProofRequest.UseDifferentCard')}</ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        {/* Claim rows */}
        {claimRows.length > 0 && (
          <>
            <ThemedText style={styles.claimSectionTitle}>
              {t('ProofRequest.Attributes', 'Select which details to share')}
            </ThemedText>
            <View style={styles.privacyRow}>
              <TouchableOpacity
                onPress={() => setShowValues((p) => !p)}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Icon
                  name={showValues ? 'visibility-off' : 'visibility'}
                  size={18}
                  color={ColorPalette.brand.primary}
                />
                <ThemedText style={styles.privacyLabel}>
                  {showValues ? t('ProofRequest.HideValues', 'Hide values') : t('ProofRequest.ShowValues', 'Show values')}
                </ThemedText>
              </TouchableOpacity>
            </View>
            {claimRows.map((claim) => {
              const isChecked = selectedClaims[claim.key] ?? false
              const iconName = getAttributeIcon(claim.key)
              const displayValue = isChecked && !showValues ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : claim.value
              return (
                <TouchableOpacity
                  key={claim.key}
                  activeOpacity={claim.isTogglable ? 0.7 : 1}
                  onPress={() => {
                    if (claim.isTogglable) handleClaimToggle(claim.key, !isChecked)
                  }}
                  style={{
                    backgroundColor: ColorPalette.brand.secondaryBackground,
                    borderRadius: 12,
                    paddingHorizontal: Spacing.md,
                    paddingVertical: 14,
                    marginHorizontal: Spacing.md,
                    marginBottom: 10,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(128, 128, 128, 0.12)',
                    opacity: !claim.isTogglable ? 0.6 : isChecked ? 1 : 0.55,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <Icon name={iconName} size={20} color={TextTheme.normal.color ?? '#888'} />
                      <ThemedText style={{ ...TextTheme.bold, fontSize: 15, marginLeft: 8 }}>
                        {claim.label}
                      </ThemedText>
                      {claim.isRequired && (
                        <View
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            marginLeft: 8,
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: '700',
                              fontSize: 10,
                              color: '#EF4444',
                              letterSpacing: 0.3,
                            }}
                          >
                            {t('ProofRequest.Required', 'Required')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <ThemedText
                      style={{ ...TextTheme.normal, fontSize: 14, marginLeft: 30, marginTop: 2 }}
                      numberOfLines={2}
                    >
                      {displayValue}
                    </ThemedText>
                  </View>
                  {claim.isTogglable ? (
                    <Icon
                      name={isChecked ? 'check-circle' : 'radio-button-unchecked'}
                      size={26}
                      color={isChecked ? ColorPalette.brand.primary : ColorPalette.grayscale.lightGrey}
                      style={{ padding: 6 }}
                    />
                  ) : (
                    <Icon
                      name="lock-outline"
                      size={22}
                      color={ColorPalette.grayscale.mediumGrey}
                      style={{ padding: 6 }}
                    />
                  )}
                </TouchableOpacity>
              )
            })}
          </>
        )}
      </ScrollView>

      <OpenIDProofPresentationFooter
        buttonsVisible={buttonsVisible}
        credential={credential}
        onPressAccept={handleAccept}
        onPressDecline={handleDecline}
        onPressDismiss={handleDismiss}
        selectedCredentialsSubmission={selectedCredentials}
        submission={submission}
      />

      <CommonRemoveModal
        visible={declineModalVisible}
        usage={ModalUsage.ProofRequestDecline}
        onSubmit={handleDismiss}
        onCancel={toggleDecline}
      />

      <ProofRequestAccept visible={acceptModalVisible} confirmationOnly proofId="" />
    </SafeAreaView>
  )
}

export default SelectiveDisclosureOpenIDProofPresentation
