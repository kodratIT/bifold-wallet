import React from 'react'
import { StyleSheet, View } from 'react-native'

import { KeypadButton } from './KeypadButton'

type NumericKeypadProps = {
  onDigitPress: (digit: string) => void
  onBackspace: () => void
  onFingerprintPress?: () => void
  canBackspace?: boolean
}

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onDigitPress,
  onBackspace,
  onFingerprintPress = () => {},
  canBackspace = false,
}) => {
  return (
    <View style={styles.container}>
      {keys.map((key) => (
        <KeypadButton key={key} label={key} onPress={() => onDigitPress(key)} />
      ))}
      <KeypadButton icon="fingerprint" onPress={onFingerprintPress} />
      <KeypadButton label="0" onPress={() => onDigitPress('0')} />
      <KeypadButton icon="backspace-outline" onPress={onBackspace} disabled={!canBackspace} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    width: 222,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 11,
  },
})
