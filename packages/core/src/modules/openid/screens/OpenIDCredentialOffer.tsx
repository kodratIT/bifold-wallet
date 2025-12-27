import { BrandingOverlay } from '@bifold/oca'
import { CredentialOverlay } from '@bifold/oca/build/legacy'
import { W3cCredentialRecord } from '@credo-ts/core'
import { useAgent } from '@credo-ts/react-hooks'
import { StackScreenProps } from '@react-navigation/stack'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, StyleSheet, Text, View } from 'react-native'
import Button, { ButtonType } from '../../../components/buttons/Button'
import CommonRemoveModal from '../../../components/modals/CommonRemoveModal'
import Record from '../../../components/record/Record'
import { EventTypes } from '../../../constants'
import { useTheme } from '../../../contexts/theme'
import { TOKENS, useServices } from '../../../container-api'
import ScreenLayout from '../../../layout/ScreenLayout'
import CredentialOfferAccept from '../../../screens/CredentialOfferAccept'
import { BifoldError } from '../../../types/error'
import { DeliveryStackParams, Screens, TabStacks } from '../../../types/navigators'
import { ModalUsage } from '../../../types/remove'
import { testIdWithKey } from '../../../utils/testable'
import OpenIDCredentialCard from '../components/OpenIDCredentialCard'
import { useOpenIDCredentials } from '../context/OpenIDCredentialRecordProvider'
import { getCredentialForDisplay } from '../display'
import { NotificationEventType, useOpenId4VciNotifications } from '../notification'
import { temporaryMetaVanillaObject } from '../metadata'
import { useAcceptReplacement } from '../hooks/useAcceptReplacement'
import { useDeclineReplacement } from '../hooks/useDeclineReplacement'

type OpenIDCredentialDetailsProps = StackScreenProps<DeliveryStackParams, Screens.OpenIDCredentialOffer>

