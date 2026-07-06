import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialIcons'
import startCase from 'lodash.startcase'

import { useTheme } from '@bifold/core/src/contexts/theme'
import { hitSlop } from '@bifold/core/src/constants'
import { ThemedText } from '@bifold/core/src/components/texts/ThemedText'
import type { DisclosableClaim } from '../hooks/useClaimSelection'

interface ClaimToggleListProps {
  claims: DisclosableClaim[]
  selectedClaims: Record<string, boolean>
  showValues: boolean
  onToggleClaim: (claimName: string, value: boolean) => void
}

const formatLabel = (key: string, label?: string) => {
  if (label) return label
  if (key.includes('.')) {
    return key
      .split('.')
      .map((part) => startCase(part))
      .join(' \u2794 ')
  }
  return startCase(key)
}

const getAttributeIcon = (key: string) => {
  const k = key.toLowerCase()
  if (k.includes('name')) return 'person-outline'
  if (k.includes('birth') || k.includes('date')) return 'cake'
  if (k.includes('gender') || k.includes('sex')) return 'wc'
  if (k.includes('email')) return 'mail-outline'
  if (k.includes('phone') || k.includes('mobile')) return 'phone-iphone'
  if (k.includes('address') || k.includes('location') || k.includes('city') || k.includes('country')) return 'map'
  if (k.includes('over_') || k.includes('age')) return 'verified-user'
  if (k.includes('vct') || k.includes('type')) return 'fingerprint'
  return 'assignment'
}

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '\u2014'
  if (typeof value === 'object') {
    const extractLeafValues = (obj: Record<string, unknown>): string[] => {
      const vals: string[] = []
      for (const k in obj) {
        if (typeof obj[k] === 'object' && obj[k] !== null) {
          vals.push(...extractLeafValues(obj[k] as Record<string, unknown>))
        } else {
          vals.push(String(obj[k]))
        }
      }
      return vals
    }
    return extractLeafValues(value as Record<string, unknown>).join(', ') || '\u2014'
  }
  return String(value)
}

const ClaimToggleList: React.FC<ClaimToggleListProps> = ({
  claims,
  selectedClaims,
  showValues,
  onToggleClaim,
}) => {
  const { ColorPalette, TextTheme, Spacing } = useTheme()
  const { t } = useTranslation()

  if (claims.length === 0) return null

  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.lg,
    },
    card: {
      backgroundColor: ColorPalette.brand.secondaryBackground,
      borderRadius: 12,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(128, 128, 128, 0.12)',
    },
    cardDimmed: {
      opacity: 0.55,
    },
    info: {
      flex: 1,
      paddingRight: 10,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginBottom: 4,
    },
    label: {
      ...TextTheme.bold,
      fontSize: 15,
      marginLeft: 8,
    },
    value: {
      ...TextTheme.normal,
      fontSize: 14,
      marginLeft: 30,
      marginTop: 2,
    },
    badge: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
    },
    badgeText: {
      fontWeight: '700',
      fontSize: 10,
      color: '#EF4444',
      letterSpacing: 0.3,
    },
    checkbox: {
      padding: 6,
    },
  })

  return (
    <View style={styles.container}>
      {claims.map((item, index) => {
        const isChecked = selectedClaims[item.key] ?? false
        const rawValue = item.field?.value
        let displayValue = formatValue(rawValue)
        if (isChecked && !showValues && displayValue !== '\u2014') {
          displayValue = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'
        }
        const labelText = formatLabel(item.key, item.field?.label)
        const iconName = getAttributeIcon(item.key)

        return (
          <View
            key={item.key || index}
            style={[styles.card, !isChecked && styles.cardDimmed]}
          >
            <View style={styles.info}>
              <View style={styles.labelRow}>
                <Icon name={iconName} size={20} color={TextTheme.normal.color ?? '#888'} />
                <ThemedText style={styles.label}>{labelText}</ThemedText>
                {item.isRequired && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {t('ProofRequest.RequiredBadge', 'Required')}
                    </Text>
                  </View>
                )}
              </View>
              <ThemedText style={styles.value} numberOfLines={2}>
                {displayValue}
              </ThemedText>
            </View>
            <TouchableOpacity
              onPress={() => onToggleClaim(item.key, !isChecked)}
              style={styles.checkbox}
              hitSlop={hitSlop}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isChecked }}
            >
              <Icon
                name={isChecked ? 'check-circle' : 'radio-button-unchecked'}
                size={26}
                color={isChecked ? ColorPalette.brand.primary : TextTheme.normal.color ?? '#888'}
              />
            </TouchableOpacity>
          </View>
        )
      })}
    </View>
  )
}

export default ClaimToggleList
