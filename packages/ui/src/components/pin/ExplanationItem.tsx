import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors } from '../../theme/onboarding'

type ExplanationItemProps = {
  icon: string
  title: string
  body: string
  showDivider?: boolean
}

export const ExplanationItem: React.FC<ExplanationItemProps> = ({ icon, title, body, showDivider = true }) => {
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.iconContainer}>
          <Icon name={icon} size={20} color={onboardingColors.primaryBlue} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </View>
      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 15,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.backgroundBlue,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  copy: {
    flex: 1,
    gap: 5,
  },
  title: {
    color: onboardingColors.darkNavy,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  body: {
    color: onboardingColors.bodyText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginLeft: 52,
    backgroundColor: onboardingColors.border,
    opacity: 0.75,
  },
})
