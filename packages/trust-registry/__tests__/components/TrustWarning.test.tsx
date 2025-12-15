/**
 * TrustWarning Component Tests
 * Property-based tests for warning behavior
 */

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import * as fc from 'fast-check'
import {
  TrustWarning,
  getWarningConfig,
  shouldShowWarning,
  isDismissible,
} from '../../src/components/TrustWarning'
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

const warningLevelArb = fc.constantFrom<TrustLevel>('untrusted', 'suspended', 'revoked', 'unknown')

const entityTypeArb = fc.constantFrom<'issuer' | 'verifier'>('issuer', 'verifier')

const trustResultArb = (level: TrustLevel): TrustResult => ({
  level,
  found: level !== 'unknown' && level !== 'untrusted',
  checkedAt: new Date(),
})

describe('TrustWarning', () => {
  const numRuns = 100

  /**
   * **Feature: trust-registry, Property 10: TrustWarning Dismissibility Based on Status**
   * **Validates: Requirements 7.1, 7.2**
   */
  describe('Property 10: TrustWarning Dismissibility Based on Status', () => {
    it('untrusted warnings should be dismissible', () => {
      expect(isDismissible('untrusted')).toBe(true)
      
      const config = getWarningConfig('untrusted', 'issuer')
      expect(config?.dismissible).toBe(true)
    })

    it('unknown warnings should be dismissible', () => {
      expect(isDismissible('unknown')).toBe(true)
      
      const config = getWarningConfig('unknown', 'issuer')
      expect(config?.dismissible).toBe(true)
    })

    it('suspended warnings should NOT be dismissible', () => {
      expect(isDismissible('suspended')).toBe(false)
      
      const config = getWarningConfig('suspended', 'issuer')
      expect(config?.dismissible).toBe(false)
    })

    it('revoked warnings should NOT be dismissible', () => {
      expect(isDismissible('revoked')).toBe(false)
      
      const config = getWarningConfig('revoked', 'issuer')
      expect(config?.dismissible).toBe(false)
    })

    it('dismissible warnings should render dismiss button', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<TrustLevel>('untrusted', 'unknown'),
          entityTypeArb,
          (level, entityType) => {
            const trustResult = trustResultArb(level)
            const { queryByTestId } = render(
              <TrustWarning trustResult={trustResult} entityType={entityType} />
            )
            
            expect(queryByTestId('trust-warning-dismiss')).not.toBeNull()
          }
        ),
        { numRuns }
      )
    })

    it('non-dismissible warnings should NOT render dismiss button', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<TrustLevel>('suspended', 'revoked'),
          entityTypeArb,
          (level, entityType) => {
            const trustResult = trustResultArb(level)
            const { queryByTestId } = render(
              <TrustWarning trustResult={trustResult} entityType={entityType} />
            )
            
            expect(queryByTestId('trust-warning-dismiss')).toBeNull()
          }
        ),
        { numRuns }
      )
    })

    it('clicking dismiss should hide dismissible warning', () => {
      const trustResult = trustResultArb('untrusted')
      const onDismiss = jest.fn()
      const { getByTestId, queryByTestId } = render(
        <TrustWarning trustResult={trustResult} entityType="issuer" onDismiss={onDismiss} />
      )
      
      fireEvent.press(getByTestId('trust-warning-dismiss'))
      
      expect(onDismiss).toHaveBeenCalled()
      expect(queryByTestId('trust-warning')).toBeNull()
    })
  })

  /**
   * **Feature: trust-registry, Property 11: TrustWarning Accessibility**
   * **Validates: Requirements 7.4**
   */
  describe('Property 11: TrustWarning Accessibility', () => {
    it('warning should have alert role', () => {
      fc.assert(
        fc.property(warningLevelArb, entityTypeArb, (level, entityType) => {
          const trustResult = trustResultArb(level)
          const { getByTestId } = render(
            <TrustWarning trustResult={trustResult} entityType={entityType} />
          )
          
          const warning = getByTestId('trust-warning')
          expect(warning.props.accessibilityRole).toBe('alert')
        }),
        { numRuns }
      )
    })

    it('warning should have accessibility label', () => {
      fc.assert(
        fc.property(warningLevelArb, entityTypeArb, (level, entityType) => {
          const trustResult = trustResultArb(level)
          const { getByTestId } = render(
            <TrustWarning trustResult={trustResult} entityType={entityType} />
          )
          
          const warning = getByTestId('trust-warning')
          expect(warning.props.accessibilityLabel).toBeDefined()
          expect(warning.props.accessibilityLabel).toContain('Warning')
        }),
        { numRuns }
      )
    })

    it('learn more link should have link role', () => {
      const trustResult = trustResultArb('untrusted')
      const onLearnMore = jest.fn()
      const { getByTestId } = render(
        <TrustWarning trustResult={trustResult} entityType="issuer" onLearnMore={onLearnMore} />
      )
      
      const learnMore = getByTestId('trust-warning-learn-more')
      expect(learnMore.props.accessibilityRole).toBe('link')
    })

    it('dismiss button should have button role', () => {
      const trustResult = trustResultArb('untrusted')
      const { getByTestId } = render(
        <TrustWarning trustResult={trustResult} entityType="issuer" />
      )
      
      const dismiss = getByTestId('trust-warning-dismiss')
      expect(dismiss.props.accessibilityRole).toBe('button')
    })
  })

  describe('shouldShowWarning', () => {
    it('should return true for warning levels', () => {
      expect(shouldShowWarning('untrusted')).toBe(true)
      expect(shouldShowWarning('suspended')).toBe(true)
      expect(shouldShowWarning('revoked')).toBe(true)
      expect(shouldShowWarning('unknown')).toBe(true)
    })

    it('should return false for trusted levels', () => {
      expect(shouldShowWarning('trusted_high')).toBe(false)
      expect(shouldShowWarning('trusted_medium')).toBe(false)
      expect(shouldShowWarning('trusted_low')).toBe(false)
    })
  })

  describe('Rendering', () => {
    it('should not render for trusted entities', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<TrustLevel>('trusted_high', 'trusted_medium', 'trusted_low'),
          entityTypeArb,
          (level, entityType) => {
            const trustResult = trustResultArb(level)
            const { queryByTestId } = render(
              <TrustWarning trustResult={trustResult} entityType={entityType} />
            )
            
            expect(queryByTestId('trust-warning')).toBeNull()
          }
        ),
        { numRuns }
      )
    })

    it('should render for warning levels', () => {
      fc.assert(
        fc.property(warningLevelArb, entityTypeArb, (level, entityType) => {
          const trustResult = trustResultArb(level)
          const { getByTestId } = render(
            <TrustWarning trustResult={trustResult} entityType={entityType} />
          )
          
          expect(getByTestId('trust-warning')).toBeDefined()
        }),
        { numRuns }
      )
    })

    it('should render learn more when callback provided', () => {
      const trustResult = trustResultArb('untrusted')
      const onLearnMore = jest.fn()
      const { getByTestId } = render(
        <TrustWarning trustResult={trustResult} entityType="issuer" onLearnMore={onLearnMore} />
      )
      
      const learnMore = getByTestId('trust-warning-learn-more')
      fireEvent.press(learnMore)
      
      expect(onLearnMore).toHaveBeenCalled()
    })
  })
})
