import React from 'react'
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors } from '../../theme/onboarding'

type PrimaryButtonProps = {
  title: string
  onPress: () => void
  style?: ViewStyle
  disabled?: boolean
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({ title, onPress, style, disabled = false }) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, disabled && styles.disabledButton, pressed && !disabled && styles.pressed, style]}
    >
      <Text style={[styles.text, disabled && styles.disabledText]}>{title}</Text>
      <Icon name="arrow-right" size={18} color={disabled ? onboardingColors.bodyText : onboardingColors.white} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minWidth: 138,
    height: 54,
    borderRadius: 27,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: onboardingColors.primaryBlue,
    shadowColor: onboardingColors.primaryBlue,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  disabledButton: {
    backgroundColor: '#E8F1FF',
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    color: onboardingColors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  disabledText: {
    color: onboardingColors.bodyText,
  },
})
