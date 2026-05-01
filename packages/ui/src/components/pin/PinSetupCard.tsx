import React, { useCallback, useRef } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors } from '../../theme/onboarding'
import { PinStepSection } from './PinStepSection'

type PinSetupCardProps = {
  pin: string
  confirmPin: string
  onPinChange: (value: string) => void
  onConfirmPinChange: (value: string) => void
}

const PIN_LENGTH = 6

export const PinSetupCard: React.FC<PinSetupCardProps> = ({ pin, confirmPin, onPinChange, onConfirmPinChange }) => {
  const pinInputRef = useRef<TextInput>(null)
  const confirmPinInputRef = useRef<TextInput>(null)
  const shouldShowConfirm = pin.length === PIN_LENGTH
  const isComplete = shouldShowConfirm && confirmPin.length === PIN_LENGTH
  const isMismatch = isComplete && pin !== confirmPin
  const isMatch = isComplete && pin === confirmPin

  const focusConfirmPin = useCallback(() => {
    requestAnimationFrame(() => confirmPinInputRef.current?.focus())
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Icon name="shield-lock" size={28} color={onboardingColors.primaryBlue} />
      </View>

      <Text style={styles.instruction}>{shouldShowConfirm ? 'Re-enter your PIN to confirm.' : 'Enter a new 6-digit PIN.'}</Text>

      {shouldShowConfirm ? (
        <PinStepSection
          label="Confirm PIN"
          helper="Make sure it matches your first PIN."
          value={confirmPin}
          onChange={onConfirmPinChange}
          inputRef={confirmPinInputRef}
          message={isMismatch ? 'PINs do not match. Please try again.' : isMatch ? 'PINs match.' : undefined}
          messageType={isMismatch ? 'error' : isMatch ? 'success' : undefined}
        />
      ) : (
        <PinStepSection
          label="Create PIN"
          helper="Use a PIN you can remember."
          value={pin}
          onChange={onPinChange}
          inputRef={pinInputRef}
          onComplete={focusConfirmPin}
          autoFocus
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 10,
    gap: 22,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.backgroundBlue,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  instruction: {
    maxWidth: 270,
    textAlign: 'center',
    color: onboardingColors.bodyText,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
})
