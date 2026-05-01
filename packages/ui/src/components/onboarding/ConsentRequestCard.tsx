import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { onboardingColors } from '../../theme/onboarding'

const RequestedRow: React.FC<{ label: string; checked?: boolean }> = ({ label, checked = false }) => (
  <View style={styles.row}>
    <Text style={styles.rowText}>{label}</Text>
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked ? <Icon name="check" size={12} color={onboardingColors.white} /> : null}
    </View>
  </View>
)

export const ConsentRequestCard: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.serviceCard}>
        <View style={styles.serviceHeader}>
          <View style={styles.serviceIcon}>
            <Icon name="office-building" size={20} color={onboardingColors.primaryBlue} />
          </View>
          <View style={styles.serviceCopy}>
            <Text style={styles.serviceName}>Example Service</Text>
            <Text style={styles.serviceText}>is requesting the following information.</Text>
          </View>
        </View>
        <View style={styles.purposeRow}>
          <Text style={styles.badge}>Purpose</Text>
          <Text style={styles.purposeText}>Verify age and identity</Text>
        </View>
      </View>

      <View style={styles.dataCard}>
        <Text style={styles.sectionTitle}>Requested data</Text>
        <RequestedRow label="Date of birth (Age 18+)" checked />
        <RequestedRow label="Full name" checked />
        <RequestedRow label="Address" />
      </View>

      <View style={styles.controlCard}>
        <View style={styles.controlIcon}>
          <Icon name="shield-check" size={18} color={onboardingColors.successGreen} />
        </View>
        <View style={styles.controlCopy}>
          <Text style={styles.controlTitle}>You’re in control</Text>
          <Text style={styles.controlText}>Review and share only what you choose.</Text>
          <Text style={styles.footerText}>Your consent will be recorded</Text>
        </View>
        <View style={styles.sharePill}>
          <Text style={styles.shareText}>Share</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  serviceCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: onboardingColors.white,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  serviceIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.backgroundBlue,
  },
  serviceCopy: {
    flex: 1,
  },
  serviceName: {
    color: onboardingColors.darkNavy,
    fontSize: 14,
    fontWeight: '800',
  },
  serviceText: {
    color: onboardingColors.bodyText,
    fontSize: 10,
    marginTop: 2,
  },
  purposeRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: onboardingColors.softYellow,
    color: onboardingColors.darkNavy,
    fontSize: 10,
    fontWeight: '800',
  },
  purposeText: {
    color: onboardingColors.bodyText,
    fontSize: 11,
    fontWeight: '600',
  },
  dataCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: onboardingColors.backgroundSoft,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    gap: 8,
  },
  sectionTitle: {
    color: onboardingColors.darkNavy,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  row: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    flex: 1,
    color: onboardingColors.bodyText,
    fontSize: 11,
    fontWeight: '600',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: onboardingColors.successGreen,
    borderColor: onboardingColors.successGreen,
  },
  controlCard: {
    borderRadius: 20,
    padding: 12,
    backgroundColor: onboardingColors.softGreen,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.white,
  },
  controlCopy: {
    flex: 1,
  },
  controlTitle: {
    color: onboardingColors.darkNavy,
    fontSize: 12,
    fontWeight: '800',
  },
  controlText: {
    color: onboardingColors.bodyText,
    fontSize: 10,
    marginTop: 2,
  },
  footerText: {
    color: onboardingColors.successGreen,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 5,
  },
  sharePill: {
    borderRadius: 999,
    backgroundColor: onboardingColors.successGreen,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  shareText: {
    color: onboardingColors.white,
    fontSize: 11,
    fontWeight: '800',
  },
})
