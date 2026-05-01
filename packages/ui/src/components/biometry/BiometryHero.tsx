import React from 'react'
import { StyleSheet, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors } from '../../theme/onboarding'

export const BiometryHero: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.orbit} />
      <View style={[styles.floating, styles.floatingOne]}>
        <Icon name="shield-lock" size={18} color={onboardingColors.primaryBlue} />
      </View>
      <View style={[styles.floating, styles.floatingTwo]}>
        <Icon name="check-decagram" size={18} color={onboardingColors.primaryBlue} />
      </View>
      <View style={styles.phone}>
        <View style={styles.speaker} />
        <View style={styles.fingerprintCircle}>
          <Icon name="fingerprint" size={54} color={onboardingColors.primaryBlue} />
        </View>
        <View style={styles.lineOne} />
        <View style={styles.lineTwo} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    height: 210,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.backgroundBlue,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    overflow: 'hidden',
  },
  orbit: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 1,
    borderStyle: 'dotted',
    borderColor: onboardingColors.secondaryBlue,
    opacity: 0.38,
  },
  floating: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.white,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  floatingOne: {
    top: 42,
    left: 72,
  },
  floatingTwo: {
    bottom: 42,
    right: 72,
  },
  phone: {
    width: 118,
    height: 160,
    borderRadius: 30,
    paddingTop: 16,
    alignItems: 'center',
    backgroundColor: onboardingColors.white,
    borderWidth: 2,
    borderColor: onboardingColors.darkNavy,
    shadowColor: '#0B3B8F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 7,
  },
  speaker: {
    width: 34,
    height: 4,
    borderRadius: 999,
    backgroundColor: onboardingColors.border,
    marginBottom: 20,
  },
  fingerprintCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.backgroundSoft,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  lineOne: {
    width: 58,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#E4ECFA',
    marginTop: 14,
  },
  lineTwo: {
    width: 40,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#E4ECFA',
    marginTop: 8,
  },
})
