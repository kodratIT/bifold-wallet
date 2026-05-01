import React from 'react'
import { StyleSheet, View } from 'react-native'

import { onboardingColors } from '../../theme/onboarding'

type PinIndicatorProps = {
  length: number
  maxLength?: number
}

export const PinIndicator: React.FC<PinIndicatorProps> = ({ length, maxLength = 6 }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: maxLength }).map((_, index) => (
        <View key={index} style={[styles.dot, index < length && styles.dotFilled]} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.white,
  },
  dotFilled: {
    borderColor: onboardingColors.primaryBlue,
    backgroundColor: onboardingColors.primaryBlue,
  },
})
