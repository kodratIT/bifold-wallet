import React from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'

import { onboardingColors } from '../../theme/onboarding'

type PinInputBoxesProps = {
  value: string
  onChange: (value: string) => void
  inputRef: React.RefObject<TextInput | null>
  onComplete?: () => void
  autoFocus?: boolean
}

const PIN_LENGTH = 6

export const PinInputBoxes: React.FC<PinInputBoxesProps> = ({ value, onChange, inputRef, onComplete, autoFocus = false }) => {
  const handleChange = (nextValue: string) => {
    const digitsOnly = nextValue.replace(/\D/g, '').slice(0, PIN_LENGTH)
    onChange(digitsOnly)

    if (digitsOnly.length === PIN_LENGTH) {
      onComplete?.()
    }
  }

  return (
    <Pressable accessibilityRole="button" onPress={() => inputRef.current?.focus()} style={styles.container}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={PIN_LENGTH}
        autoFocus={autoFocus}
        caretHidden
        contextMenuHidden
        importantForAutofill="no"
        style={styles.hiddenInput}
      />
      {Array.from({ length: PIN_LENGTH }).map((_, index) => {
        const filled = index < value.length
        return (
          <View key={index} style={styles.slot}>
            {filled ? <View style={styles.dot} /> : <View style={styles.emptyDot} />}
          </View>
        )
      })}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 300,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 8,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  slot: {
    width: 24,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: onboardingColors.border,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: onboardingColors.darkNavy,
  },
  emptyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E4ECFA',
  },
})
