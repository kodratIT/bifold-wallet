import React from 'react'
import { StyleSheet, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors } from '../../theme/onboarding'

export const SecurityIllustrationCard: React.FC = () => {
  return (
    <View style={styles.card}>
      <View style={styles.orbit} />
      <View style={[styles.floatingIcon, styles.userIcon]}>
        <Icon name="account" size={17} color={onboardingColors.primaryBlue} />
      </View>
      <View style={[styles.floatingIcon, styles.documentIcon]}>
        <Icon name="file-document-outline" size={17} color={onboardingColors.primaryBlue} />
      </View>
      <View style={[styles.floatingIcon, styles.shieldIcon]}>
        <Icon name="shield-check" size={17} color={onboardingColors.primaryBlue} />
      </View>

      <View style={styles.phone}>
        <View style={styles.phoneSpeaker} />
        <View style={styles.lockBubble}>
          <Icon name="shield-lock" size={26} color={onboardingColors.primaryBlue} />
        </View>
        <View style={styles.keypadPreview}>
          {Array.from({ length: 9 }).map((_, index) => (
            <View key={index} style={styles.keyPreview} />
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    height: 226,
    borderRadius: 30,
    backgroundColor: onboardingColors.backgroundBlue,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbit: {
    position: 'absolute',
    width: 174,
    height: 174,
    borderRadius: 87,
    borderWidth: 1,
    borderStyle: 'dotted',
    borderColor: onboardingColors.secondaryBlue,
    opacity: 0.45,
  },
  floatingIcon: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.white,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    shadowColor: '#0B3B8F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  userIcon: {
    top: 42,
    left: 58,
  },
  documentIcon: {
    top: 46,
    right: 56,
  },
  shieldIcon: {
    bottom: 40,
    right: 72,
  },
  phone: {
    width: 118,
    height: 168,
    borderRadius: 28,
    backgroundColor: onboardingColors.white,
    borderWidth: 2,
    borderColor: onboardingColors.darkNavy,
    alignItems: 'center',
    paddingTop: 18,
    shadowColor: '#0B3B8F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 7,
  },
  phoneSpeaker: {
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D8E6FF',
    marginBottom: 16,
  },
  lockBubble: {
    width: 58,
    height: 58,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.backgroundBlue,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  keypadPreview: {
    width: 68,
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    justifyContent: 'center',
  },
  keyPreview: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E7F0FF',
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
})
