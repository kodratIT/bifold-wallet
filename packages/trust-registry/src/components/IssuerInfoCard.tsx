/**
 * IssuerInfoCard Component
 * Display detailed issuer information from trust registry
 */

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native'
import { IssuerInfo, AccreditationLevel } from '../types'

/**
 * Accreditation level display configuration
 */
export const ACCREDITATION_CONFIG: Record<AccreditationLevel, { label: string; color: string; icon: string }> = {
  high: {
    label: 'High Accreditation',
    color: '#22C55E',
    icon: '🏆',
  },
  medium: {
    label: 'Medium Accreditation',
    color: '#3B82F6',
    icon: '✓',
  },
  low: {
    label: 'Basic Accreditation',
    color: '#6B7280',
    icon: '○',
  },
}

/**
 * Format date string for display
 */
export function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

/**
 * Props for IssuerInfoCard component
 */
export interface IssuerInfoCardProps {
  /** Issuer information to display */
  issuerInfo: IssuerInfo
  /** Callback when card is pressed */
  onPress?: () => void
  /** Custom style for the container */
  style?: ViewStyle
  /** Test ID for testing */
  testID?: string
}

/**
 * IssuerInfoCard Component
 */
export const IssuerInfoCard: React.FC<IssuerInfoCardProps> = ({
  issuerInfo,
  onPress,
  style,
  testID = 'issuer-info-card',
}) => {
  const accreditationConfig = issuerInfo.accreditationLevel
    ? ACCREDITATION_CONFIG[issuerInfo.accreditationLevel]
    : null

  const content = (
    <View style={[styles.container, style]} testID={testID}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name} testID={`${testID}-name`}>
          {issuerInfo.name}
        </Text>
        {accreditationConfig && (
          <View
            style={[styles.accreditationBadge, { backgroundColor: accreditationConfig.color }]}
            testID={`${testID}-accreditation`}
          >
            <Text style={styles.accreditationIcon}>{accreditationConfig.icon}</Text>
            <Text style={styles.accreditationLabel}>{accreditationConfig.label}</Text>
          </View>
        )}
      </View>

      {/* DID */}
      <View style={styles.row}>
        <Text style={styles.label}>DID</Text>
        <Text style={styles.did} testID={`${testID}-did`} numberOfLines={1} ellipsizeMode="middle">
          {issuerInfo.did}
        </Text>
      </View>

      {/* Credential Types */}
      {issuerInfo.credentialTypes && issuerInfo.credentialTypes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authorized Credential Types</Text>
          <View style={styles.credentialTypes} testID={`${testID}-credential-types`}>
            {issuerInfo.credentialTypes.map((credType, index) => (
              <View key={credType.id ?? index} style={styles.credentialTypeBadge}>
                <Text style={styles.credentialTypeText}>{credType.name ?? credType.type}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Validity Period */}
      {(issuerInfo.validFrom || issuerInfo.validUntil) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Validity Period</Text>
          <View style={styles.validityRow} testID={`${testID}-validity`}>
            <Text style={styles.validityText}>
              {formatDate(issuerInfo.validFrom)} - {formatDate(issuerInfo.validUntil)}
            </Text>
          </View>
        </View>
      )}

      {/* Registry Info */}
      {issuerInfo.registry && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registry</Text>
          <Text style={styles.registryName} testID={`${testID}-registry`}>
            {issuerInfo.registry.name}
          </Text>
          {issuerInfo.registry.ecosystemDid && (
            <Text style={styles.ecosystemDid} numberOfLines={1} ellipsizeMode="middle">
              {issuerInfo.registry.ecosystemDid}
            </Text>
          )}
        </View>
      )}

      {/* Jurisdictions */}
      {issuerInfo.jurisdictions && issuerInfo.jurisdictions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jurisdictions</Text>
          <View style={styles.jurisdictions}>
            {issuerInfo.jurisdictions.map((jurisdiction, index) => (
              <View key={`jurisdiction-${index}-${jurisdiction.code}`} style={styles.jurisdictionBadge}>
                <Text style={styles.jurisdictionText}>
                  {jurisdiction.name ?? jurisdiction.code}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${issuerInfo.name}`}
        testID={`${testID}-touchable`}
      >
        {content}
      </TouchableOpacity>
    )
  }

  return content
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  accreditationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  accreditationIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  accreditationLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  did: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'monospace',
  },
  section: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  credentialTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  credentialTypeBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  credentialTypeText: {
    fontSize: 12,
    color: '#4F46E5',
  },
  validityRow: {
    flexDirection: 'row',
  },
  validityText: {
    fontSize: 13,
    color: '#374151',
  },
  registryName: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  ecosystemDid: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  jurisdictions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  jurisdictionBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  jurisdictionText: {
    fontSize: 12,
    color: '#374151',
  },
})

export default IssuerInfoCard
