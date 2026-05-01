import React from 'react'
import { StyleSheet, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors } from '../../theme/onboarding'

export const BackgroundDecorations: React.FC = () => {
  return (
    <View pointerEvents="none" style={styles.container}>
      <Icon name="fingerprint" size={92} color={onboardingColors.secondaryBlue} style={[styles.icon, styles.fingerprint]} />
      <Icon name="shield-lock" size={78} color={onboardingColors.primaryBlue} style={[styles.icon, styles.shield]} />
      <Icon name="file-document-outline" size={72} color={onboardingColors.secondaryBlue} style={[styles.icon, styles.document]} />
      <View style={styles.dottedPattern}>
        {Array.from({ length: 36 }).map((_, index) => (
          <View key={index} style={styles.dot} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  icon: {
    position: 'absolute',
    opacity: 0.055,
  },
  fingerprint: {
    top: 118,
    right: -18,
    transform: [{ rotate: '-12deg' }],
  },
  shield: {
    top: 226,
    left: -18,
    transform: [{ rotate: '9deg' }],
  },
  document: {
    top: 336,
    right: 18,
    transform: [{ rotate: '11deg' }],
  },
  dottedPattern: {
    position: 'absolute',
    top: 170,
    right: 34,
    width: 128,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    opacity: 0.14,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: onboardingColors.secondaryBlue,
  },
})
