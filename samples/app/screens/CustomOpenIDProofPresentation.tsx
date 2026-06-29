import { useAgent } from '@bifold/react-hooks'
import { StackScreenProps } from '@react-navigation/stack'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, StyleSheet, View, ScrollView, TouchableOpacity, Text, Modal, SafeAreaView } from 'react-native'
import startCase from 'lodash.startcase'
import Icon from 'react-native-vector-icons/MaterialIcons'

import CommonRemoveModal from '@bifold/core/src/components/modals/CommonRemoveModal'
import { EventTypes } from '@bifold/core/src/constants'
import ScreenLayout from '@bifold/core/src/layout/ScreenLayout'
import ProofRequestAccept from '@bifold/core/src/screens/ProofRequestAccept'
import { useTheme } from '@bifold/core/src/contexts/theme'
import { formatOpenIdProofRequest } from '@bifold/core/src/modules/openid/displayProof'
import { shareProof } from '@bifold/core/src/modules/openid/resolverProof'
import { useOpenIDCredentials } from '@bifold/core/src/modules/openid/context/OpenIDCredentialRecordProvider'
import { OpenIDCredentialRecord } from '@bifold/core/src/modules/openid/credentialRecord'
import { BifoldError } from '@bifold/core/src/types/error'
import { DeliveryStackParams, Screens, TabStacks } from '@bifold/core/src/types/navigators'
import { ModalUsage } from '@bifold/core/src/types/remove'
import OpenIDProofRequestHeader from '@bifold/core/src/modules/openid/features/OpenIDProofPresentation/components/OpenIDProofRequestHeader'
import OpenIDProofPresentationFooter from '@bifold/core/src/modules/openid/features/OpenIDProofPresentation/components/OpenIDProofRequestFooter'
import CredentialCardGen from '@bifold/core/src/components/misc/CredentialCardGen'
import { ThemedText } from '@bifold/core/src/components/texts/ThemedText'
import { getCredentialForDisplay } from '@bifold/core/src/modules/openid/display'
import { getAttributeField } from '@bifold/core/src/utils/oca'
import { Pressable } from 'react-native'

type Props = StackScreenProps<DeliveryStackParams, Screens.OpenIDProofPresentation>

type SatisfiedCredentialsFormat = {
  [inputDescriptorId: string]: {
    id: string
    claimFormat: string
  }[]
}

type SelectedCredentialsFormat = {
  [inputDescriptorId: string]: {
    id: string
    claimFormat: string
  }
}

