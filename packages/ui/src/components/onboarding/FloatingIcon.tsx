import React from 'react'
import { StyleSheet, View, ViewStyle } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors, onboardingShadow } from '../../theme/onboarding'

type FloatingIconProps = {
  name: string
  style?: ViewStyle
  connectorStyle?: ViewStyle
}

export const FloatingIcon: React.FC<FloatingIconProps> = ({ name, style, connectorStyle }) => {
  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      {connectorStyle ? <View style={[styles.connector, connectorStyle]} /> : null}
      <View style={styles.iconBubble}>
        <Icon name={name} size={20} color={onboardingColors.primaryBlue} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 5,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: onboardingColors.white,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...onboardingShadow,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 5,
  },
  connector: {
    position: 'absolute',
    height: 1,
    borderStyle: 'dotted',
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
})