const OpenIDCredentialOffer: React.FC<OpenIDCredentialDetailsProps> = ({ navigation, route }) => {
  // FIXME: change params to accept credential id to avoid 'non-serializable' warnings
  const { credential } = route.params
  const [
    logger,
    TrustBadge,
    trustRegistryConfig,
    TrustConfirmModal,
    useFederatedTrust,
  ] = useServices([
    TOKENS.UTIL_LOGGER,
    TOKENS.COMPONENT_TRUST_BADGE,
    TOKENS.TRUST_REGISTRY_CONFIG,
    TOKENS.COMPONENT_TRUST_CONFIRM_MODAL,
    TOKENS.HOOK_USE_FEDERATED_TRUST,
  ])
  const credentialDisplay = React.useMemo(() => getCredentialForDisplay(credential), [credential])
  const { display } = credentialDisplay

  // console.log('$$ ====> Credential Display', JSON.stringify(credentialDisplay))
  const { t } = useTranslation()
  const { ColorPalette, TextTheme } = useTheme()
  const { agent } = useAgent()
  const { resolveBundleForCredential } = useOpenIDCredentials()
  const { sendOpenId4VciNotification } = useOpenId4VciNotifications()

  const [isRemoveModalDisplayed, setIsRemoveModalDisplayed] = useState(false)
  const [buttonsVisible, setButtonsVisible] = useState(true)
  const [acceptModalVisible, setAcceptModalVisible] = useState(false)
  const [trustConfirmVisible, setTrustConfirmVisible] = useState(false)
  const [trustAuthResult, setTrustAuthResult] = useState<{ authorized: boolean; message?: string } | null>(null)

  const { acceptNewCredential } = useAcceptReplacement()
  const { declineByNewId } = useDeclineReplacement({ logger: logger })

  const [overlay, setOverlay] = useState<CredentialOverlay<BrandingOverlay>>({
    bundle: undefined,
    presentationFields: [],
    metaOverlay: undefined,
    brandingOverlay: undefined,
  })

  // Federated Trust Check
  const issuerDid = (credential as any)?.credential?.issuerId
  const credentialType = (credential as any)?.credential?.type?.length > 0
    ? (credential as any).credential.type[(credential as any).credential.type.length - 1]
    : 'Credential'

  // Use credential object for discovery, augmented with decoded attributes from display
  // This allows AuthorityDiscoveryService to inspect decoded claims (e.g. from SD-JWT)
  const discoveryCredential = React.useMemo(() => ({
    ...credential,
    attributes: credentialDisplay.attributes
  }), [credential, credentialDisplay.attributes])

  const federatedTrust = useFederatedTrust(
    issuerDid,
    discoveryCredential,
    credentialType
  )

  useEffect(() => {
    if (!credential) {
      return
    }

    console.log('[OpenIDCredentialOffer] Credential Params:', JSON.stringify(credential, null, 2))
    console.log('[OpenIDCredentialOffer] Decoded Attributes:', JSON.stringify(credentialDisplay.attributes, null, 2))

    const resolveOverlay = async () => {
      const brandingOverlay = await resolveBundleForCredential(credential)
      setOverlay(brandingOverlay)
    }

    resolveOverlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credential])

  const styles = StyleSheet.create({
    headerTextContainer: {
      paddingHorizontal: 25,
      paddingVertical: 16,
    },
    headerText: {
      ...TextTheme.normal,
      flexShrink: 1,
    },
    footerButton: {
      paddingTop: 10,
    },
  })

  const toggleDeclineModalVisible = () => setIsRemoveModalDisplayed(!isRemoveModalDisplayed)

  const handleDeclineTouched = async () => {
    await handleSendNotification(NotificationEventType.CREDENTIAL_DELETED)
    await declineByNewId(credential.id)
    toggleDeclineModalVisible()
    navigation.getParent()?.navigate(TabStacks.HomeStack, { screen: Screens.Home })
  }

  const handleSendNotification = async (notificationEventType: NotificationEventType) => {
    try {
      if (
        temporaryMetaVanillaObject.notificationMetadata?.notificationId &&
        temporaryMetaVanillaObject.notificationMetadata?.notificationEndpoint &&
        temporaryMetaVanillaObject.tokenResponse?.accessToken
      ) {
        await sendOpenId4VciNotification({
          accessToken: temporaryMetaVanillaObject.tokenResponse?.accessToken,
          notificationEvent: notificationEventType,
          notificationMetadata: {
            notificationId: temporaryMetaVanillaObject?.notificationMetadata?.notificationId,
            notificationEndpoint: temporaryMetaVanillaObject?.notificationMetadata?.notificationEndpoint,
          },
        })
      }
    } catch (err) {
      logger.error('[Credential Offer] error sending notification')
    }
  }

  const handleAcceptTouched = async () => {
    if (!agent) {
      return
    }

    // Federation Trust Check
    if (trustRegistryConfig?.enabled && !federatedTrust.isLoading) {
      setTrustAuthResult({
        authorized: federatedTrust.authorized,
        message: federatedTrust.message ||
          (federatedTrust.trustSource === 'federation'
            ? `Verified via ${federatedTrust.trustAuthority?.name || 'Federation'}`
            : undefined)
      })
      setTrustConfirmVisible(true)
      return
    }

    await processAccept()
  }

  const processAccept = async () => {
    try {
      await acceptNewCredential(credential)
      await handleSendNotification(NotificationEventType.CREDENTIAL_ACCEPTED)

      // Close confirmation modal if open
      setTrustConfirmVisible(false)

      setAcceptModalVisible(true)
    } catch (err: unknown) {
      setButtonsVisible(true)
      const error = new BifoldError(t('Error.Title1024'), t('Error.Message1024'), (err as Error)?.message ?? err, 1024)
      DeviceEventEmitter.emit(EventTypes.ERROR_ADDED, error)
    }
  }

  // Handle accept from Trust Confirm Modal
  const handleTrustConfirmAccept = async () => {
    await processAccept()
  }

  const handleTrustConfirmClose = () => {
    setTrustConfirmVisible(false)
  }

  const footerButton = (
    title: string,
    buttonPress: () => void,
    buttonType: ButtonType,
    testID: string,
    accessibilityLabel: string
  ) => {
    return (
      <View style={styles.footerButton}>
        <Button
          title={title}
          accessibilityLabel={accessibilityLabel}
          testID={testID}
          buttonType={buttonType}
          onPress={buttonPress}
          disabled={!buttonsVisible}
        />
      </View>
    )
  }

  const renderOpenIdCard = () => {
    if (!credentialDisplay || !credential) return null
    return (
      <OpenIDCredentialCard
        credentialDisplay={credentialDisplay}
        credentialRecord={credential as W3cCredentialRecord}
      />
    )
  }

  const header = () => {
    return (
      <>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerText} testID={testIdWithKey('HeaderText')}>
            <Text>{display.issuer.name || t('ContactDetails.AContact')}</Text>{' '}
            {t('CredentialOffer.IsOfferingYouACredential')}
          </Text>
          {TrustBadge && <TrustBadge issuerDid={issuerDid} credentialType={credentialType} credential={discoveryCredential} />}
        </View>
        {credential && <View style={{ marginHorizontal: 15, marginBottom: 16 }}>{renderOpenIdCard()}</View>}
      </>
    )
  }

  const footer = () => {
    const paddingHorizontal = 24
    const paddingVertical = 16
    const paddingBottom = 26
    return (
      <View style={{ marginBottom: 50 }}>
        <View
          style={{
            paddingHorizontal: paddingHorizontal,
            paddingVertical: paddingVertical,
            paddingBottom: paddingBottom,
            backgroundColor: ColorPalette.brand.secondaryBackground,
          }}
        >
          {footerButton(
            t('Global.Accept'),
            handleAcceptTouched,
            ButtonType.Primary,
            testIdWithKey('AcceptCredentialOffer'),
            t('Global.Accept')
          )}
          {footerButton(
            t('Global.Decline'),
            toggleDeclineModalVisible,
            ButtonType.Secondary,
            testIdWithKey('DeclineCredentialOffer'),
            t('Global.Decline')
          )}
        </View>
      </View>
    )
  }

  return (
    <ScreenLayout screen={Screens.OpenIDCredentialDetails}>
      <Record fields={overlay.presentationFields || []} hideFieldValues header={header} footer={footer} />
      <CredentialOfferAccept visible={acceptModalVisible} credentialId={''} confirmationOnly={true} />
      <CommonRemoveModal
        usage={ModalUsage.CredentialOfferDecline}
        visible={isRemoveModalDisplayed}
        onSubmit={handleDeclineTouched}
        onCancel={toggleDeclineModalVisible}
        extraDetails={display.issuer.name}
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
    </ScreenLayout>
  )
}

export default OpenIDCredentialOffer
