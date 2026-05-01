import React from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { onboardingColors } from '../../theme/onboarding'
import { PinInputBoxes } from './PinInputBoxes'

type PinStepSectionProps = {
  step?: string
  label: string
  helper: string
  value: string
  onChange: (value: string) => void
  inputRef: React.RefObject<TextInput | null>
  onComplete?: () => void
  autoFocus?: boolean
  message?: string
  messageType?: 'error' | 'success'
}

export const PinStepSection: React.FC<PinStepSectionProps> = ({
  label,
  helper,
  value,
  onChange,
  inputRef,
  onComplete,
  autoFocus,
  message,
  messageType,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <PinInputBoxes value={value} onChange={onChange} inputRef={inputRef} onComplete={onComplete} autoFocus={autoFocus} />
      <Text style={styles.helper}>{helper}</Text>
      {message ? <Text style={[styles.message, messageType === 'error' ? styles.error : styles.success]}>{message}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
  },
  label: {
    color: onboardingColors.darkNavy,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  helper: {
    color: onboardingColors.bodyText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  error: {
    color: '#EF4444',
  },
  success: {
    color: '#22C55E',
  },
})
