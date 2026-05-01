import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors } from '../../theme/onboarding'

type AgreementCheckboxCardProps = {
  checked: boolean
  onToggle: () => void
  onPrivacyPress: () => void
}

export const AgreementCheckboxCard: React.FC<AgreementCheckboxCardProps> = ({ checked, onToggle, onPrivacyPress }) => {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} style={styles.card}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Icon name="check" size={16} color={onboardingColors.white} /> : null}
      </View>
      <Text style={styles.text}>
        I have read and agree to the Terms & Conditions and{' '}
        <Text
          accessibilityRole="link"
          onPress={(event) => {
            event.stopPropagation()
            onPrivacyPress()
          }}
          style={styles.link}
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: onboardingColors.white,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    shadowColor: '#0B3B8F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: onboardingColors.primaryBlue,
    borderColor: onboardingColors.primaryBlue,
  },
  text: {
    flex: 1,
    color: onboardingColors.bodyText,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  link: {
    color: onboardingColors.primaryBlue,
    fontWeight: '800',
  },
})
