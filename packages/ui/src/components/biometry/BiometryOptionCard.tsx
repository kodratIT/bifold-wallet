import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors } from '../../theme/onboarding'

type BiometryOptionCardProps = {
  enabled: boolean
  available: boolean
  onToggle: () => void
}

export const BiometryOptionCard: React.FC<BiometryOptionCardProps> = ({ enabled, available, onToggle }) => {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Icon name="fingerprint" size={28} color={available ? onboardingColors.primaryBlue : '#9AA8C2'} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Biometric unlock</Text>
          <Text style={styles.description}>
            {available
              ? 'Use your fingerprint or face recognition to unlock SSI Wallet faster.'
              : 'Biometrics are not set up on this device yet.'}
          </Text>
        </View>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: enabled }} onPress={onToggle} style={[styles.switchTrack, enabled && styles.switchTrackEnabled]}>
          <View style={[styles.switchThumb, enabled && styles.switchThumbEnabled]}>
            <Icon name={enabled ? 'check' : 'close'} size={14} color={enabled ? onboardingColors.primaryBlue : '#9AA8C2'} />
          </View>
        </Pressable>
      </View>
      <View style={styles.securityNote}>
        <Icon name="shield-check" size={16} color={onboardingColors.primaryBlue} />
        <Text style={styles.securityText}>You can always use your PIN if biometrics are unavailable.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: onboardingColors.white,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    gap: 18,
    shadowColor: '#0B3B8F',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.backgroundBlue,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  copy: {
    flex: 1,
    gap: 5,
  },
  title: {
    color: onboardingColors.darkNavy,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  description: {
    color: onboardingColors.bodyText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  switchTrack: {
    width: 54,
    height: 32,
    borderRadius: 16,
    padding: 3,
    backgroundColor: '#E8F1FF',
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  switchTrackEnabled: {
    backgroundColor: onboardingColors.primaryBlue,
    borderColor: onboardingColors.primaryBlue,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.white,
  },
  switchThumbEnabled: {
    transform: [{ translateX: 22 }],
  },
  securityNote: {
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: onboardingColors.backgroundSoft,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  securityText: {
    flex: 1,
    color: onboardingColors.bodyText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
})
