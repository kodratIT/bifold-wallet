import React from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialIcons'

import { useTheme } from '@bifold/core/src/contexts/theme'
import { ThemedText } from '@bifold/core/src/components/texts/ThemedText'

interface SectionHeaderProps {
  icon?: string
  title: string
  subtitle?: string
  action?: {
    icon: string
    label: string
    onPress: () => void
  }
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, subtitle, action }) => {
  const { ColorPalette, TextTheme, Spacing } = useTheme()

  const styles = StyleSheet.create({
    wrapper: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.lg,
      paddingBottom: subtitle ? Spacing.xs : Spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    title: {
      ...TextTheme.bold,
      fontSize: 18,
      marginLeft: icon ? Spacing.sm : 0,
    },
    subtitle: {
      ...TextTheme.normal,
      fontSize: 14,
      paddingTop: Spacing.xs,
      lineHeight: 20,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: Spacing.sm,
    },
    actionLabel: {
      ...TextTheme.normal,
      fontSize: 13,
      marginLeft: 4,
    },
  })

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          {icon && <Icon name={icon} size={24} color={ColorPalette.brand.primary} />}
          <ThemedText style={styles.title}>{title}</ThemedText>
        </View>
        {action && (
          <TouchableOpacity style={styles.actionRow} onPress={action.onPress}>
            <Icon name={action.icon} size={20} color={TextTheme.normal.color ?? '#888'} />
            <ThemedText style={styles.actionLabel}>{action.label}</ThemedText>
          </TouchableOpacity>
        )}
      </View>
      {subtitle && <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>}
    </View>
  )
}

export default SectionHeader
