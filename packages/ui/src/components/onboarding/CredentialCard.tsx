import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors } from '../../theme/onboarding'

type CredentialCardProps = {
  title: string
  subtitle?: string
  icon: string
}

export const CredentialCard: React.FC<CredentialCardProps> = ({ title, subtitle, icon }) => {
  return (
    <View style={styles.card}>
      <View style={styles.leftIcon}>
        <Icon name={icon} size={18} color={onboardingColors.primaryBlue} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.checkBadge}>
        <Icon name="check" size={14} color={onboardingColors.white} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: onboardingColors.white,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#0B3B8F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  leftIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.backgroundBlue,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: onboardingColors.darkNavy,
    fontSize: 13,
    fontWeight: '800',
  },
  subtitle: {
    color: onboardingColors.bodyText,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.successGreen,
  },
})
