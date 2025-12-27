/**
 * TrustWarning Component
 * Warning banner for untrusted entities (based on authorization)
 */

import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native'
import { TrustResult, TrustLevel } from '../types'

/**
 * Warning configuration for each trust level
 */
export interface WarningConfig {
  icon: string
  backgroundColor: string
  textColor: string
  title: string
  message: string
  dismissible: boolean
}

/**
 * Get warning configuration based on trust level
 * Simplified for authorization-based flow
 */
export function getWarningConfig(level: TrustLevel, entityType: 'issuer' | 'verifier'): WarningConfig | null {
  const entityLabel = entityType === 'issuer' ? 'Issuer' : 'Verifier'

  switch (level) {
    case 'untrusted':
      return {
        icon: '⚠️',
        backgroundColor: '#FEF3C7', // Yellow-100
        textColor: '#92400E', // Yellow-800
        title: `${entityLabel} Not Authorized`,
        message: `This ${entityLabel.toLowerCase()} is not authorized in the trust registry. Proceed with caution.`,
        dismissible: true,
      }
    case 'unknown':
      return {
        icon: '❓',
        backgroundColor: '#F3F4F6', // Gray-100
        textColor: '#374151', // Gray-700
        title: 'Authorization Status Unknown',
        message: 'Unable to verify authorization status. The trust registry may be unavailable.',
        dismissible: true,
      }
    default:
      return null // No warning for authorized entities
  }
}

/**
 * Check if a trust level should show a warning
 */
export function shouldShowWarning(level: TrustLevel): boolean {
  return ['untrusted', 'unknown'].includes(level)
}

/**
 * Check if a warning is dismissible based on trust level
 */
export function isDismissible(level: TrustLevel): boolean {
  return level === 'untrusted' || level === 'unknown'
}

/**
 * Props for TrustWarning component
 */
export interface TrustWarningProps {
  /** Trust result to display warning for */
  trustResult: TrustResult
  /** Type of entity (issuer or verifier) */
  entityType: 'issuer' | 'verifier'
  /** Callback when warning is dismissed */
  onDismiss?: () => void
  /** Callback when "Learn more" is pressed */
  onLearnMore?: () => void
  /** Custom style for the container */
  style?: ViewStyle
  /** Test ID for testing */
  testID?: string
}

/**
 * TrustWarning Component
 */
export const TrustWarning: React.FC<TrustWarningProps> = ({
  trustResult,
  entityType,
  onDismiss,
  onLearnMore,
  style,
  testID = 'trust-warning',
}) => {
  const [dismissed, setDismissed] = useState(false)

  const config = getWarningConfig(trustResult.level, entityType)

  // Don't render if no warning needed or dismissed
  if (!config || dismissed) {
    return null
  }

  const handleDismiss = () => {
    if (config.dismissible) {
      setDismissed(true)
      onDismiss?.()
    }
  }

  return (
    <View
      style={[styles.container, { backgroundColor: config.backgroundColor }, style]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel={`Warning: ${config.title}. ${config.message}`}
    >
      <View style={styles.content}>
        <Text style={styles.icon} testID={`${testID}-icon`}>
          {config.icon}
        </Text>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: config.textColor }]} testID={`${testID}-title`}>
            {config.title}
          </Text>
          <Text style={[styles.message, { color: config.textColor }]} testID={`${testID}-message`}>
            {config.message}
          </Text>
          {onLearnMore && (
            <TouchableOpacity
              onPress={onLearnMore}
              accessibilityRole="link"
              accessibilityLabel="Learn more about trust verification"
              testID={`${testID}-learn-more`}
            >
              <Text style={[styles.learnMore, { color: config.textColor }]}>Learn more</Text>
            </TouchableOpacity>
          )}
        </View>
        {config.dismissible && (
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.dismissButton}
            accessibilityRole="button"
            accessibilityLabel="Dismiss warning"
            testID={`${testID}-dismiss`}
          >
            <Text style={[styles.dismissText, { color: config.textColor }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  learnMore: {
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
    marginTop: 8,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
  dismissText: {
    fontSize: 16,
    fontWeight: '500',
  },
})

export default TrustWarning