const CustomOpenIDProofPresentation: React.FC<Props> = ({
  navigation,
  route: {
    params: { credential },
  },
}: Props) => {
  const { ListItems, Spacing, ColorPalette, TextTheme } = useTheme()
  const { t, i18n } = useTranslation()
  const { agent } = useAgent()
  const { getCredentialById } = useOpenIDCredentials()

  const [declineModalVisible, setDeclineModalVisible] = useState(false)
  const [buttonsVisible, setButtonsVisible] = useState(true)
  const [acceptModalVisible, setAcceptModalVisible] = useState(false)
  const [showValues, setShowValues] = useState<boolean>(false)
  const [rawCredentialVisible, setRawCredentialVisible] = useState<boolean>(false)
  const [selectedRawCredential, setSelectedRawCredential] = useState<any>(null)
  const [credentialsRequested, setCredentialsRequested] = useState<Array<OpenIDCredentialRecord>>([])
  const [satistfiedCredentialsSubmission, setSatistfiedCredentialsSubmission] = useState<SatisfiedCredentialsFormat>()
  const [selectedCredentialsSubmission, setSelectedCredentialsSubmission] = useState<SelectedCredentialsFormat>()

  // Map of originalClaimName -> boolean (true: send, false: do not send)
  const [selectedClaims, setSelectedClaims] = useState<Record<string, boolean>>({})

  const submission = useMemo(() => (credential ? formatOpenIdProofRequest(credential) : undefined), [credential])

  // Build satisfied credentials submission map
  useEffect(() => {
    if (!submission) return
    const creds = submission.entries.reduce((acc: SatisfiedCredentialsFormat, entry) => {
      acc[entry.inputDescriptorId] = entry.credentials.map((cred) => ({
        id: cred.id,
        claimFormat: cred.claimFormat,
      }))
      return acc
    }, {})
    setSatistfiedCredentialsSubmission(creds)
  }, [submission])

  // Fetch all credentials satisfying the request
  useEffect(() => {
    async function fetchCreds() {
      if (!satistfiedCredentialsSubmission) return
      const creds: Array<OpenIDCredentialRecord> = []
      for (const [inputDescriptorID, credIDs] of Object.entries(satistfiedCredentialsSubmission)) {
        for (const { id } of credIDs) {
          const cred = await getCredentialById(id)
          if (cred && inputDescriptorID) creds.push(cred)
        }
      }
      setCredentialsRequested(creds)
    }
    fetchCreds()
  }, [satistfiedCredentialsSubmission, getCredentialById])

  // Auto-select first credential for each input descriptor
  useEffect(() => {
    if (!satistfiedCredentialsSubmission || credentialsRequested?.length <= 0) return
    const creds = Object.entries(satistfiedCredentialsSubmission).reduce(
      (acc: SelectedCredentialsFormat, [inputDescriptorId, credentials]) => {
        acc[inputDescriptorId] = {
          id: credentials[0]?.id,
          claimFormat: credentials?.[0]?.claimFormat,
        }
        return acc
      },
      {}
    )
    setSelectedCredentialsSubmission(creds)
  }, [satistfiedCredentialsSubmission, credentialsRequested])

  const verifierName = useMemo(() => credential?.verifierHostName ?? '', [credential])

  const toggleDeclineModalVisible = () => setDeclineModalVisible(!declineModalVisible)

  const handleClaimToggle = (claimName: string, value: boolean) => {
    setSelectedClaims((prev) => ({ ...prev, [claimName]: value }))
  }

  const handleAcceptTouched = async () => {
    try {
      if (!agent || !selectedCredentialsSubmission) return
      setButtonsVisible(false)

      // Get all requested keys for the selected credentials and filter out those explicitly set to false
      const allKeys = submission.entries.flatMap((entry) => {
        const selectedCred = selectedCredentialsSubmission[entry.inputDescriptorId]
        const credentialSubmission = entry.credentials.find((s) => s.id === selectedCred?.id)
        return credentialSubmission?.requestedAttributes ?? []
      })
      const disclosedClaims = allKeys.filter((key) => selectedClaims[key] !== false)

      // Inject selected claim names into submission
      const selectedWithDisclosed = Object.fromEntries(
        Object.entries(selectedCredentialsSubmission).map(([id, cred]) => [
          id,
          { ...cred, disclosedClaims: disclosedClaims.length ? disclosedClaims : undefined },
        ])
      )

      await shareProof({
        agent,
        requestRecord: credential,
        selectedProofCredentials: selectedWithDisclosed,
      })
      setAcceptModalVisible(true)
    } catch (err: unknown) {
      setButtonsVisible(true)
      const error = new BifoldError(t('Error.Title1027'), t('Error.Message1027'), (err as Error)?.message ?? err, 1027)
      DeviceEventEmitter.emit(EventTypes.ERROR_ADDED, error)
    }
  }

  const handleDeclineTouched = () => toggleDeclineModalVisible()

  const handleDismiss = async () => {
    toggleDeclineModalVisible()
    navigation.getParent()?.navigate(TabStacks.HomeStack, { screen: Screens.Home })
  }

  const onCredChange = ({
    inputDescriptorID,
    id,
    claimFormat,
  }: {
    inputDescriptorID: string
    id: string
    claimFormat: string
  }) => {
    setSelectedCredentialsSubmission((prev) => ({
      ...prev,
      [inputDescriptorID]: { id, claimFormat },
    }))
    setSelectedClaims({})
  }

  const handleAltCredChange = useCallback(
    (inputDescriptorID: string, selectedCredID: string) => {
      const submissionEntries = submission?.entries.find((entry) => entry.inputDescriptorId === inputDescriptorID)
      const credsForEntry = submissionEntries?.credentials
      if (!credsForEntry) return

      navigation.navigate(Screens.OpenIDProofCredentialSelect, {
        inputDescriptorID,
        selectedCredID,
        altCredIDs: credsForEntry.map((cred) => ({ id: cred.id, claimFormat: cred.claimFormat })),
        onCredChange,
      })
    },
    [submission, navigation]
  )

  const formatLabel = (key: string, label?: string) => {
    if (label) return label
    if (key.includes('.')) {
      return key
        .split('.')
        .map((part) => startCase(part))
        .join(' ➔ ')
    }
    return startCase(key)
  }

  // Returns a nice icon based on the attribute name
  const getAttributeIcon = (key: string) => {
    const k = key.toLowerCase()
    if (k.includes('name')) return 'person-outline'
    if (k.includes('birth') || k.includes('date')) return 'cake'
    if (k.includes('gender') || k.includes('sex')) return 'wc'
    if (k.includes('email')) return 'mail-outline'
    if (k.includes('phone') || k.includes('mobile')) return 'phone-iphone'
    if (k.includes('address') || k.includes('location') || k.includes('city') || k.includes('country')) return 'map'
    if (k.includes('nested') || k.includes('key')) return 'dns'
    if (k.includes('vct') || k.includes('type')) return 'fingerprint'
    return 'assignment'
  }

  // Detects if a field key is marked optional in PEX or DCQL
  const isAttributeOptional = useCallback(
    (key: string): boolean => {
      if (!submission) return false

      // Check in PEX Definition
      if (credential?.presentationExchange?.definition) {
        const inputDescriptors = credential.presentationExchange.definition.input_descriptors
        for (const desc of inputDescriptors) {
          const field = desc.constraints?.fields?.find((f: any) => {
            if (!Array.isArray(f.path)) return false
            return f.path.some((p: string) => p.replace(/^\$\./, '').split('.')[0] === key.split('.')[0])
          })
          if (field) {
            return field.optional === true
          }
        }
      }

      // Check in DCQL Query
      if (credential?.dcql?.queryResult) {
        const query = credential.dcql.queryResult
        for (const [_, credQuery] of Object.entries(query.credentials)) {
          const claim = credQuery.claims?.find((c: any) => {
            if (!Array.isArray(c.path)) return false
            return c.path.some((p: string) => p.replace(/^\$\./, '').split('.')[0] === key.split('.')[0])
          })
          if (claim) {
            return claim.optional === true
          }
        }
      }

      return false
    },
    [submission, credential]
  )

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'object') {
      const extractLeafValues = (obj: any): string[] => {
        let vals: string[] = []
        for (const k in obj) {
          if (typeof obj[k] === 'object' && obj[k] !== null) {
            vals = vals.concat(extractLeafValues(obj[k]))
          } else {
            vals.push(String(obj[k]))
          }
        }
        return vals
      }
      return extractLeafValues(value).join(', ') || '-'
    }
    return String(value)
  }

  const styles = StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: ColorPalette.brand.primaryBackground,
      paddingBottom: 40,
    },
    headerContainer: {
      paddingVertical: 16,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: ColorPalette.brand.primaryBackground,
    },
    requestHeaderWrapper: {
      paddingHorizontal: 16, // Adds necessary spacing around the verifier header
      paddingTop: 8,
    },
    cardContainer: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 24,
      paddingBottom: 4,
    },
    sectionTitle: {
      ...TextTheme.bold,
      fontSize: 18,
      marginLeft: 8,
    },
    sectionSubtitle: {
      ...TextTheme.normal,
      fontSize: 14,
      paddingHorizontal: 16,
      marginBottom: 16,
      lineHeight: 20,
      opacity: 0.8,
    },
    groupTitle: {
      ...TextTheme.bold,
      fontSize: 15,
      paddingHorizontal: 16,
      marginTop: 16,
      marginBottom: 10,
    },
    detailContainer: {
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    attributeCard: {
      backgroundColor: ColorPalette.brand.secondaryBackground,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 16,
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(128, 128, 128, 0.15)', // Soft adaptive border
    },
    attributeCardDisabled: {
      backgroundColor: ColorPalette.brand.secondaryBackground,
      opacity: 0.7, 
    },
    attributeInfo: {
      flex: 1,
      paddingRight: 12,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    attributeLabel: {
      ...TextTheme.bold,
      fontSize: 15,
      marginLeft: 8,
    },
    badgeRequired: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)', // Transparent red
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
    },
    badgeRequiredText: {
      ...TextTheme.bold,
      fontSize: 10,
      color: '#EF4444',
    },
    badgeOptional: {
      backgroundColor: 'rgba(156, 163, 175, 0.15)', // Transparent gray
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
    },
    badgeOptionalText: {
      ...TextTheme.bold,
      fontSize: 10,
      color: '#9CA3AF',
    },
    attributeValue: {
      ...TextTheme.normal,
      fontSize: 14,
      marginLeft: 28, // Aligns under the label text
      opacity: 0.8,
    },
    checkboxContainer: {
      padding: 4,
    },
    credentialsList: {
      marginTop: 8,
      justifyContent: 'space-between',
    },
  })

  return (
    <ScreenLayout screen={Screens.OpenIDProofPresentation}>
      <View style={styles.headerContainer}>
        <Text style={TextTheme.headerTitle}>
          {t('ProofRequest.OID4VCTitle', 'Information Request')}
        </Text>
      </View>

      <ScrollView>
        <View style={styles.container}>
          <View style={styles.requestHeaderWrapper}>
            <OpenIDProofRequestHeader
              selectedCredentialsSubmission={selectedCredentialsSubmission}
              verifierName={verifierName}
              reason={submission?.purpose ?? ''}
            />
          </View>

          {selectedCredentialsSubmission && submission && (
            <View style={styles.credentialsList}>
              {Object.entries(selectedCredentialsSubmission).map(([inputDescriptorId, credentialSimplified]) => {
                const correspondingSubmission = submission.entries?.find((s) => s.inputDescriptorId === inputDescriptorId)
                const isSatisfied = correspondingSubmission?.isSatisfied
                const credentialSubmission = correspondingSubmission?.credentials.find((s) => s.id === credentialSimplified.id)
                const requestedAttributes = credentialSubmission?.requestedAttributes
                const hasMultipleCreds = correspondingSubmission?.credentials ? correspondingSubmission.credentials.length > 1 : false

                const credentialRecord = credentialsRequested.find((c) => c.id === credentialSubmission?.id)
                if (!credentialRecord || !correspondingSubmission) return null

                const credentialDisplay = getCredentialForDisplay(credentialRecord)

                const allFields = (requestedAttributes ?? [])
                  .filter((key) => key !== 'status' && key !== 'status_list')
                  .map((key) => {
                    const attrField = getAttributeField(credentialDisplay, key, i18n.language)
                    return attrField ? { field: attrField.field, key: attrField.attribute_name } : null
                  })
                  .filter((f) => f !== null) as Array<{ field: any; key: string }>

                allFields.forEach((item) => {
                  if (selectedClaims[item.key] === undefined) {
                    selectedClaims[item.key] = true
                  }
                })

                const requiredFields = allFields.filter((item) => !isAttributeOptional(item.key))
                const optionalFields = allFields.filter((item) => isAttributeOptional(item.key))

                return (
                  <View key={credentialSimplified.id}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedRawCredential(credentialRecord)
                        setRawCredentialVisible(true)
                      }}
                    >
                      <View style={styles.cardContainer}>
                        {isSatisfied && requestedAttributes && (
                          <CredentialCardGen credential={credentialRecord} hasAltCredentials={hasMultipleCreds} />
                        )}
                        {hasMultipleCreds && (
                          <View style={{ flex: 1, flexDirection: 'row-reverse', paddingTop: Spacing.sm }}>
                            <Pressable onPress={() => handleAltCredChange(correspondingSubmission.inputDescriptorId, credentialRecord.id)}>
                              <ThemedText style={ListItems.recordLink}>{t('ProofRequest.UseDifferentCard')}</ThemedText>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>

                    <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Icon name="verified-user" size={24} color={ColorPalette.brand.primary} />
                        <ThemedText style={styles.sectionTitle}>
                          {t('ProofRequest.ShareDataTitle', 'Data to Share')}
                        </ThemedText>
                      </View>
                      <TouchableOpacity onPress={() => setShowValues(!showValues)} style={{ flexDirection: 'row', alignItems: 'center', padding: 4 }}>
                        <Icon name={showValues ? 'visibility-off' : 'visibility'} size={20} color={TextTheme.normal.color || '#888'} />
                        <ThemedText style={{ ...TextTheme.normal, marginLeft: 4 }}>
                          {showValues ? t('Global.Hide', 'Hide') : t('Global.Show', 'Show')}
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                    <ThemedText style={styles.sectionSubtitle}>
                      {t('ProofRequest.ShareDataSubtitle', 'Verify and select the information you want to share with the verifier.')}
                    </ThemedText>

                    {requiredFields.length > 0 && (
                      <View>
                        <ThemedText style={styles.groupTitle}>
                          {t('ProofRequest.RequiredAttributes', 'Required')}
                        </ThemedText>
                        <View style={styles.detailContainer}>
                          {requiredFields.map((item, index) => {
                            const rawValue = item.field.value
                            let displayValue = formatValue(rawValue)
                            if (!showValues && displayValue !== '-') {
                              displayValue = '••••••••'
                            }
                            const labelText = formatLabel(item.key, item.field.label)
                            const iconName = getAttributeIcon(item.key)

                            return (
                              <View key={item.key || index} style={[styles.attributeCard, styles.attributeCardDisabled]}>
                                <View style={styles.attributeInfo}>
                                  <View style={styles.labelRow}>
                                    <Icon name={iconName} size={20} color={TextTheme.normal.color || '#888'} />
                                    <ThemedText style={styles.attributeLabel}>
                                      {labelText}
                                    </ThemedText>
                                    <View style={styles.badgeRequired}>
                                      <Text style={styles.badgeRequiredText}>
                                        {t('ProofRequest.RequiredBadge', 'Required')}
                                      </Text>
                                    </View>
                                  </View>
                                  <ThemedText style={styles.attributeValue}>
                                    {displayValue}
                                  </ThemedText>
                                </View>
                                <View style={styles.checkboxContainer}>
                                  <Icon
                                    name="check-circle"
                                    size={24}
                                    color={ColorPalette.brand.primary}
                                  />
                                </View>
                              </View>
                            )
                          })}
                        </View>
                      </View>
                    )}

                    {optionalFields.length > 0 && (
                      <View>
                        <ThemedText style={styles.groupTitle}>
                          {t('ProofRequest.OptionalAttributes', 'Optional')}
                        </ThemedText>
                        <View style={styles.detailContainer}>
                          {optionalFields.map((item, index) => {
                            const isChecked = selectedClaims[item.key] !== false
                            const rawValue = item.field.value
                            let displayValue = isChecked ? formatValue(rawValue) : '-'
                            if (isChecked && !showValues && displayValue !== '-') {
                              displayValue = '••••••••'
                            }
                            const labelText = formatLabel(item.key, item.field.label)
                            const iconName = getAttributeIcon(item.key)

                            return (
                              <View key={item.key || index} style={styles.attributeCard}>
                                <View style={styles.attributeInfo}>
                                  <View style={styles.labelRow}>
                                    <Icon name={iconName} size={20} color={TextTheme.normal.color || '#888'} />
                                    <ThemedText style={styles.attributeLabel}>
                                      {labelText}
                                    </ThemedText>
                                  </View>
                                  <ThemedText style={styles.attributeValue}>
                                    {displayValue}
                                  </ThemedText>
                                </View>
                                <TouchableOpacity
                                  onPress={() => handleClaimToggle(item.key, !isChecked)}
                                  style={styles.checkboxContainer}
                                  accessibilityRole="checkbox"
                                  accessibilityState={{ checked: isChecked }}
                                >
                                  <Icon
                                    name={isChecked ? 'check-circle' : 'radio-button-unchecked'}
                                    size={24}
                                    color={isChecked ? ColorPalette.brand.primary : TextTheme.normal.color || '#888'}
                                  />
                                </TouchableOpacity>
                              </View>
                            )
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={rawCredentialVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRawCredentialVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: ColorPalette.brand.primaryBackground }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: ColorPalette.brand.border || 'rgba(128,128,128,0.2)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText style={{ ...TextTheme.bold, fontSize: 18 }}>
              Raw Credential
            </ThemedText>
            <TouchableOpacity onPress={() => setRawCredentialVisible(false)} style={{ padding: 4 }}>
              <Icon name="close" size={24} color={TextTheme.normal.color || '#888'} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <ThemedText style={{ ...TextTheme.normal, fontSize: 12, fontFamily: 'monospace' }}>
              {selectedRawCredential ? JSON.stringify(selectedRawCredential, null, 2) : ''}
            </ThemedText>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 3. Footer */}
      <OpenIDProofPresentationFooter
        buttonsVisible={buttonsVisible}
        credential={credential}
        onPressAccept={handleAcceptTouched}
        onPressDecline={handleDeclineTouched}
        onPressDismiss={handleDismiss}
        selectedCredentialsSubmission={selectedCredentialsSubmission}
        submission={submission}
      />

      <ProofRequestAccept visible={acceptModalVisible} proofId={''} confirmationOnly={true} />
      <CommonRemoveModal
        usage={ModalUsage.ProofRequestDecline}
        visible={declineModalVisible}
        onSubmit={handleDismiss}
        onCancel={toggleDeclineModalVisible}
      />
    </ScreenLayout>
  )
}

export default CustomOpenIDProofPresentation
