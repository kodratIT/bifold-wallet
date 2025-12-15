/**
 * TrustBadge Component
 * Visual indicator for trust status
 */

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { TrustResult, TrustLevel } from '../types'

/**
 * Badge configuration for each trust level
 */
export interface BadgeConfig {
  icon: string
  color: string
  backgroundColor: string
  label: string
}

/**
 * Trust level to badge configuration mapping
 */
export const TRUST_BADGE_CONFIG: Record<TrustLevel, BadgeConfig> = {
  trusted_high: {
    icon: '✓',
    color: '#FFFFFF',
    backgroundColor: '#22C55E', // Green
    label: 'Trusted - High Accreditation',
  },
  trusted_medium: {
    icon: '✓',
    color: '#FFFFFF',
    backgroundColor: '#3B82F6', // Blue
    label: 'Trusted',
  },
  trusted_low: {
    icon: '✓',
    color: '#FFFFFF',
    backgroundColor: '#6B7280', // Gray
    label: 'Registered',
  },
  untrusted: {
    icon: '⚠',
    color: '#000000',
    backgroundColor: '#FCD34D', // Yellow
    label: 'Unregistered',
  },
  suspended: {
    icon: '⚠',
    color: '#FFFFFF',
    backgroundColor: '#F97316', // Orange
    label: 'Suspended',
  },
  revoked: {
    icon: '✕',
    color: '#FFFFFF',
    backgroundColor: '#EF4444', // Red
    label: 'Revoked',
  },
  unknown: {
    icon: '?',
    color: '#FFFFFF',
    backgroundColor: '#9CA3AF', // Gray
    label: 'Unknown',
  },
}

/**
 * Size configurations
 */
export const BADGE_SIZES = {
  small: {
    iconSize: 12,
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  medium: {
    iconSize: 16,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  large: {
    iconSize: 20,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
}

/**
 * Props for TrustBadge component
 */
export interface TrustBadgeProps {
  /** Trust result to display */
  trustResult: TrustResult
  /** Badge size */
  size?: 'small' | 'medium' | 'large'
  /** Whether to show the label text */
  showLabel?: boolean
  /** Callback when badge is pressed */
  onPress?: () => void
  /** Custom style for the container */
  style?: ViewStyle
  /** Test ID for testing */
  testID?: string
}

/**
 * Get badge configuration for a trust level
 */
export function getBadgeConfig(level: TrustLevel): BadgeConfig {
  return TRUST_BADGE_CONFIG[level] ?? TRUST_BADGE_CONFIG.unknown
}

/**
 * TrustBadge Component
 */
export const TrustBadge: React.FC<TrustBadgeProps> = ({
  trustResult,
  size = 'medium',
  showLabel = true,
  onPress,
  style,
  testID = 'trust-badge',
}) => {
  const config = getBadgeConfig(trustResult.level)
  const sizeConfig = BADGE_SIZES[size]

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: config.backgroundColor,
    paddingHorizontal: sizeConfig.paddingHorizontal,
    paddingVertical: sizeConfig.paddingVertical,
    borderRadius: sizeConfig.borderRadius,
  }

  const iconStyle: TextStyle = {
    fontSize: sizeConfig.iconSize,
    color: config.color,
    marginRight: showLabel ? 4 : 0,
  }

  const labelStyle: TextStyle = {
    fontSize: sizeConfig.fontSize,
    color: config.color,
    fontWeight: '500',
  }

  const content = (
    <View
      style={[containerStyle, style]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={`Trust status: ${config.label}`}
    >
      <Text style={iconStyle} testID={`${testID}-icon`}>
        {config.icon}
      </Text>
      {showLabel && (
        <Text style={labelStyle} testID={`${testID}-label`}>
          {config.label}
        </Text>
      )}
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View trust details: ${config.label}`}
        testID={`${testID}-touchable`}
      >
        {content}
      </TouchableOpacity>
    )
  }

  return content
}

const styles = StyleSheet.create({
  // Styles are inline for flexibility, but can be extracted here if needed
})

export default TrustBadge
