/**
 * TrustBadge Component
 * Visual indicator for trust status based on authorization
 */

import React from 'react'
import { View, Text, TouchableOpacity, ViewStyle, TextStyle, ActivityIndicator } from 'react-native'
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
 * More informative labels based on authorization status
 */
export const TRUST_BADGE_CONFIG: Record<TrustLevel, BadgeConfig> = {
  trusted_high: {
    icon: '✓',
    color: '#FFFFFF',
    backgroundColor: '#22C55E', // Green
    label: 'Issuer Verified',
  },
  trusted_medium: {
    icon: '✓',
    color: '#FFFFFF',
    backgroundColor: '#3B82F6', // Blue
    label: 'Issuer Trusted',
  },
  trusted_low: {
    icon: '✓',
    color: '#FFFFFF',
    backgroundColor: '#6B7280', // Gray
    label: 'Issuer Registered',
  },
  untrusted: {
    icon: '⚠',
    color: '#000000',
    backgroundColor: '#FCD34D', // Yellow
    label: 'Issuer Not Verified',
  },
  unknown: {
    icon: '○',
    color: '#6B7280',
    backgroundColor: '#F3F4F6', // Light Gray
    label: 'Verifying Issuer...',
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
  /** Show loading indicator while checking */
  isLoading?: boolean
  /** Hide badge if unable to verify */
  hideOnError?: boolean
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
  isLoading = false,
  hideOnError = false,
}) => {
  // Don't show badge if hideOnError is true and status is unknown
  if (hideOnError && trustResult.level === 'unknown') {
    return null
  }

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

  // Show loading spinner if loading
  if (isLoading) {
    return (
      <View
        style={[containerStyle, { backgroundColor: '#F3F4F6' }, style]}
        testID={testID}
      >
        <ActivityIndicator size="small" color="#6B7280" />
        {showLabel && (
          <Text style={[labelStyle, { color: '#6B7280', marginLeft: 4 }]}>
            Checking...
          </Text>
        )}
      </View>
    )
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

export default TrustBadge
