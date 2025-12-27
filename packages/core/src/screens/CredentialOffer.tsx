import { CredentialPreviewAttribute } from '@credo-ts/core'
import { useCredentialById } from '@credo-ts/react-hooks'
import { BrandingOverlay, MetaOverlay } from '@bifold/oca'
import { Attribute, CredentialOverlay } from '@bifold/oca/build/legacy'
import { useIsFocused } from '@react-navigation/native'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, DeviceEventEmitter, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import Button, { ButtonType } from '../components/buttons/Button'
import ConnectionImage from '../components/misc/ConnectionImage'
import CredentialCard from '../components/misc/CredentialCard'
import CommonRemoveModal from '../components/modals/CommonRemoveModal'
import Record from '../components/record/Record'
import { EventTypes } from '../constants'
import { TOKENS, useServices } from '../container-api'
import { useAnimatedComponents } from '../contexts/animated-components'
import { useNetwork } from '../contexts/network'
import { DispatchAction } from '../contexts/reducers/store'
import { useStore } from '../contexts/store'
import { useTheme } from '../contexts/theme'
import { useTour } from '../contexts/tour/tour-context'
import { useOutOfBandByConnectionId } from '../hooks/connections'
import { HistoryCardType, HistoryRecord } from '../modules/history/types'
import { BifoldError } from '../types/error'
import { Screens, TabStacks } from '../types/navigators'
import { ModalUsage } from '../types/remove'
import { useAppAgent } from '../utils/agent'
import {
  getCredentialIdentifiers,
  isValidAnonCredsCredential,
  ensureCredentialMetadata,
  getEffectiveCredentialName,
} from '../utils/credential'
import { useCredentialConnectionLabel } from '../utils/helpers'
import { buildFieldsFromAnonCredsCredential } from '../utils/oca'
import { testIdWithKey } from '../utils/testable'

import CredentialOfferAccept from './CredentialOfferAccept'
import { BaseTourID } from '../types/tour'
import { ThemedText } from '../components/texts/ThemedText'

type CredentialOfferProps = {
  navigation: any
  credentialId: string
}

