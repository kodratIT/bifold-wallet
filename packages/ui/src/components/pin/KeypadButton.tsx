import React from 'react'
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors } from '../../theme/onboarding'

type KeypadButtonProps = {
  label?: string
  icon?: string
  onPress: () => void
  disabled?: boolean
  style?: ViewStyle
}

export const KeypadButton: React.FC<KeypadButtonProps> = ({ label, icon, onPress, disabled = false, style }) => {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && !disabled && styles.pressed, disabled && styles.disabled, style]}
    >
      {icon ? <Icon name={icon} size={25} color={onboardingColors.primaryBlue} /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBFDFF',
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  pressed: {
    backgroundColor: onboardingColors.backgroundBlue,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    color: onboardingColors.darkNavy,
    fontSize: 25,
    fontWeight: '800',
  },
})
