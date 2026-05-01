import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors, onboardingTypography } from '../../theme/onboarding'

export const AppHeader: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon name="shield-account" size={18} color={onboardingColors.primaryBlue} />
      </View>
      <Text style={styles.title}>SSI Wallet</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.backgroundBlue,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  title: {
    ...onboardingTypography.appName,
    color: onboardingColors.darkNavy,
  },
})
