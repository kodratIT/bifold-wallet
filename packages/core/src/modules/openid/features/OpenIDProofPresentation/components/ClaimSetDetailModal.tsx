import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { hitSlop } from '../../../../../constants'
import { useTheme } from '../../../../../contexts/theme'
import Button, { ButtonType } from '../../../../../components/buttons/Button'
import { ThemedText } from '../../../../../components/texts/ThemedText'
import SafeAreaModal from '../../../../../components/modals/SafeAreaModal'

interface ClaimSetDetailModalProps {
  visible: boolean
  claimSetLabel: string
  claimKeys: string[]
  requestedAttributes: string[]
  onClose: () => void
}

const ClaimSetDetailModal: React.FC<ClaimSetDetailModalProps> = ({
  visible,
  claimSetLabel,
  claimKeys,
  requestedAttributes,
  onClose,
}) => {
  const { ColorPalette, TextTheme, Spacing, ListItems } = useTheme()
  const { t } = useTranslation()
  const requestedSet = new Set(requestedAttributes)

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: ColorPalette.brand.primaryBackground,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: ColorPalette.brand.secondaryBackground,
    },
    headerTitle: {
      ...TextTheme.headingThree,
      flex: 1,
      marginRight: Spacing.sm,
    },
    closeButton: {
      padding: Spacing.xs,
    },
    content: {
      padding: Spacing.md,
    },
    sectionTitle: {
      ...TextTheme.headingFour,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    claimRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: ColorPalette.brand.secondaryBackground,
    },
    claimIcon: {
      marginRight: Spacing.sm,
    },
    claimLabel: {
      ...ListItems.recordAttributeLabel,
      flex: 1,
    },
    claimPath: {
      ...TextTheme.caption,
      color: ColorPalette.grayscale.mediumGrey,
      marginTop: 2,
    },
    badge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: Spacing.sm,
    },
    badgeRequired: {
      backgroundColor: ColorPalette.semantic.error + '22',
    },
    badgeOptional: {
      backgroundColor: ColorPalette.grayscale.mediumGrey + '33',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    badgeTextRequired: {
      color: ColorPalette.semantic.error,
    },
    badgeTextOptional: {
      color: ColorPalette.grayscale.mediumGrey,
    },
    summary: {
      ...ListItems.recordContainer,
      padding: Spacing.md,
      borderRadius: 8,
      marginVertical: Spacing.sm,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: Spacing.xs,
    },
    summaryLabel: {
      ...TextTheme.caption,
      color: ColorPalette.grayscale.mediumGrey,
    },
    summaryValue: {
      ...TextTheme.bold,
    },
    footer: {
      padding: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: ColorPalette.brand.secondaryBackground,
    },
    setLabel: {
    ...TextTheme.normal,
      color: ColorPalette.brand.primary,
      fontWeight: '600',
      marginBottom: Spacing.sm,
    },
  })

  const totalCount = claimKeys.length
  const requiredCount = claimKeys.filter((k) => requestedSet.has(k)).length
  const optionalCount = totalCount - requiredCount

  return (
    <SafeAreaModal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle} variant="headingThree">
            Detail Claim Set
          </ThemedText>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={hitSlop}
            accessibilityLabel="Close"
          >
            <Icon name="close" size={28} color={ColorPalette.brand.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Claim Set Name */}
          <ThemedText style={styles.setLabel}>{claimSetLabel}</ThemedText>

          {/* Summary Card */}
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Total Claims</ThemedText>
              <ThemedText style={styles.summaryValue}>{totalCount}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Required (by verifier)</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: ColorPalette.semantic.error }]}>
                {requiredCount}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Optional</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: ColorPalette.grayscale.mediumGrey }]}>
                {optionalCount}
              </ThemedText>
            </View>
          </View>

          {/* Claims List */}
          <ThemedText style={styles.sectionTitle}>Claims in this set</ThemedText>
          {claimKeys.map((key) => {
            const isRequired = requestedSet.has(key)
            return (
              <View key={key} style={styles.claimRow}>
                <Icon
                  style={styles.claimIcon}
                  name={isRequired ? 'lock' : 'lock-open'}
                  size={20}
                  color={isRequired ? ColorPalette.semantic.error : ColorPalette.grayscale.mediumGrey}
                />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.claimLabel}>{key}</ThemedText>
                  <ThemedText style={styles.claimPath}>{key}</ThemedText>
                </View>
                <View style={[styles.badge, isRequired ? styles.badgeRequired : styles.badgeOptional]}>
                  <ThemedText style={[styles.badgeText, isRequired ? styles.badgeTextRequired : styles.badgeTextOptional]}>
                    {isRequired ? 'Required' : 'Optional'}
                  </ThemedText>
                </View>
              </View>
            )
          })}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title={t('Global.Ok')}
            buttonType={ButtonType.Primary}
            onPress={onClose}
          />
        </View>
      </SafeAreaView>
    </SafeAreaModal>
  )
}

export default ClaimSetDetailModal
