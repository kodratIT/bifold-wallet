import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors } from '../../theme/onboarding'

type TermsSectionItemProps = {
  icon: string
  title: string
  description: string
  showDivider?: boolean
}

export const TermsSectionItem: React.FC<TermsSectionItemProps> = ({ icon, title, description, showDivider = true }) => {
  return (
    <View>
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Icon name={icon} size={20} color={onboardingColors.primaryBlue} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.backgroundBlue,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: onboardingColors.darkNavy,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  description: {
    color: onboardingColors.bodyText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginLeft: 54,
    backgroundColor: onboardingColors.border,
    opacity: 0.72,
  },
})
