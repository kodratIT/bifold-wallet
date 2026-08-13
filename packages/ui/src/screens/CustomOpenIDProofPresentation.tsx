import { useAgent } from '@bifold/react-hooks'
import { useTheme, Screens, TabStacks, BifoldError, EventTypes } from '@bifold/core'
import { StackScreenProps } from '@react-navigation/stack'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DeviceEventEmitter,
  FlatList,
  Pressable,
  Text,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ViewabilityConfig,
  type ViewToken,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { type DcqlQueryResult } from '@credo-ts/core'

import { buildWizardData, handleDcqlShare } from '../helpers/openidProofWizard'
import type { SelectedCredentialsFormat, WizardAttribute, WizardEntry } from '../helpers/openidProofWizard'

interface MinimalDCQLRequestRecord {
  verifierHostName?: string
  authorizationRequestPayload?: Record<string, unknown>
  dcql?: { queryResult: DcqlQueryResult }
  origin?: string
}

const isSdJwtDcqlFormat = (format: unknown): boolean => format === 'vc+sd-jwt' || format === 'dc+sd-jwt'

export const isCustomOpenIDProofPresentationRequest = (credential?: MinimalDCQLRequestRecord): boolean => {
  const dcqlCredentials = credential?.dcql?.queryResult.credentials ?? []
  return (
    dcqlCredentials.length > 0 && dcqlCredentials.every((credentialQuery) => isSdJwtDcqlFormat(credentialQuery.format))
  )
}

type NavParams = { [key: string]: { credential: MinimalDCQLRequestRecord } }
type Props = StackScreenProps<NavParams, string>

