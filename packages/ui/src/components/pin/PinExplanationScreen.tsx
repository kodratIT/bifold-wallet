import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { onboardingColors, onboardingTypography } from '../../theme/onboarding'
import { ExplanationItem } from './ExplanationItem'
import { SecurityIllustrationCard } from './SecurityIllustrationCard'

const explanationItems = [
  {
    icon: 'shield-outline',
    title: '1. Protect your wallet',
    body: 'Your PIN adds a strong layer of protection to keep your wallet and credentials safe.',
  },
  {
    icon: 'clock-outline',
    title: '2. Quick secure access',
    body: 'Unlock your wallet quickly and securely whenever you need it.',
  },
  {
    icon: 'lock-outline',
    title: '3. Required for sensitive actions',
    body: 'Your PIN is required to view, share, or manage sensitive information on this device.',
  },
]

export const PinExplanationScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.copyBlock}>
        <Text style={styles.title}>Create a PIN</Text>
        <Text style={styles.subtitle}>
          Your PIN protects your wallet and keeps your credentials secure. You’ll need it to access sensitive actions on this device.
        </Text>
      </View>
      <SecurityIllustrationCard />
      <View style={styles.infoCard}>
        {explanationItems.map((item, index) => (
          <ExplanationItem key={item.title} {...item} showDivider={index < explanationItems.length - 1} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  copyBlock: {
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
  infoCard: {
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
})
