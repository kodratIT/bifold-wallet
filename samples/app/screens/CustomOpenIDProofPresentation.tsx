import { useAgent } from '@bifold/react-hooks'
import { StackScreenProps } from '@react-navigation/stack'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, StyleSheet, Switch, Text, View } from 'react-native'

import CommonRemoveModal from '@bifold/core/src/components/modals/CommonRemoveModal'
import { EventTypes } from '@bifold/core/src/constants'
import ScreenLayout from '@bifold/core/src/layout/ScreenLayout'
import ProofRequestAccept from '@bifold/core/src/screens/ProofRequestAccept'
import { useTheme } from '@bifold/core/src/contexts/theme'
import { extractDcqlClaimInfo, formatOpenIdProofRequest } from '@bifold/core/src/modules/openid/displayProof'
import { shareProof } from '@bifold/core/src/modules/openid/resolverProof'
import { useOpenIDCredentials } from '@bifold/core/src/modules/openid/context/OpenIDCredentialRecordProvider'
import { OpenIDCredentialRecord } from '@bifold/core/src/modules/openid/credentialRecord'
import { BifoldError } from '@bifold/core/src/types/error'
import { DeliveryStackParams, Screens, TabStacks } from '@bifold/core/src/types/navigators'
import { ModalUsage } from '@bifold/core/src/types/remove'

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

// ─── Sub-component: Individual toggle row for an optional claim ───────────────

interface ClaimToggleItemProps {
  label: string
  index: number
  isSelected: boolean
  onToggle: (index: number, value: boolean) => void
}

const ClaimToggleItem: React.FC<ClaimToggleItemProps> = ({ label, index, isSelected, onToggle }) => {
  const { TextTheme } = useTheme()
  return (
    <View style={styles.claimRow}>
      <Text style={[TextTheme.normal, styles.claimLabel]}>{label}</Text>
      <Switch value={isSelected} onValueChange={(v) => onToggle(index, v)} />
    </View>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CustomOpenIDProofPresentation: React.FC<Props> = ({
  navigation,
  route: {
    params: { credential },
  },
}: Props) => {
  const { TextTheme } = useTheme()
  const { t } = useTranslation()
  const { agent } = useAgent()
  const { getCredentialById } = useOpenIDCredentials()

  // Mirrors the default screen state pattern
  const [declineModalVisible, setDeclineModalVisible] = useState(false)
  const [buttonsVisible, setButtonsVisible] = useState(true)
  const [acceptModalVisible, setAcceptModalVisible] = useState(false)
  const [credentialsRequested, setCredentialsRequested] = useState<Array<OpenIDCredentialRecord>>([])
  const [satistfiedCredentialsSubmission, setSatistfiedCredentialsSubmission] = useState<SatisfiedCredentialsFormat>()
  const [selectedCredentialsSubmission, setSelectedCredentialsSubmission] = useState<SelectedCredentialsFormat>()

  // NEW: indexes of optional claims the user has toggled ON
  const [selectedClaimIndexes, setSelectedClaimIndexes] = useState<number[]>([])

  const submission = useMemo(() => (credential ? formatOpenIdProofRequest(credential) : undefined), [credential])

  // Claim info derived from DCQL query result (empty Map for PEX flow)
  const claimInfo = useMemo(() => {
    if (!credential?.dcql?.queryResult) return new Map<string, { requested: string[]; optional: string[] }>()
    return extractDcqlClaimInfo(credential.dcql.queryResult)
  }, [credential])

  // Build satisfied credentials map (same pattern as default screen)
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

  // Fetch credential records (same as default screen)
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

  // Auto-select first credential for each descriptor (same as default screen)
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

  const verifierName = useMemo(() => credential?.verifierHostName, [credential])

  const toggleDeclineModalVisible = () => setDeclineModalVisible(!declineModalVisible)

  const handleClaimToggle = (index: number, value: boolean) => {
    setSelectedClaimIndexes((prev) => (value ? [...prev, index] : prev.filter((i) => i !== index)))
  }

  const handleAcceptTouched = async () => {
    try {
      if (!agent || !selectedCredentialsSubmission) return

      // Inject claimIndexes for selective disclosure
      const selectedWithIndexes = Object.fromEntries(
        Object.entries(selectedCredentialsSubmission).map(([id, cred]) => [
          id,
          { ...cred, claimIndexes: selectedClaimIndexes.length ? selectedClaimIndexes : undefined },
        ])
      )

      await shareProof({
        agent,
        requestRecord: credential,
        selectedProofCredentials: selectedWithIndexes,
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
    // Reset claim indexes when credential changes
    setSelectedClaimIndexes([])
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

  return (
    <ScreenLayout screen={Screens.OpenIDProofPresentation}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={TextTheme.headerTitle}>{t('ProofRequest.OID4VCTitle')}</Text>
        {verifierName ? <Text style={[TextTheme.normal, styles.verifierName]}>{verifierName}</Text> : null}
      </View>

      {/* Claim sections per credential in submission */}
      {submission?.entries.map((entry) => {
        const info = claimInfo.get(entry.inputDescriptorId)
        // For DCQL flow: use extractDcqlClaimInfo result
        // For PEX flow (no DCQL): fall back to requestedAttributes from submission
        const requested = info?.requested?.length
          ? info.requested
          : (entry.credentials[0]?.requestedAttributes ?? [])
        const optional = info?.optional ?? []

        return (
          <View key={entry.inputDescriptorId} style={styles.credentialSection}>
            {/* Required Claims */}
            {requested.length > 0 && (
              <View style={styles.claimsSection}>
                <Text style={[TextTheme.label, styles.sectionTitle]}>{t('ProofRequest.RequiredClaims', 'Required Claims')}</Text>
                {requested.map((claim) => (
                  <View key={claim} style={styles.claimRow}>
                    <Text style={styles.lockIcon}>🔒</Text>
                    <Text style={[TextTheme.normal, styles.claimLabel]}>{claim}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Optional Claims — only shown when available (DCQL selective disclosure) */}
            {optional.length > 0 && (
              <View style={styles.claimsSection}>
                <Text style={[TextTheme.label, styles.sectionTitle]}>{t('ProofRequest.OptionalClaims', 'Optional Claims')}</Text>
                {optional.map((claim, index) => (
                  <ClaimToggleItem
                    key={claim}
                    label={claim}
                    index={index}
                    isSelected={selectedClaimIndexes.includes(index)}
                    onToggle={handleClaimToggle}
                  />
                ))}
              </View>
            )}
          </View>
        )
      })}

      {/* Footer Buttons */}
      {buttonsVisible && (
        <View style={styles.footer}>
          <View style={styles.buttonRow}>
            <Text
              style={[TextTheme.normal, styles.declineButton]}
              onPress={handleDeclineTouched}
              accessibilityRole="button"
            >
              {t('Global.Decline', 'Decline')}
            </Text>
            <Text
              style={[TextTheme.normal, styles.sendButton]}
              onPress={handleAcceptTouched}
              accessibilityRole="button"
            >
              {t('Global.Send', 'Send')}
            </Text>
          </View>
        </View>
      )}

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

const styles = StyleSheet.create({
  headerContainer: {
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifierName: {
    marginTop: 4,
    opacity: 0.7,
  },
  credentialSection: {
    marginBottom: 16,
  },
  claimsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 8,
    fontWeight: '600',
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  lockIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  claimLabel: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  declineButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    color: '#666',
  },
  sendButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    fontWeight: '600',
  },
})

export default CustomOpenIDProofPresentation
