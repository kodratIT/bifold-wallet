import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors } from '../../theme/onboarding'
import { CredentialCard } from './CredentialCard'

export const VerificationSuccessCard: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.successCircle}>
        <Icon name="check" size={34} color={onboardingColors.white} />
      </View>
      <Text style={styles.title}>Verified</Text>
      <Text style={styles.subtitle}>You’re all set!</Text>
      <View style={styles.cards}>
        <CredentialCard title="Digital ID" subtitle="Verified identity" icon="account-circle" />
        <CredentialCard title="Driver License" icon="car" />
        <CredentialCard title="Certificate" icon="medal-outline" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  successCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: onboardingColors.successGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: onboardingColors.successGreen,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 7,
  },
  title: {
    color: onboardingColors.darkNavy,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 16,
  },
  subtitle: {
    color: onboardingColors.bodyText,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  cards: {
    width: '100%',
    gap: 8,
    marginTop: 18,
  },
})
