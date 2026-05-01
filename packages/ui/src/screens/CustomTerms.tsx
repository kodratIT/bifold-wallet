import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { DispatchAction, OnboardingStackParams, Screens, useStore } from '@bifold/core'

import { AppHeader, PrimaryButton } from '../components/onboarding'
import { AgreementCheckboxCard, AppStatusBar, BackgroundDecorations, TermsSectionItem } from '../components/terms'
import { onboardingColors, onboardingTypography } from '../theme/onboarding'

export const TermsVersion = '1'

const PRIVACY_POLICY_URL = 'https://www.openwallet.foundation/privacy-policy'

const termsSections = [
  {
    icon: 'account-circle-outline',
    title: '1. Identity & Account',
    description:
      'You agree to use SSI Wallet for your personal digital identity.\nYou are responsible for the accuracy of the information you provide.',
  },
  {
    icon: 'share-variant-outline',
    title: '2. Data Sharing Consent',
    description:
      'You control the data you share and with whom.\nYou will share only the data you approve for each request.',
  },
  {
    icon: 'lock-outline',
    title: '3. Privacy & Security',
    description:
      'We use industry-standard encryption to protect your data.\nWe do not sell your data and we protect your credentials with strong security measures.',
  },
  {
    icon: 'shield-check-outline',
    title: '4. User Responsibility',
    description:
      'You are responsible for keeping your device and wallet access secure.\nDo not share your device, credentials, or recovery methods.',
  },
  {
    icon: 'file-document-outline',
    title: '5. Acceptance',
    description:
      'By continuing, you acknowledge that you have read, understood, and agree to these Terms & Conditions.',
  },
]

const CustomTerms: React.FC = () => {
  const [store, dispatch] = useStore()
  const [checked, setChecked] = useState(false)
  const navigation = useNavigation<StackNavigationProp<OnboardingStackParams>>()

  useEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

  const onSubmitPressed = useCallback(() => {
    if (!checked) {
      return
    }

    dispatch({
      type: DispatchAction.DID_AGREE_TO_TERMS,
      payload: [{ DidAgreeToTerms: TermsVersion }],
    })
  }, [checked, dispatch])

  const onBackPressed = useCallback(() => {
    dispatch({
      type: DispatchAction.DID_COMPLETE_TUTORIAL,
      payload: [{ didCompleteTutorial: false }],
    })
    navigation.navigate(Screens.Onboarding)
  }, [dispatch, navigation])

  const onPrivacyPress = useCallback(async () => {
    try {
      const canOpen = await Linking.canOpenURL(PRIVACY_POLICY_URL)
      if (canOpen) {
        await Linking.openURL(PRIVACY_POLICY_URL)
      }
    } catch {
      Alert.alert('Privacy Policy', 'Unable to open the Privacy Policy link right now.')
    }
  }, [])

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <AppStatusBar />
      <BackgroundDecorations />
      <View style={styles.gradientLayer} />

      <View style={styles.container}>
        <AppHeader />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
        >
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Terms & Conditions</Text>
            <Text style={styles.subtitle}>Please review and accept before continuing.</Text>
          </View>

          <View style={styles.termsCard}>
            {termsSections.map((section, index) => (
              <TermsSectionItem
                key={section.title}
                icon={section.icon}
                title={section.title}
                description={section.description}
                showDivider={index < termsSections.length - 1}
              />
            ))}
          </View>

          <AgreementCheckboxCard checked={checked} onToggle={() => setChecked((current) => !current)} onPrivacyPress={onPrivacyPress} />
        </ScrollView>

        <View style={styles.bottomActions}>
          <Pressable accessibilityRole="button" onPress={onBackPressed} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Icon name="arrow-left" size={18} color={onboardingColors.bodyText} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <PrimaryButton title="Agree & Continue" onPress={onSubmitPressed} disabled={!checked} style={styles.primaryButton} />
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: onboardingColors.white,
  },
  gradientLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: onboardingColors.backgroundSoft,
    opacity: 0.72,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 30,
    paddingBottom: 24,
    gap: 18,
  },
  headerBlock: {
    gap: 10,
  },
  title: {
    ...onboardingTypography.headline,
    color: onboardingColors.darkNavy,
  },
  subtitle: {
    ...onboardingTypography.body,
    color: onboardingColors.bodyText,
  },
  termsCard: {
    borderRadius: 28,
    paddingHorizontal: 16,
    backgroundColor: onboardingColors.white,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    shadowColor: '#0B3B8F',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  bottomActions: {
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    backgroundColor: 'rgba(248, 251, 255, 0.96)',
  },
  backButton: {
    minWidth: 82,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.72,
  },
  backText: {
    color: onboardingColors.bodyText,
    fontSize: 16,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
    maxWidth: 214,
  },
})

export default CustomTerms