const CredentialOffer: React.FC<CredentialOfferProps> = ({ navigation, credentialId }) => {
  const { agent } = useAppAgent()
  const { t, i18n } = useTranslation()
  const { ColorPalette } = useTheme()
  const { RecordLoading } = useAnimatedComponents()
  const { assertNetworkConnected } = useNetwork()
  const [
    bundleResolver,
    { enableTours: enableToursConfig },
    logger,
    historyManagerCurried,
    historyEnabled,
    historyEventsLogger,
  ] = useServices([
    TOKENS.UTIL_OCA_RESOLVER,
    TOKENS.CONFIG,
    TOKENS.UTIL_LOGGER,
    TOKENS.FN_LOAD_HISTORY,
    TOKENS.HISTORY_ENABLED,
    TOKENS.HISTORY_EVENTS_LOGGER,
  ])
  const [loading, setLoading] = useState<boolean>(true)
  const [buttonsVisible, setButtonsVisible] = useState(true)
  const [acceptModalVisible, setAcceptModalVisible] = useState(false)
  const [declineModalVisible, setDeclineModalVisible] = useState(false)
  const [trustConfirmVisible, setTrustConfirmVisible] = useState(false)
  const [trustAuthResult, setTrustAuthResult] = useState<{ authorized: boolean; message?: string } | null>(null)
  const [overlay, setOverlay] = useState<CredentialOverlay<BrandingOverlay>>({ presentationFields: [] })
  const credential = useCredentialById(credentialId)
  const credentialConnectionLabel = useCredentialConnectionLabel(credential)
  const [store, dispatch] = useStore()
  const { start } = useTour()
  const screenIsFocused = useIsFocused()
  const goalCode = useOutOfBandByConnectionId(credential?.connectionId ?? '')?.outOfBandInvitation?.goalCode
  const [
    ConnectionAlert,
    TrustBadge,
    trustRegistryService,
    trustRegistryConfig,
    TrustConfirmModal,
    useFederatedTrust,
  ] = useServices([
    TOKENS.COMPONENT_CONNECTION_ALERT,
    TOKENS.COMPONENT_TRUST_BADGE,
    TOKENS.TRUST_REGISTRY_SERVICE,
    TOKENS.TRUST_REGISTRY_CONFIG,
    TOKENS.COMPONENT_TRUST_CONFIRM_MODAL,
    TOKENS.HOOK_USE_FEDERATED_TRUST,
  ])

  const { credentialDefinitionId, schemaId } = credential
    ? getCredentialIdentifiers(credential)
    : { credentialDefinitionId: undefined, schemaId: undefined }

  const [w3cIssuerDid, setW3CIssuerDid] = useState<string | undefined>(undefined)


  // Extract DID from identifier
  const getDidFromId = (id?: string) => {
    if (!id) return undefined

    if (id.startsWith('did:')) {
      // Check for Indy identifiers with artifacts (:2: or :3:)
      if (id.includes(':2:') || id.includes(':3:')) {
        const match = id.match(/^(did:[^:]+:[^:]+)/)
        return match ? match[1] : id.split(':')[0]
      }

      // For other DIDs (did:key, did:web, did:cheqd:testnet, etc.)
      // Return the DID part without path/query/fragment
      return id.split('?')[0].split('/')[0].split('#')[0]
    }

    // Unqualified indy DID
    return id.split(':')[0]
  }

  const issuerDid = w3cIssuerDid || getDidFromId(credentialDefinitionId) || getDidFromId(schemaId)
  const credentialType = schemaId?.split(':')[2] || 'Credential'

  // Federation Trust Check - replaces old trust registry check
  const federatedTrust = useFederatedTrust(issuerDid, credential, credentialType)

  const styles = StyleSheet.create({
    headerTextContainer: {
      paddingHorizontal: 25,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerText: {
      flexShrink: 1,
    },
    footerButton: {
      paddingTop: 10,
    },
  })

  useEffect(() => {
    const shouldShowTour = enableToursConfig && store.tours.enableTours && !store.tours.seenCredentialOfferTour
    if (shouldShowTour && screenIsFocused) {
      start(BaseTourID.CredentialOfferTour)
      dispatch({
        type: DispatchAction.UPDATE_SEEN_CREDENTIAL_OFFER_TOUR,
        payload: [true],
      })
    }
  }, [
    enableToursConfig,
    store.tours.enableTours,
    store.tours.seenCredentialOfferTour,
    screenIsFocused,
    start,
    dispatch,
  ])

  useEffect(() => {
    if (!agent || !credential) {
      DeviceEventEmitter.emit(
        EventTypes.ERROR_ADDED,
        new BifoldError(t('Error.Title1035'), t('Error.Message1035'), t('CredentialOffer.CredentialNotFound'), 1035)
      )
    }
  }, [agent, credential, t])

  useEffect(() => {
    if (!(credential && isValidAnonCredsCredential(credential) && agent)) {
      return
    }

    const updateCredentialPreview = async () => {
      const { ...formatData } = await agent.credentials.getFormatData(credential.id)
      const { offer, offerAttributes } = formatData
      const offerData = offer?.anoncreds ?? offer?.indy

      // Try to extract issuer from W3C/JWT offers if present
      // This covers did:key, did:web, etc.
      if (!offerData) {
        // Check for other formats
        const w3cOffer = (offer as any)?.w3c || (offer as any)?.jwt_vc || (offer as any)?.jwt_vp || (offer as any)?.['did:oyd:vp']
        if (w3cOffer && typeof w3cOffer === 'object') {
          const issuer = (w3cOffer as any).issuer
          if (issuer) {
            if (typeof issuer === 'string') {
              setW3CIssuerDid(getDidFromId(issuer))
            } else if (typeof issuer === 'object' && issuer.id) {
              setW3CIssuerDid(getDidFromId(issuer.id))
            }
          }
        }
      }

      if (offerData) {
        await ensureCredentialMetadata(
          credential,
          agent,
          {
            schema_id: offerData.schema_id,
            cred_def_id: offerData.cred_def_id,
          },
          logger
        )
      }

      if (offerAttributes) {
        credential.credentialAttributes = [...offerAttributes.map((item) => new CredentialPreviewAttribute(item))]
      }
    }

    const resolvePresentationFields = async () => {
      const identifiers = getCredentialIdentifiers(credential)
      const attributes = buildFieldsFromAnonCredsCredential(credential)
      const bundle = await bundleResolver.resolveAllBundles({ identifiers, attributes, language: i18n.language })
      const fields = bundle?.presentationFields ?? []
      const metaOverlay = bundle?.metaOverlay ?? {}

      return { fields, metaOverlay }
    }

    /**
     * FIXME: Formatted data needs to be added to the record in Credo extensions
     * For now the order here matters. The credential preview must be updated to
     * add attributes (since these are not available in the offer).
     * Once the credential is updated the presentation fields can be correctly resolved
     */
    setLoading(true)
    updateCredentialPreview()
      .then(() => resolvePresentationFields())
      .then(({ fields, metaOverlay }) => {
        setOverlay({
          metaOverlay: metaOverlay as MetaOverlay,
          presentationFields: (fields as Attribute[]).filter((field) => field.value),
        })
        setLoading(false)
      })
  }, [credential, agent, bundleResolver, i18n.language, logger])

  const toggleDeclineModalVisible = useCallback(() => setDeclineModalVisible((prev) => !prev), [])

  const logHistoryRecord = useCallback(
    async (type: HistoryCardType) => {
      try {
        if (!(agent && historyEnabled)) {
          logger.trace(
            `[${CredentialOffer.name}]:[logHistoryRecord] Skipping history log, either history function disabled or agent undefined!`
          )
          return
        }
        const historyManager = historyManagerCurried(agent)

        if (!credential) {
          logger.error(`[${CredentialOffer.name}]:[logHistoryRecord] Cannot save history, credential undefined!`)
          return
        }
        const name = getEffectiveCredentialName(credential, overlay.metaOverlay?.name)

        /** Save history record for card accepted */
        const recordData: HistoryRecord = {
          type: type,
          message: name,
          createdAt: credential?.createdAt,
          correspondenceId: credentialId,
          correspondenceName: credentialConnectionLabel,
        }
        historyManager.saveHistory(recordData)
      } catch (err: unknown) {
        logger.error(`[${CredentialOffer.name}]:[logHistoryRecord] Error saving history: ${err}`)
      }
    },
    [agent, historyEnabled, logger, historyManagerCurried, credential, credentialId, credentialConnectionLabel, overlay]
  )

  const handleAcceptTouched = useCallback(async () => {
    try {
      if (!(agent && credential && assertNetworkConnected())) {
        return
      }

      // Federation Trust Check - using the hook result
      if (trustRegistryConfig?.enabled && !federatedTrust.isLoading) {
        // Show Trust Confirm Modal with federation info
        setTrustAuthResult({
          authorized: federatedTrust.authorized,
          message: federatedTrust.message ||
            (federatedTrust.trustSource === 'federation'
              ? `Verified via ${federatedTrust.trustAuthority?.name || 'Federation'}`
              : undefined)
        })
        setTrustConfirmVisible(true)
        return // Wait for modal action
      }

      setAcceptModalVisible(true)
      await agent.credentials.acceptOffer({ credentialRecordId: credential.id })
      if (historyEventsLogger.logAttestationAccepted) {
        const type = HistoryCardType.CardAccepted
        await logHistoryRecord(type)
      }
    } catch (err: unknown) {
      setButtonsVisible(true)
      const error = new BifoldError(t('Error.Title1024'), t('Error.Message1024'), (err as Error)?.message ?? err, 1024)
      DeviceEventEmitter.emit(EventTypes.ERROR_ADDED, error)
    }
  }, [
    agent,
    credential,
    assertNetworkConnected,
    logHistoryRecord,
    t,
    historyEventsLogger.logAttestationAccepted,
    trustRegistryConfig,
    federatedTrust,
    logger
  ])

  // Handle accept from Trust Confirm Modal
  const handleTrustConfirmAccept = useCallback(async () => {
    try {
      if (!(agent && credential)) return
      setTrustConfirmVisible(false)
      setAcceptModalVisible(true)
      await agent.credentials.acceptOffer({ credentialRecordId: credential.id })
      if (historyEventsLogger.logAttestationAccepted) {
        const type = HistoryCardType.CardAccepted
        await logHistoryRecord(type)
      }
    } catch (err: unknown) {
      setButtonsVisible(true)
      const error = new BifoldError(t('Error.Title1024'), t('Error.Message1024'), (err as Error)?.message ?? err, 1024)
      DeviceEventEmitter.emit(EventTypes.ERROR_ADDED, error)
    }
  }, [agent, credential, historyEventsLogger.logAttestationAccepted, logHistoryRecord, t])

  const handleTrustConfirmClose = useCallback(() => {
    setTrustConfirmVisible(false)
  }, [])

  const handleDeclineTouched = useCallback(async () => {
    try {
      if (!(agent && credential)) return

      // Trust Registry Check for Decline (as requested)
      if (trustRegistryService && trustRegistryConfig?.enabled) {
        const service = trustRegistryService as any
        const credentialType = schemaId?.split(':')[2] || 'Credential'
        try {
          const auth = await service.checkIssuerAuthorization(issuerDid, credentialType)
          const capability = auth.authorized ? t('TrustRegistry.CanIssue') : t('TrustRegistry.CanVerify')
          const message = `${t('TrustRegistry.IssuerCapability')}: ${capability}\n\n${t('TrustRegistry.ProceedDecline')}`

          Alert.alert(
            t('TrustRegistry.CheckStatus'),
            message,
            [
              { text: t('Global.Back'), style: 'cancel' },
              {
                text: t('Global.Decline'), style: 'destructive', onPress: async () => {
                  await agent.credentials.declineOffer(credential.id)
                  navigation.getParent()?.navigate(TabStacks.HomeStack, { screen: Screens.Home })
                }
              }
            ]
          )
          return
        } catch (e) {
          logger.error('Trust Registry check during decline failed', { error: e })
        }
      }

      const connectionId = credential.connectionId ?? ''
      const connection = await agent.connections.findById(connectionId)

      await agent.credentials.declineOffer(credential.id)

      if (connection) {
        await agent.credentials.sendProblemReport({
          credentialRecordId: credential.id,
          description: t('CredentialOffer.Declined'),
        })
      }

      toggleDeclineModalVisible()
      if (historyEventsLogger.logAttestationRefused) {
        const type = HistoryCardType.CardDeclined
        await logHistoryRecord(type)
      }

      navigation.getParent()?.navigate(TabStacks.HomeStack, { screen: Screens.Home })
    } catch (err: unknown) {
      const error = new BifoldError(t('Error.Title1025'), t('Error.Message1025'), (err as Error)?.message ?? err, 1025)
      DeviceEventEmitter.emit(EventTypes.ERROR_ADDED, error)
    }
  }, [
    agent,
    credential,
    t,
    toggleDeclineModalVisible,
    navigation,
    logHistoryRecord,
    historyEventsLogger.logAttestationRefused,
    trustRegistryService,
    trustRegistryConfig,
    issuerDid,
    schemaId,
    logger
  ])

  const header = () => {
    return (
      <>
        <ConnectionImage connectionId={credential?.connectionId} />
        <View style={styles.headerTextContainer}>
          <ThemedText style={styles.headerText} testID={testIdWithKey('HeaderText')}>
            <ThemedText>{credentialConnectionLabel || t('ContactDetails.AContact')}</ThemedText>{' '}
            {t('CredentialOffer.IsOfferingYouACredential')}
          </ThemedText>
          {TrustBadge && <TrustBadge issuerDid={issuerDid} credentialType={credentialType} />}
        </View>
        {!loading && credential && (
          <View style={{ marginHorizontal: 15, marginBottom: 16 }}>
            <CredentialCard credential={credential} />
          </View>
        )}
      </>
    )
  }

  const footer = () => {
    return (
      <View
        style={{
          paddingHorizontal: 25,
          paddingVertical: 16,
          paddingBottom: 26,
          backgroundColor: ColorPalette.brand.secondaryBackground,
        }}
      >
        {loading ? <RecordLoading /> : null}
        {Boolean(credentialConnectionLabel) && goalCode === 'aries.vc.issue' && (
          <ConnectionAlert connectionLabel={credentialConnectionLabel} />
        )}
        <View style={styles.footerButton}>
          <Button
            title={t('Global.Accept')}
            accessibilityLabel={t('Global.Accept')}
            testID={testIdWithKey('AcceptCredentialOffer')}
            buttonType={ButtonType.Primary}
            onPress={handleAcceptTouched}
            disabled={!buttonsVisible}
          />
        </View>
        <View style={styles.footerButton}>
          <Button
            title={t('Global.Decline')}
            accessibilityLabel={t('Global.Decline')}
            testID={testIdWithKey('DeclineCredentialOffer')}
            buttonType={ButtonType.Secondary}
            onPress={toggleDeclineModalVisible}
            disabled={!buttonsVisible}
          />
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={{ flexGrow: 1 }} edges={['bottom', 'left', 'right']}>
      <Record fields={overlay.presentationFields || []} header={header} footer={footer} />
      <CredentialOfferAccept visible={acceptModalVisible} credentialId={credentialId} />
      <CommonRemoveModal
        usage={ModalUsage.CredentialOfferDecline}
        visible={declineModalVisible}
        onSubmit={handleDeclineTouched}
        onCancel={toggleDeclineModalVisible}
      />
      {TrustConfirmModal && (
        <TrustConfirmModal
          visible={trustConfirmVisible}
          isAuthorized={trustAuthResult?.authorized ?? false}
          onAccept={handleTrustConfirmAccept}
          onDecline={handleTrustConfirmClose}
          onClose={handleTrustConfirmClose}
          message={trustAuthResult?.message}
        />
      )}
    </SafeAreaView>
  )
}

export default CredentialOffer
