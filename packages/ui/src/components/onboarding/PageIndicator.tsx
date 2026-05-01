import React from 'react'
import { StyleSheet, View } from 'react-native'

import { onboardingColors } from '../../theme/onboarding'

type PageIndicatorProps = {
  activeIndex: number
  count?: number
}

export const PageIndicator: React.FC<PageIndicatorProps> = ({ activeIndex, count = 3 }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.dot, activeIndex === index && styles.activeDot]} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: onboardingColors.lightGray,
  },
  activeDot: {
    width: 26,
    backgroundColor: onboardingColors.primaryBlue,
  },
})
