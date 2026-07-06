import { useAgent } from '@bifold/react-hooks'
import { StackScreenProps } from '@react-navigation/stack'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, Modal, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
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

import { useClaimSelection } from './hooks/useClaimSelection'
import type { DisclosableClaim } from './hooks/useClaimSelection'
import ClaimToggleList from './components/ClaimToggleList'
import { SectionHeader } from '../common'

type Props = StackScreenProps<DeliveryStackParams, Screens.OpenIDProofPresentation>

type SatisfiedCredentialsFormat = Record<string, Array<{ id: string; claimFormat: string }>>

type SelectedCredentialsFormat = Record<string, { id: string; claimFormat: string }>

const CustomOpenIDProofPresentation: React.FC<Props> = ({
  navigation,
  route: {
    params: { credential },
  },
}) => {
  const { TextTheme, ColorPalette, Spacing, ListItems } = useTheme()
  const { t, i18n } = useTranslation()
  const { agent } = useAgent()
  const { getCredentialById } = useOpenIDCredentials()

  // --- State ---
  const [declineModalVisible, setDeclineModalVisible] = useState(false)
  const [buttonsVisible, setButtonsVisible] = useState(true)
  const [acceptModalVisible, setAcceptModalVisible] = useState(false)
  const [showValues, setShowValues] = useState(false)
  const [rawCredentialVisible, setRawCredentialVisible] = useState(false)
  const [selectedRawCredential, setSelectedRawCredential] = useState<unknown>(null)
  const [credentials, setCredentials] = useState<OpenIDCredentialRecord[]>([])
  const [satisfiedSubmission, setSatisfiedSubmission] = useState<SatisfiedCredentialsFormat>()
  const [selectedSubmission, setSelectedSubmission] = useState<SelectedCredentialsFormat>()

  const {
    selectedClaims,
    handleClaimToggle,
    getDisclosedClaims,
    resetSelection,
  } = useClaimSelection()

  // --- Derived data ---
  const submission = useMemo(() => (credential ? formatOpenIdProofRequest(credential) : undefined), [credential])
  const verifierName = useMemo(() => credential?.verifierHostName ?? '', [credential])

  // --- Effects ---
  useEffect(() => {
    if (!submission) return
    const creds = Object.fromEntries(
      submission.entries.map((entry) => [
        entry.inputDescriptorId,
        entry.credentials.map((c) => ({ id: c.id, claimFormat: c.claimFormat })),
      ])
    )
    setSatisfiedSubmission(creds)
  }, [submission])

  useEffect(() => {
    if (!satisfiedSubmission) return
    const fetchCreds = async () => {
      const all: OpenIDCredentialRecord[] = []
      for (const credIDs of Object.values(satisfiedSubmission)) {
        for (const { id } of credIDs) {
          const rec = await getCredentialById(id)
          if (rec) all.push(rec)
        }
      }
      setCredentials(all)
    }
    fetchCreds()
  }, [satisfiedSubmission, getCredentialById])

  useEffect(() => {
    if (!satisfiedSubmission || credentials.length === 0) return
    setSelectedSubmission(
      Object.fromEntries(
        Object.entries(satisfiedSubmission).map(([id, creds]) => [
          id,
          { id: creds[0]?.id, claimFormat: creds[0]?.claimFormat },
        ])
      )
    )
  }, [satisfiedSubmission, credentials])

  // --- Handlers ---
  const toggleDecline = () => setDeclineModalVisible((p) => !p)

  const handleAccept = async () => {
    try {
      if (!agent || !selectedSubmission) return
      setButtonsVisible(false)

      const allKeys: string[] = submission?.entries.flatMap((entry) => {
        const selected = selectedSubmission[entry.inputDescriptorId]
        const credSub = entry.credentials.find((c) => c.id === selected?.id)
        return [...(credSub?.requestedAttributes ?? []), ...(credSub?.optionalAttributes ?? [])]
      }) ?? []

      const disclosedClaims = getDisclosedClaims(allKeys)

      const payload = Object.fromEntries(
        Object.entries(selectedSubmission).map(([id, cred]) => [id, { ...cred, disclosedClaims }])
      )

      await shareProof({ agent, requestRecord: credential, selectedProofCredentials: payload })
      setAcceptModalVisible(true)
    } catch (err: unknown) {
      setButtonsVisible(true)
      const error = new BifoldError(t('Error.Title1027'), t('Error.Message1027'), (err as Error)?.message ?? err, 1027)
      DeviceEventEmitter.emit(EventTypes.ERROR_ADDED, error)
    }
  }

  const handleDecline = () => toggleDecline()
  const handleDismiss = () => {
    toggleDecline()
    navigation.getParent()?.navigate(TabStacks.HomeStack, { screen: Screens.Home })
  }

  const handleCredChange = ({
    inputDescriptorID,
    id,
    claimFormat,
  }: {
    inputDescriptorID: string
    id: string
    claimFormat: string
  }) => {
    setSelectedSubmission((prev) => ({
      ...prev,
      [inputDescriptorID]: { id, claimFormat },
    }))
    resetSelection()
  }

  const handleAltCred = useCallback(
    (inputDescriptorID: string, selectedCredID: string) => {
      const entry = submission?.entries.find((e) => e.inputDescriptorId === inputDescriptorID)
      const creds = entry?.credentials
      if (!creds) return
      navigation.navigate(Screens.OpenIDProofCredentialSelect, {
        inputDescriptorID,
        selectedCredID,
        altCredIDs: creds.map((c) => ({ id: c.id, claimFormat: c.claimFormat })),
        onCredChange: handleCredChange,
      })
    },
    [submission, navigation]
  )

  const openRawCredential = useCallback((record: unknown) => {
    const extract = (r: unknown): unknown => {
      if (!r) return null
      const s = typeof (r as any).toJSON === 'function' ? (r as any).toJSON() : r
      if (s.credentials?.length) return s.credentials.length === 1 ? s.credentials[0] : s.credentials
      if (s.credential) return s.credential
      return s
    }
    setSelectedRawCredential(extract(record))
    setRawCredentialVisible(true)
  }, [])

  const isAttributeOptional = useCallback(
    (key: string): boolean => {
      if (!submission || !credential) return false

      if (credential?.presentationExchange?.definition) {
        for (const desc of credential.presentationExchange.definition.input_descriptors) {
          const field = desc.constraints?.fields?.find((f: any) => {
            if (!Array.isArray(f.path)) return false
            return f.path.some((p: string) => p.replace(/^\$\./, '').split('.')[0] === key.split('.')[0])
          })
          if (field) return field.optional === true
        }
      }

      if (credential?.dcql?.queryResult) {
        for (const credQuery of Object.values(credential.dcql.queryResult.credentials) as Array<{ claims?: Array<{ path?: (string | number | null)[] }> }>) {
          const claim = (credQuery.claims ?? []).find((c: any) => {
            if (!Array.isArray(c.path)) return false
            return c.path.some((p: string) => p.replace(/^\$\./, '').split('.')[0] === key.split('.')[0])
          })
          if (claim) return (claim as any).required === false
        }
      }
      return false
    },
    [submission, credential]
  )

  // --- Styles ---
  const styles = StyleSheet.create({
    flex: { flexGrow: 1 },
    headerBar: {
      paddingVertical: 16,
      alignItems: 'center',
      backgroundColor: ColorPalette.brand.primaryBackground,
    },
    headerWrap: { paddingHorizontal: 16, paddingTop: 8 },
    cardWrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    detailWrap: { paddingHorizontal: Spacing.md, marginBottom: 8 },
    list: { marginTop: 8 },
    rowReverse: { flex: 1, flexDirection: 'row-reverse', paddingTop: Spacing.sm },
    modalContainer: { flex: 1, backgroundColor: ColorPalette.brand.primaryBackground },
    modalHeader: {
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: ColorPalette.brand.secondaryBackground,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalClose: { padding: 4 },
    modalContent: { flex: 1, padding: Spacing.md },
    monoText: { ...TextTheme.normal, fontSize: 12, fontFamily: 'monospace' },
  })

  if (!submission || !selectedSubmission) return null

  return (
    <ScreenLayout screen={Screens.OpenIDProofPresentation}>
      {/* Header */}
      <View style={styles.headerBar}>
        <ThemedText variant="headerTitle">{t('ProofRequest.OID4VCTitle', 'Information Request')}</ThemedText>
      </View>

      <ScrollView>
        <View style={styles.flex}>
          <View style={styles.headerWrap}>
            <OpenIDProofRequestHeader
              selectedCredentialsSubmission={selectedSubmission}
              verifierName={verifierName}
              reason={submission?.purpose ?? ''}
            />
          </View>

          <View style={styles.list}>
            {Object.entries(selectedSubmission).map(([inputDescriptorId, credSimplified]) => {
              const corrSub = submission?.entries.find((s) => s.inputDescriptorId === inputDescriptorId)
              const isSatisfied = corrSub?.isSatisfied
              const credSub = corrSub?.credentials.find((s) => s.id === credSimplified.id)
              const reqAttrs = credSub?.requestedAttributes
              const optAttrs = credSub?.optionalAttributes
              const extraOptSet = new Set(optAttrs ?? [])
              const hasMulti = (corrSub?.credentials.length ?? 0) > 1

              const credRec = credentials.find((c) => c.id === credSub?.id)
              if (!credRec || !corrSub) return null

              const display = getCredentialForDisplay(credRec)
              const allFieldKeys = [...(reqAttrs ?? []), ...(optAttrs ?? [])]
              const allFields = allFieldKeys
                .filter((k) => k !== 'status' && k !== 'status_list')
                .map((k) => {
                  const attr = getAttributeField(display, k, i18n.language)
                  return attr ? { field: attr.field, key: attr.attribute_name } : null
                })
                .filter(Boolean) as Array<{ field: { label?: string; value: unknown }; key: string }>

              const disclosableClaims: DisclosableClaim[] = allFields.map((item) => ({
                ...item,
                isRequired: !isAttributeOptional(item.key) && !extraOptSet.has(item.key),
              }))

              return (
                <View key={credSimplified.id}>
                  {/* Credential Card */}
                  <TouchableOpacity activeOpacity={0.8} onPress={() => openRawCredential(credRec)}>
                    <View style={styles.cardWrap}>
                      {isSatisfied && reqAttrs && (
                        <CredentialCardGen credential={credRec} hasAltCredentials={hasMulti} />
                      )}
                      {hasMulti && (
                        <View style={styles.rowReverse}>
                          <Pressable onPress={() => handleAltCred(corrSub.inputDescriptorId, credRec.id)}>
                            <ThemedText style={ListItems.recordLink}>
                              {t('ProofRequest.UseDifferentCard')}
                            </ThemedText>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Section: Data to Share */}
                  <SectionHeader
                    icon="verified-user"
                    title={t('ProofRequest.ShareDataTitle', 'Data to Share')}
                    subtitle={t(
                      'ProofRequest.ShareDataSubtitle',
                      'Select the information you want to share with the verifier.'
                    )}
                    action={{
                      icon: showValues ? 'visibility-off' : 'visibility',
                      label: showValues ? t('Global.Hide', 'Hide') : t('Global.Show', 'Show'),
                      onPress: () => setShowValues((p) => !p),
                    }}
                  />

                  <ClaimToggleList
                    claims={disclosableClaims}
                    selectedClaims={selectedClaims}
                    showValues={showValues}
                    onToggleClaim={handleClaimToggle}
                  />
                </View>
              )
            })}
          </View>
        </View>
      </ScrollView>

      {/* Raw Credential Modal */}
      <Modal
        visible={rawCredentialVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRawCredentialVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText style={{ ...TextTheme.bold, fontSize: 18 }}>Raw Credential</ThemedText>
            <TouchableOpacity onPress={() => setRawCredentialVisible(false)} style={styles.modalClose}>
              <Icon name="close" size={24} color={TextTheme.normal.color ?? '#888'} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <ThemedText style={styles.monoText}>
              {selectedRawCredential ? JSON.stringify(selectedRawCredential, null, 2) : ''}
            </ThemedText>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Footer */}
      <OpenIDProofPresentationFooter
        buttonsVisible={buttonsVisible}
        credential={credential}
        onPressAccept={handleAccept}
        onPressDecline={handleDecline}
        onPressDismiss={handleDismiss}
        selectedCredentialsSubmission={selectedSubmission}
        submission={submission}
      />

      <ProofRequestAccept visible={acceptModalVisible} proofId="" confirmationOnly />
      <CommonRemoveModal
        usage={ModalUsage.ProofRequestDecline}
        visible={declineModalVisible}
        onSubmit={handleDismiss}
        onCancel={toggleDecline}
      />
    </ScreenLayout>
  )
}

export default CustomOpenIDProofPresentation