const CustomOpenIDProofPresentation: React.FC<Props> = ({
  navigation,
  route: {
    params: { credential },
  },
}) => {
  const { t } = useTranslation()
  const { ColorPalette, TextTheme } = useTheme()
  const { agent } = useAgent()
  const { width: screenWidth } = useWindowDimensions()
  const screenBackground = ColorPalette.brand.primaryBackground ?? '#FFFFFF'

  const isUnsupportedRequest = !isCustomOpenIDProofPresentationRequest(credential)
  const queryResult = isUnsupportedRequest ? undefined : credential?.dcql?.queryResult
  const wizardData = useMemo(() => {
    if (!queryResult) return undefined
    return buildWizardData(queryResult, credential?.dcql)
  }, [queryResult, credential?.dcql])

  const entryCount = wizardData?.entries.length ?? 0
  const totalSteps = entryCount > 0 ? entryCount + 1 : 1
  const [currentStep, setCurrentStep] = useState(0)
  const isPreview = currentStep === totalSteps - 1

  const [selectedCredentials, setSelectedCredentials] = useState<SelectedCredentialsFormat>({})
  const [selectedClaimsByEntry, setSelectedClaimsByEntry] = useState<Record<string, Record<string, boolean>>>({})
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'success' | 'error'>('idle')
  const [shareError, setShareError] = useState<string>('')

  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    if (!wizardData) return
    const initial: SelectedCredentialsFormat = {}
    const initialClaims: Record<string, Record<string, boolean>> = {}
    for (const entry of wizardData.entries) {
      if (entry.credentials.length > 0) {
        const first = entry.credentials[0]
        initial[entry.entryId] = { id: first.id, claimFormat: first.claimFormat as string }
        initialClaims[entry.entryId] = Object.fromEntries(first.attributes.map((attr) => [attr.key, true]))
      }
    }
    setSelectedCredentials(initial)
    setSelectedClaimsByEntry(initialClaims)
  }, [wizardData])

  const currentEntry: WizardEntry | undefined = !isPreview && wizardData ? wizardData.entries[currentStep] : undefined

  const selectionSummary = useMemo(() => {
    let selected = 0
    let total = 0
    let hasUnselected = false
    for (const entry of wizardData?.entries ?? []) {
      const selectedId = selectedCredentials[entry.entryId]?.id
      const opt = entry.credentials.find((c) => c.id === selectedId)
      if (!opt) continue
      const entryClaims = selectedClaimsByEntry[entry.entryId] ?? {}
      for (const attr of opt.attributes) {
        total++
        if (entryClaims[attr.key]) selected++
        else if (attr.isTogglable) hasUnselected = true
      }
    }
    return { selected, total, hasUnselected }
  }, [wizardData, selectedCredentials, selectedClaimsByEntry])

  const missingEntries = useMemo(() => {
    return (wizardData?.entries ?? []).filter((entry) => entry.credentials.length === 0)
  }, [wizardData])

  const entriesWithNoClaims = useMemo(() => {
    return (wizardData?.entries ?? []).filter((entry) => {
      const claims = selectedClaimsByEntry[entry.entryId] ?? {}
      return entry.credentials.length > 0 && Object.keys(claims).length > 0 && Object.values(claims).every((v) => !v)
    })
  }, [wizardData, selectedClaimsByEntry])

  const hasBlockingIssue = missingEntries.length > 0 || entriesWithNoClaims.length > 0

  const handleCredChange = useCallback(
    (entryId: string, newCredId: string) => {
      const entry = wizardData?.entries.find((e) => e.entryId === entryId)
      if (!entry) return
      const matched = entry.credentials.find((c) => c.id === newCredId)
      if (!matched) return
      setSelectedCredentials((prev) => ({
        ...prev,
        [entryId]: { id: matched.id, claimFormat: matched.claimFormat as string },
      }))
      setSelectedClaimsByEntry((prev) => ({
        ...prev,
        [entryId]: Object.fromEntries(matched.attributes.map((attr) => [attr.key, true])),
      }))
    },
    [wizardData]
  )

  const handleClaimToggle = useCallback((entryId: string, claimKey: string, value: boolean) => {
    setSelectedClaimsByEntry((prev) => ({
      ...prev,
      [entryId]: { ...(prev[entryId] ?? {}), [claimKey]: value },
    }))
  }, [])

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) setCurrentStep(viewableItems[0].index ?? 0)
  }, [])

  const viewabilityConfig: ViewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 50 }), [])

  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalSteps) return
      flatListRef.current?.scrollToIndex({ index, animated: true })
    },
    [totalSteps]
  )

  const handleAccept = useCallback(async () => {
    if (!agent || !credential || !queryResult) return
    if (hasBlockingIssue) return
    setShareState('sharing')
    try {
      await handleDcqlShare(
        agent,
        credential as {
          authorizationRequestPayload: Record<string, unknown>
          dcql: { queryResult: DcqlQueryResult }
          origin?: string
        },
        selectedCredentials,
        selectedClaimsByEntry
      )
      setShareState('success')
    } catch (err: unknown) {
      setShareState('error')
      setShareError((err as Error)?.message ?? String(err))
      DeviceEventEmitter.emit(
        EventTypes.ERROR_ADDED,
        new BifoldError(t('Error.Title1027'), t('Error.Message1027'), (err as Error)?.message ?? err, 1027)
      )
    }
  }, [agent, credential, queryResult, selectedCredentials, selectedClaimsByEntry, hasBlockingIssue, t])

  const handleDismiss = useCallback(() => {
    navigation.getParent()?.navigate(TabStacks.HomeStack, { screen: Screens.Home })
  }, [navigation])

  const handleRetry = useCallback(() => {
    setShareState('idle')
    setShareError('')
  }, [])

  const renderStepDots = () => (
    <View style={styles.stepDotsContainer}>
      <View style={styles.stepDots}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => goToStep(i)}
            style={[
              styles.stepDot,
              {
                backgroundColor: i === currentStep ? ColorPalette.brand.primary : ColorPalette.grayscale.lightGrey,
                width: i === currentStep ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.stepCounter}>
        <Icon name={isPreview ? 'checklist' : 'description'} size={14} color={ColorPalette.grayscale.mediumGrey} />
        <Text style={[styles.stepCounterText, { color: ColorPalette.grayscale.mediumGrey }]}>
          {isPreview
            ? t('ProofRequest.Preview', 'Preview')
            : `${t('ProofRequest.Step', 'Step')} ${currentStep + 1} ${t('ProofRequest.Of', 'of')} ${totalSteps - 1}`}
        </Text>
      </View>
    </View>
  )

  const renderAttributeRow = (attr: WizardAttribute, entryId: string) => {
    const entryClaims = selectedClaimsByEntry[entryId] ?? {}
    const isChecked = entryClaims[attr.key] ?? false

    return (
      <TouchableOpacity
        key={attr.key}
        activeOpacity={attr.isTogglable ? 0.7 : 1}
        onPress={() => {
          if (attr.isTogglable) handleClaimToggle(entryId, attr.key, !isChecked)
        }}
        style={[
          styles.attrRow,
          {
            backgroundColor: ColorPalette.brand.secondaryBackground,
            opacity: !attr.isTogglable ? 0.6 : isChecked ? 1 : 0.55,
          },
        ]}
      >
        <View style={{ flex: 1, paddingRight: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <Icon name={getIconForAttr(attr.key)} size={20} color={TextTheme.normal.color || '#888'} />
            <Text style={[styles.attrLabel, { color: TextTheme.normal.color }]}>{attr.label}</Text>
            {attr.isRequired && (
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredBadgeText}>{t('ProofRequest.Required', 'Required')}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.attrValue, { color: TextTheme.normal.color }]} numberOfLines={2}>
            {isChecked && !isPreview ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : attr.value}
          </Text>
        </View>
        {attr.isTogglable ? (
          <Icon
            name={isChecked ? 'check-circle' : 'radio-button-unchecked'}
            size={26}
            color={isChecked ? ColorPalette.brand.primary : ColorPalette.grayscale.lightGrey}
            style={{ padding: 6 }}
          />
        ) : (
          <Icon name="lock-outline" size={22} color={ColorPalette.grayscale.mediumGrey} style={{ padding: 6 }} />
        )}
      </TouchableOpacity>
    )
  }

  const renderEntryPage = (entry: WizardEntry) => {
    const selectedId = selectedCredentials[entry.entryId]?.id
    const currentOpt = entry.credentials.find((c) => c.id === selectedId)

    if (!currentOpt) {
      return (
        <View key={entry.entryId} style={[styles.page, { width: screenWidth }]}>
          <View style={[styles.card, { borderColor: '#EF4444', borderWidth: 2 }]}>
            <View style={styles.cardBody}>
              <Icon name="error-outline" size={24} color="#EF4444" />
              <Text style={[styles.cardName, { color: '#EF4444' }]}>{entry.entryName}</Text>
            </View>
            <Text style={[styles.cardIssuer, { color: '#EF4444', marginTop: 8 }]}>
              {t(
                'ProofRequest.NoMatchingCredential',
                'No matching credential found in your wallet for this requirement.'
              )}
            </Text>
          </View>
        </View>
      )
    }

    return (
      <View key={entry.entryId} style={[styles.page, { width: screenWidth }]}>
        <View
          style={[
            styles.bigCard,
            {
              backgroundColor: '#202537',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
            },
          ]}
        >
          <View style={[styles.bigCardAccent, { backgroundColor: ColorPalette.brand.primary }]} />
          <View style={styles.bigCardBody}>
            <View style={styles.bigCardHeader}>
              <View style={[styles.bigCardIconContainer, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
                <Icon name="fingerprint" size={32} color={ColorPalette.brand.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.bigCardName, { color: '#FFFFFF' }]}>
                  {currentOpt?.credentialName ?? entry.entryName}
                </Text>
                {currentOpt?.issuerName ? (
                  <Text style={[styles.bigCardIssuer, { color: 'rgba(255, 255, 255, 0.5)' }]}>
                    {currentOpt.issuerName}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
          <View style={styles.bigCardFooterRow}>
            <Text style={[styles.bigCardFooterText, { color: 'rgba(255, 255, 255, 0.35)' }]}>
              {t('ProofRequest.CredentialCard', 'Digital Credential')}
            </Text>
          </View>
        </View>

        {entry.credentials.length > 1 && (
          <View style={styles.switcherRow}>
            <Text style={[styles.switcherLabel, { color: ColorPalette.grayscale.mediumGrey }]}>
              {t('ProofRequest.MatchingCredentials', 'Matching credentials')}:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {entry.credentials.map((opt) => {
                const isSelected = opt.id === selectedId
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => handleCredChange(entry.entryId, opt.id)}
                    style={[
                      styles.credChip,
                      {
                        backgroundColor: isSelected ? ColorPalette.brand.primary : 'transparent',
                        borderColor: isSelected ? ColorPalette.brand.primary : ColorPalette.grayscale.lightGrey,
                      },
                    ]}
                  >
                    <Text style={[styles.credChipText, { color: isSelected ? '#FFFFFF' : TextTheme.normal.color }]}>
                      {opt.credentialName.length > 18
                        ? opt.credentialName.substring(0, 17) + '\u2026'
                        : opt.credentialName}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}
        {currentOpt && currentOpt.attributes.length > 0 && (
          <View>
            <Text style={[styles.sectionTitleText, { color: ColorPalette.grayscale.mediumGrey }]}>
              {t('ProofRequest.Attributes', 'Attributes to share')}
            </Text>
            {currentOpt.attributes.map((attr) => renderAttributeRow(attr, entry.entryId))}
          </View>
        )}
      </View>
    )
  }

  const renderPreviewPage = () => (
    <View style={[styles.page, { width: screenWidth }]}>
      <Text style={[styles.previewTitle, { color: TextTheme.normal.color }]}>
        {t('ProofRequest.ReviewAndSend', 'Review and send')}
      </Text>
      <Text style={[styles.previewSubtitle, { color: TextTheme.normal.color }]}>
        {t('ProofRequest.ReviewDescription', 'You are about to share the following information.')}
      </Text>
      <View style={[styles.summaryCard, { borderColor: 'rgba(128, 128, 128, 0.12)' }]}>
        <Text style={[styles.summaryText, { color: TextTheme.normal.color }]}>
          {t('ProofRequest.FieldsSelected', '{{selected}} of {{total}} fields selected', {
            selected: selectionSummary.selected,
            total: selectionSummary.total,
          })}
        </Text>
        {selectionSummary.hasUnselected && (
          <View style={styles.warningRow}>
            <Icon name="warning" size={14} color="#F59E0B" />
            <Text style={styles.warningText}>
              {t('ProofRequest.UnselectedClaimsWarning', 'Unselected SD-JWT claims may cause verification to fail.')}
            </Text>
          </View>
        )}
      </View>
      {wizardData?.entries.map((entry) => {
        const selectedId = selectedCredentials[entry.entryId]?.id
        const currentOpt = entry.credentials.find((c) => c.id === selectedId)
        if (!currentOpt) {
          return (
            <View key={entry.entryId} style={[styles.previewCard, { borderColor: '#EF4444' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Icon name="error-outline" size={18} color="#EF4444" />
                <Text style={[styles.previewCardTitle, { color: '#EF4444' }]}>{entry.entryName}</Text>
              </View>
              <Text style={[styles.emptyText, { color: '#EF4444' }]}>
                {t('ProofRequest.NoMatchingCredential', 'No matching credential found in wallet.')}
              </Text>
            </View>
          )
        }
        const entryClaims = selectedClaimsByEntry[entry.entryId] ?? {}
        const selectedAttrs = currentOpt.attributes.filter((a) => entryClaims[a.key])
        return (
          <View key={entry.entryId} style={[styles.previewCard, { borderColor: 'rgba(128, 128, 128, 0.12)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Icon name="credit-card" size={18} color={ColorPalette.brand.primary} />
              <Text style={[styles.previewCardTitle, { color: TextTheme.normal.color }]}>
                {currentOpt.credentialName}
              </Text>
            </View>
            {selectedAttrs.length === 0 ? (
              <Text style={[styles.emptyText, { color: ColorPalette.grayscale.mediumGrey }]}>
                {t('ProofRequest.NoAttributesSelected', 'No attributes selected')}
              </Text>
            ) : (
              selectedAttrs.map((attr) => (
                <View key={attr.key} style={styles.previewAttrRow}>
                  <Icon name="check-circle" size={14} color={ColorPalette.brand.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.previewAttrLabel, { color: TextTheme.normal.color }]}>{attr.label}</Text>
                  <Text style={[styles.previewAttrValue, { color: ColorPalette.grayscale.mediumGrey }]}>
                    {attr.value}
                  </Text>
                </View>
              ))
            )}
          </View>
        )
      })}
    </View>
  )

  const renderItem = ({ index }: { index: number }) => {
    if (index === totalSteps - 1 || !wizardData) return renderPreviewPage()
    return renderEntryPage(wizardData.entries[index])
  }

  const renderNavButtons = () => {
    if (isPreview) {
      return (
        <View style={styles.footerContainer}>
          {shareState === 'idle' && (
            <>
              {hasBlockingIssue && (
                <View style={styles.warningRow}>
                  <Icon name="error-outline" size={18} color="#EF4444" />
                  <Text style={[styles.warningText, { color: '#EF4444' }]}>
                    {missingEntries.length > 0
                      ? t(
                          'ProofRequest.MissingCredentials',
                          'Some requested credentials are not available in your wallet.'
                        )
                      : t('ProofRequest.NoClaimsSelected', 'You must select at least one claim for each credential.')}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: hasBlockingIssue ? ColorPalette.grayscale.lightGrey : ColorPalette.brand.primary },
                ]}
                onPress={handleAccept}
                activeOpacity={hasBlockingIssue ? 1 : 0.8}
                disabled={hasBlockingIssue}
              >
                <Icon name="send" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>{t('Global.Send')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: ColorPalette.grayscale.lightGrey }]}
                onPress={handleDismiss}
                activeOpacity={0.8}
              >
                <Text style={[styles.secondaryButtonText, { color: ColorPalette.grayscale.mediumGrey }]}>
                  {t('Global.Decline')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )
    }

    const currentId = currentEntry?.entryId
    const currentOpt = currentId
      ? currentEntry?.credentials.find((c) => c.id === selectedCredentials[currentId]?.id)
      : undefined
    const availableAttrs = currentOpt?.attributes ?? []
    const entryClaims = currentId ? (selectedClaimsByEntry[currentId] ?? {}) : {}
    const hasUnselectedStep = availableAttrs.some((a) => a.isTogglable && !entryClaims[a.key])

    return (
      <View style={styles.footerContainer}>
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navButton, { borderColor: ColorPalette.grayscale.lightGrey }]}
            onPress={() => (currentStep === 0 ? handleDismiss() : goToStep(currentStep - 1))}
            activeOpacity={0.7}
          >
            <Icon name={currentStep === 0 ? 'close' : 'chevron-left'} size={22} color={ColorPalette.brand.primary} />
            <Text style={[styles.navButtonText, { color: ColorPalette.brand.primary }]}>
              {currentStep === 0 ? t('Global.Decline') : t('Global.Previous')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.navButton,
              { backgroundColor: ColorPalette.brand.primary, borderColor: ColorPalette.brand.primary },
            ]}
            onPress={() => goToStep(currentStep + 1)}
            activeOpacity={0.7}
          >
            <Text style={[styles.navButtonTextPrimary, { color: '#FFFFFF' }]}>
              {currentStep + 1 === totalSteps - 1 ? t('ProofRequest.Review', 'Review') : t('Global.Next')}
            </Text>
            <Icon name="chevron-right" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        {hasUnselectedStep && (
          <View style={styles.warningRow}>
            <Icon name="warning" size={14} color="#F59E0B" />
            <Text style={styles.warningText}>
              {t('ProofRequest.UnselectedClaimsWarning', 'Unselected SD-JWT claims may cause verification to fail.')}
            </Text>
          </View>
        )}
      </View>
    )
  }

  const data = useMemo(() => {
    if (!wizardData || wizardData.entries.length === 0) return []
    return Array.from({ length: totalSteps }, (_, i) => i)
  }, [totalSteps, wizardData])

  if (!wizardData || wizardData.entries.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: screenBackground }]} edges={['top', 'left', 'right']}>
        <View style={styles.emptyContainer}>
          <Icon name="search-off" size={48} color={ColorPalette.grayscale.lightGrey} />
          <Text style={[styles.emptyText, { color: ColorPalette.grayscale.mediumGrey, marginTop: 16 }]}>
            {isUnsupportedRequest
              ? t('ProofRequest.UnsupportedRequest', 'This proof request type is not supported by this custom screen.')
              : t('ProofRequest.NoCredentials', 'No matching credentials found')}
          </Text>
          <TouchableOpacity
            style={[styles.emptyDismissButton, { backgroundColor: ColorPalette.brand.primary }]}
            onPress={handleDismiss}
          >
            <Text style={styles.primaryButtonText}>{t('Global.Dismiss')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (shareState !== 'idle') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: screenBackground }]} edges={['top', 'left', 'right']}>
        <View style={[styles.shareScreen, { backgroundColor: screenBackground }]}>
          {shareState === 'sharing' && (
            <>
              <Icon name="hourglass-empty" size={64} color={ColorPalette.brand.primary} />
              <Text style={[styles.shareTitle, { color: TextTheme.normal.color }]}>
                {t('ProofRequest.Sending', 'Sending information securely...')}
              </Text>
            </>
          )}
          {shareState === 'success' && (
            <>
              <Icon name="check-circle" size={64} color="#22C55E" />
              <Text style={[styles.shareTitle, { color: TextTheme.normal.color }]}>
                {t('ProofRequest.InformationSentSuccessfully', 'Information sent successfully')}
              </Text>
              <Text style={[styles.shareSubtitle, { color: ColorPalette.grayscale.mediumGrey }]}>
                {t('ProofRequest.YouCanCloseThisScreen', 'You can close this screen now.')}
              </Text>
              <TouchableOpacity
                style={[styles.shareHomeButton, { backgroundColor: ColorPalette.brand.primary }]}
                onPress={handleDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.shareHomeButtonText}>{t('Loading.BackToHome', 'Back to Home')}</Text>
              </TouchableOpacity>
            </>
          )}
          {shareState === 'error' && (
            <>
              <Icon name="error-outline" size={64} color="#EF4444" />
              <Text style={[styles.shareTitle, { color: TextTheme.normal.color }]}>
                {t('ProofRequest.SharingFailed', 'Sharing failed')}
              </Text>
              {shareError ? (
                <Text style={[styles.shareSubtitle, { color: '#EF4444' }]} numberOfLines={3}>
                  {shareError}
                </Text>
              ) : null}
              <TouchableOpacity
                style={[styles.shareHomeButton, { backgroundColor: ColorPalette.brand.primary }]}
                onPress={handleRetry}
                activeOpacity={0.7}
              >
                <Text style={styles.shareHomeButtonText}>{t('Global.TryAgain', 'Try Again')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: screenBackground }]} edges={['top', 'left', 'right']}>
      <View style={styles.headerContainer}>
        <View style={styles.verifierRow}>
          <Text style={[styles.verifierName, { color: TextTheme.normal.color }]}>
            {credential?.verifierHostName ?? ''}
          </Text>
          <Icon name="verified-user" size={28} color={ColorPalette.brand.primary} />
        </View>
        {wizardData.entries[0]?.purpose && (
          <Text style={[styles.verifierPurpose, { color: TextTheme.normal.color }]}>
            {wizardData.entries[0].purpose}
          </Text>
        )}
      </View>

      {renderStepDots()}

      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => `step-${item}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_data, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
        style={{ flex: 1 }}
      />

      {renderNavButtons()}
    </SafeAreaView>
  )
}

const getIconForAttr = (key: string): string => {
  const k = key.toLowerCase()
  if (k.includes('name') || k.includes('given') || k.includes('family')) return 'person-outline'
  if (k.includes('birth') || k.includes('date')) return 'cake'
  if (k.includes('gender') || k.includes('sex')) return 'wc'
  if (k.includes('email')) return 'email'
  if (k.includes('phone') || k.includes('mobile')) return 'phone-iphone'
  if (k.includes('address') || k.includes('location') || k.includes('city') || k.includes('country')) return 'map'
  if (k.includes('over_') || k.includes('age')) return 'verified-user'
  if (k.includes('vct') || k.includes('type')) return 'fingerprint'
  if (k.includes('nik') || k.includes('ktp') || k.includes('id_')) return 'badge'
  return 'assignment'
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  headerContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  verifierRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verifierName: { fontSize: 22, fontWeight: '700', flexShrink: 1 },
  verifierPurpose: { marginTop: 4, fontSize: 14 },
  stepDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  stepDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: { height: 8, borderRadius: 4 },
  stepCounter: { flexDirection: 'row', alignItems: 'center' },
  stepCounterText: { fontSize: 12, marginLeft: 4 },
  page: { paddingHorizontal: 16, paddingTop: 4 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardBody: { flexDirection: 'row', alignItems: 'center' },
  cardName: { fontWeight: '600', fontSize: 16, marginLeft: 10, flex: 1 },
  cardIssuer: { fontSize: 13, marginTop: 6, marginLeft: 34 },
  bigCard: { borderRadius: 20, borderWidth: 1, marginBottom: 8, overflow: 'hidden' },
  bigCardAccent: { height: 12 },
  bigCardBody: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  bigCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  bigCardIconContainer: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bigCardName: { fontWeight: '700', fontSize: 22, flexShrink: 1 },
  bigCardIssuer: { fontSize: 14, marginTop: 4 },
  bigCardFooterRow: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  bigCardFooterText: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase' },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  switcherLabel: { fontSize: 11, marginLeft: 4 },
  credChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  credChipText: { fontSize: 11, fontWeight: '500' },
  sectionTitleText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 4,
  },
  attrRow: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.12)',
  },
  attrLabel: { fontWeight: '600', fontSize: 14, marginLeft: 8 },
  attrValue: { fontSize: 13, marginLeft: 30, marginTop: 1 },
  requiredBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  requiredBadgeText: { fontWeight: '700', fontSize: 10, color: '#EF4444', letterSpacing: 0.3 },
  previewTitle: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  previewSubtitle: { fontSize: 14, marginBottom: 12 },
  summaryCard: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  summaryText: { fontSize: 14, fontWeight: '600' },
  previewCard: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 6 },
  previewCardTitle: { fontSize: 15, fontWeight: '600', marginLeft: 8 },
  previewAttrRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  previewAttrLabel: { fontSize: 13, fontWeight: '500', flex: 1 },
  previewAttrValue: { fontSize: 12, marginTop: 1, marginLeft: 20 },
  emptyText: { fontSize: 14, fontStyle: 'italic' },
  footerContainer: { paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 20 },
  navRow: { flexDirection: 'row', gap: 12 },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  navButtonText: { fontWeight: '500', fontSize: 14 },
  navButtonTextPrimary: { fontWeight: '600', fontSize: 15 },
  warningRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 4 },
  warningText: { fontSize: 11, color: '#F59E0B', marginLeft: 4, flex: 1 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  primaryButtonText: { fontWeight: '700', fontSize: 16, color: '#FFFFFF', marginLeft: 8 },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryButtonText: { fontWeight: '600', fontSize: 15 },
  shareScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  shareTitle: { marginTop: 16, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  shareSubtitle: { marginTop: 8, fontSize: 14, textAlign: 'center' },
  shareHomeButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 40, borderRadius: 10 },
  shareHomeButtonText: { fontWeight: '600', fontSize: 15, color: '#FFFFFF' },
  emptyDismissButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
})

export default CustomOpenIDProofPresentation
