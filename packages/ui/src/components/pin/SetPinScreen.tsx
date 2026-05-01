import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { onboardingColors, onboardingTypography } from '../../theme/onboarding'
import { PinSetupCard } from './PinSetupCard'

type SetPinScreenProps = {
  pin: string
  confirmPin: string
  onPinChange: (value: string) => void
  onConfirmPinChange: (value: string) => void
}

export const SetPinScreen: React.FC<SetPinScreenProps> = ({ pin, confirmPin, onPinChange, onConfirmPinChange }) => {
  return (
    <View style={styles.container}>
      <View style={styles.copyBlock}>
        <Text style={styles.title}>Set your PIN</Text>
        <Text style={styles.subtitle}>Create and confirm a 6-digit PIN to protect your wallet on this device.</Text>
      </View>
      <View style={styles.pinArea}>
        <PinSetupCard pin={pin} confirmPin={confirmPin} onPinChange={onPinChange} onConfirmPinChange={onConfirmPinChange} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 28,
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
  pinArea: {
    paddingTop: 10,
  },
})
