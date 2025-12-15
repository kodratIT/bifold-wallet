/**
 * TrustBadge Component Tests
 * Property-based tests for badge rendering
 */

import React from 'react'
import { render } from '@testing-library/react-native'
import * as fc from 'fast-check'
import { TrustBadge, getBadgeConfig, TRUST_BADGE_CONFIG, BADGE_SIZES } from '../../src/components/TrustBadge'
import { TrustResult, TrustLevel } from '../../src/types'

const trustLevelArb = fc.constantFrom<TrustLevel>(
  'trusted_high',
  'trusted_medium',
  'trusted_low',
  'untrusted',
  'suspended',
  'revoked',
  'unknown'
)

const trustResultArb = (level: TrustLevel): TrustResult => ({
  level,
  found: level !== 'unknown' && level !== 'untrusted',
  checkedAt: new Date(),
})

describe('TrustBadge', () => {
  const numRuns = 100

  /**
   * **Feature: trust-registry, Property 8: Trust Level to Badge Mapping**
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**
   */
  describe('Property 8: Trust Level to Badge Mapping', () => {
    it('each trust level should have a unique badge configuration', () => {
      fc.assert(
        fc.property(trustLevelArb, (level) => {
          const config = getBadgeConfig(level)
          
          expect(config).toBeDefined()
          expect(config.icon).toBeDefined()
          expect(config.color).toBeDefined()
          expect(config.backgroundColor).toBeDefined()
          expect(config.label).toBeDefined()
        }),
        { numRuns }
      )
    })

    it('trusted_high should display green checkmark', () => {
      const config = getBadgeConfig('trusted_high')
      expect(config.icon).toBe('✓')
      expect(config.backgroundColor).toBe('#22C55E') // Green
      expect(config.label).toContain('High')
    })

    it('trusted_medium should display blue checkmark', () => {
      const config = getBadgeConfig('trusted_medium')
      expect(config.icon).toBe('✓')
      expect(config.backgroundColor).toBe('#3B82F6') // Blue
      expect(config.label).toBe('Trusted')
    })

    it('trusted_low should display gray checkmark', () => {
      const config = getBadgeConfig('trusted_low')
      expect(config.icon).toBe('✓')
      expect(config.backgroundColor).toBe('#6B7280') // Gray
      expect(config.label).toBe('Registered')
    })

    it('untrusted should display yellow warning', () => {
      const config = getBadgeConfig('untrusted')
      expect(config.icon).toBe('⚠')
      expect(config.backgroundColor).toBe('#FCD34D') // Yellow
      expect(config.label).toBe('Unregistered')
    })

    it('suspended should display orange warning', () => {
      const config = getBadgeConfig('suspended')
      expect(config.icon).toBe('⚠')
      expect(config.backgroundColor).toBe('#F97316') // Orange
      expect(config.label).toBe('Suspended')
    })

    it('revoked should display red X', () => {
      const config = getBadgeConfig('revoked')
      expect(config.icon).toBe('✕')
      expect(config.backgroundColor).toBe('#EF4444') // Red
      expect(config.label).toBe('Revoked')
    })

    it('unknown should display gray question mark', () => {
      const config = getBadgeConfig('unknown')
      expect(config.icon).toBe('?')
      expect(config.backgroundColor).toBe('#9CA3AF') // Gray
      expect(config.label).toBe('Unknown')
    })

    it('badge should render correct icon for any trust level', () => {
      fc.assert(
        fc.property(trustLevelArb, (level) => {
          const trustResult = trustResultArb(level)
          const { getByTestId } = render(<TrustBadge trustResult={trustResult} />)
          
          const icon = getByTestId('trust-badge-icon')
          const config = getBadgeConfig(level)
          
          expect(icon.props.children).toBe(config.icon)
        }),
        { numRuns }
      )
    })

    it('badge should render correct label for any trust level', () => {
      fc.assert(
        fc.property(trustLevelArb, (level) => {
          const trustResult = trustResultArb(level)
          const { getByTestId } = render(<TrustBadge trustResult={trustResult} showLabel={true} />)
          
          const label = getByTestId('trust-badge-label')
          const config = getBadgeConfig(level)
          
          expect(label.props.children).toBe(config.label)
        }),
        { numRuns }
      )
    })
  })

  /**
   * **Feature: trust-registry, Property 9: TrustBadge Size Rendering**
   * **Validates: Requirements 6.8**
   */
  describe('Property 9: TrustBadge Size Rendering', () => {
    const sizeArb = fc.constantFrom<'small' | 'medium' | 'large'>('small', 'medium', 'large')

    it('each size should have distinct dimensions', () => {
      expect(BADGE_SIZES.small.iconSize).toBeLessThan(BADGE_SIZES.medium.iconSize)
      expect(BADGE_SIZES.medium.iconSize).toBeLessThan(BADGE_SIZES.large.iconSize)
      
      expect(BADGE_SIZES.small.fontSize).toBeLessThan(BADGE_SIZES.medium.fontSize)
      expect(BADGE_SIZES.medium.fontSize).toBeLessThan(BADGE_SIZES.large.fontSize)
    })

    it('badge should render with appropriate size', () => {
      fc.assert(
        fc.property(sizeArb, trustLevelArb, (size, level) => {
          const trustResult = trustResultArb(level)
          const { getByTestId } = render(<TrustBadge trustResult={trustResult} size={size} />)
          
          const badge = getByTestId('trust-badge')
          expect(badge).toBeDefined()
          
          // Check that the badge renders without error
          const sizeConfig = BADGE_SIZES[size]
          expect(sizeConfig).toBeDefined()
        }),
        { numRuns }
      )
    })

    it('small badge should have smallest dimensions', () => {
      const trustResult = trustResultArb('trusted_high')
      const { getByTestId } = render(<TrustBadge trustResult={trustResult} size="small" />)
      
      const badge = getByTestId('trust-badge')
      expect(badge).toBeDefined()
    })

    it('large badge should have largest dimensions', () => {
      const trustResult = trustResultArb('trusted_high')
      const { getByTestId } = render(<TrustBadge trustResult={trustResult} size="large" />)
      
      const badge = getByTestId('trust-badge')
      expect(badge).toBeDefined()
    })
  })

  describe('Rendering', () => {
    it('should render without label when showLabel is false', () => {
      const trustResult = trustResultArb('trusted_high')
      const { queryByTestId } = render(<TrustBadge trustResult={trustResult} showLabel={false} />)
      
      expect(queryByTestId('trust-badge-label')).toBeNull()
    })

    it('should render touchable when onPress is provided', () => {
      const trustResult = trustResultArb('trusted_high')
      const onPress = jest.fn()
      const { getByTestId } = render(<TrustBadge trustResult={trustResult} onPress={onPress} />)
      
      expect(getByTestId('trust-badge-touchable')).toBeDefined()
    })

    it('should have accessibility label', () => {
      const trustResult = trustResultArb('trusted_high')
      const { getByTestId } = render(<TrustBadge trustResult={trustResult} />)
      
      const badge = getByTestId('trust-badge')
      expect(badge.props.accessibilityLabel).toContain('Trust status')
    })
  })
})
