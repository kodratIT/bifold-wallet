import React from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'

import { onboardingColors, onboardingShadow } from '../../theme/onboarding'
import { ConsentRequestCard } from './ConsentRequestCard'
import { CredentialCard } from './CredentialCard'
import { VerificationSuccessCard } from './VerificationSuccessCard'

type PhoneMockupProps = {
  variant: 'credentials' | 'consent' | 'verification'
}

export const PhoneMockup: React.FC<PhoneMockupProps> = ({ variant }) => {
  const { width, height } = useWindowDimensions()
  const phoneWidth = Math.min(width * 0.74, height < 720 ? 238 : 286)

  return (
    <View style={[styles.phoneShadow, { width: phoneWidth }]}>
      <View style={styles.phoneFrame}>
        <View style={styles.speaker} />
        <View style={styles.phoneScreen}>{renderContent(variant)}</View>
      </View>
    </View>
  )
}

const renderContent = (variant: PhoneMockupProps['variant']) => {
  if (variant === 'consent') {
    return <ConsentRequestCard />
  }

  if (variant === 'verification') {
    return <VerificationSuccessCard />
  }

  return (
    <View style={styles.credentialStack}>
      <CredentialCard title="Digital ID" subtitle="Verified identity" icon="account-circle" />
      <CredentialCard title="Driver License" icon="car" />
      <CredentialCard title="Certificate" icon="medal-outline" />
    </View>
  )
}

const styles = StyleSheet.create({
  phoneShadow: {
    aspectRatio: 0.62,
    ...onboardingShadow,
  },
  phoneFrame: {
    flex: 1,
    borderRadius: 36,
    padding: 12,
    backgroundColor: onboardingColors.darkNavy,
  },
  speaker: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    width: 74,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#243257',
    zIndex: 2,
  },
  phoneScreen: {
    flex: 1,
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingTop: 32,
    paddingBottom: 14,
    backgroundColor: onboardingColors.white,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  credentialStack: {
    gap: 12,
  },
})
