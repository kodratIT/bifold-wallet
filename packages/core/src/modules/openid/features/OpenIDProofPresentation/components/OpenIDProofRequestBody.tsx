import React, { useCallback, useState } from 'react'
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/MaterialIcons'

import { useTheme } from '../../../../../contexts/theme'
import { buildFieldsFromW3cCredsCredential } from '../../../../../utils/oca'
import { getCredentialForDisplay } from '../../../display'
import CredentialCardGen from '../../../../../components/misc/CredentialCardGen'
import Record from '../../../../../components/record/Record'
import RecordField from '../../../../../components/record/RecordField'
import OpenIDUnsatisfiedProofRequest from '../../../components/OpenIDUnsatisfiedProofRequest'
import { FormattedSubmission } from '../../../types'
import { type SelectedCredentialsFormat } from '../../../types'
import type { OpenIDCredentialRecord } from '../../../credentialRecord'
import { ThemedText } from '../../../../../components/texts/ThemedText'
import { hitSlop } from '../../../../../constants'
import { Field } from '@bifold/oca/build/legacy'
import startCase from 'lodash.startcase'
import ClaimSetDetailModal from './ClaimSetDetailModal'
import type { ClaimSetGroup } from '../../../types'

interface OpenIDProofRequestBodyProps {
  credentialsRequested: OpenIDCredentialRecord[]
  onPressAltCredChange: (inputDescriptorID: string, selectedCredID: string) => void
  selectedCredentialsSubmission?: SelectedCredentialsFormat
  submission?: FormattedSubmission
  verifierName: string
  onClaimsToggle?: (inputDescriptorId: string, disclosedClaims: string[]) => void
}

const OpenIDProofRequestBody: React.FC<OpenIDProofRequestBodyProps> = ({
  credentialsRequested,
  onPressAltCredChange,
  selectedCredentialsSubmission,
  submission,
  verifierName,
  onClaimsToggle,
}) => {
  console.log('[DEBUG] OpenIDProofRequestBody — selectedCredentialsSubmission:', selectedCredentialsSubmission ? Object.keys(selectedCredentialsSubmission) : 'undefined')
  console.log('[DEBUG] OpenIDProofRequestBody — submission exists:', !!submission)
  console.log('[DEBUG] OpenIDProofRequestBody — submission entries count:', submission?.entries?.length ?? 0)
  console.log('[DEBUG] OpenIDProofRequestBody — credentialsRequested count:', credentialsRequested?.length ?? 0)
  const { ColorPalette, Spacing, ListItems, TextTheme, Inputs } = useTheme()
  const { t, i18n } = useTranslation()

  const styles = StyleSheet.create({
    cardContainer: {
      paddingHorizontal: 12,
      paddingBottom: 24,
    },
    detailContainer: {
      paddingHorizontal: 8,
      paddingVertical: 16,
      backgroundColor: ColorPalette.brand.secondaryBackground,
      marginBottom: 20,
    },
    cardGroupHeader: {
      padding: 8,
      marginVertical: 8,
    },
    credentialsList: {
      marginTop: 20,
    },
    optionalRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: ColorPalette.brand.secondaryBackground,
    },
    optionalContent: {
      flex: 1,
      marginLeft: 8,
    },
    optionalLabel: {
      ...ListItems.recordAttributeLabel,
    },
    optionalValue: {
      ...ListItems.recordAttributeText,
      paddingVertical: 4,
    },
    optionalDivider: {
      height: 2,
      backgroundColor: ColorPalette.brand.secondaryBackground,
    },
    lockedHint: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
    },
    claimSetSection: {
      marginBottom: Spacing.md,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: ColorPalette.brand.secondaryBackground,
    },
    claimSetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: ColorPalette.brand.primary,
    },
    claimSetTitle: {
      ...TextTheme.bold,
      color: ColorPalette.brand.buttonText,
      flex: 1,
    },
    claimSetCount: {
      color: ColorPalette.brand.buttonText,
      fontSize: 12,
      marginRight: Spacing.sm,
    },
    detailButton: {
      padding: Spacing.xs,
    },
    claimSetBody: {
      paddingVertical: Spacing.xs,
    },
  })

  if (submission && !submission.areAllSatisfied) {
    console.log('[DEBUG] OpenIDProofRequestBody — all entries NOT satisfied, showing unsatisfied view')
    return (
      <OpenIDUnsatisfiedProofRequest
        credentialName={submission?.name}
        requestPurpose={submission?.purpose}
        verifierName={verifierName}
      />
    )
  }

  if (!selectedCredentialsSubmission || !submission) {
    console.log('[DEBUG] OpenIDProofRequestBody — returning null because:', JSON.stringify({
      hasSelectedCreds: !!selectedCredentialsSubmission,
      hasSubmission: !!submission
    }))
    return
  }

  const [detailClaimSet, setDetailClaimSet] = useState<ClaimSetGroup | null>(null)
  const [detailRequestedAttrs, setDetailRequestedAttrs] = useState<string[]>([])
  // Track checked optional claims per inputDescriptorId: Map<inputDescriptorId, Set<claimName>>
  const [checkedOptional, setCheckedOptional] = useState<Map<string, Set<string>>>(new Map())

  const toggleOptionalClaim = useCallback((inputDescriptorId: string, claimName: string, allOptional: string[]) => {
    setCheckedOptional((prev) => {
      const next = new Map<string, Set<string>>(prev)
      const current = new Set<string>(next.get(inputDescriptorId))
      if (current.has(claimName)) {
        current.delete(claimName)
      } else {
        current.add(claimName)
      }
      next.set(inputDescriptorId, current)

      // Notify parent with the current set of selected claims for this inputDescriptorId
      if (onClaimsToggle) {
        const selected = Array.from(current)
        onClaimsToggle(inputDescriptorId, selected)
      }
      return next
    })
  }, [onClaimsToggle])

  return (
    <View style={styles.credentialsList}>
      {Object.entries(selectedCredentialsSubmission).map(([inputDescriptorId, credentialSimplified]) => {
        //TODO: Support multiple credentials
        const correspondingSubmission = submission.entries?.find((s) => s.inputDescriptorId === inputDescriptorId)
        const isSatisfied = correspondingSubmission?.isSatisfied
        const credentialSubmission = correspondingSubmission?.credentials.find((s) => s.id === credentialSimplified.id)
        const requestedAttributes = credentialSubmission?.requestedAttributes
        const optionalAttributes = credentialSubmission?.optionalAttributes
        const hasMultipleCreds = correspondingSubmission?.credentials
          ? correspondingSubmission.credentials.length > 1
          : false

        const credential = credentialsRequested.find((c) => c.id === credentialSubmission?.id)
        if (!credential || !correspondingSubmission) {
          console.log(`[DEBUG] OpenIDProofRequestBody — null render for inputDescriptorId ${inputDescriptorId}:`, JSON.stringify({
            credentialFound: !!credential,
            correspondingSubmissionFound: !!correspondingSubmission,
            credentialSubmissionId: credentialSubmission?.id,
            requestedAttributes
          }))
          return null
        }

        const credentialDisplay = getCredentialForDisplay(credential)

        // Merge essential + optional so all fields are rendered
        const allAttributeNames = [
          ...(requestedAttributes ?? []),
          ...(optionalAttributes ?? [])
        ]
        const optionalSet = new Set(optionalAttributes ?? [])
        const fields = buildFieldsFromW3cCredsCredential(credentialDisplay, allAttributeNames, i18n.language)
        const checkedSet = checkedOptional.get(inputDescriptorId) ?? new Set<string>()
        const renderField = (field: Field, index: number, fields: Field[]) => {
          const fieldName = field.name || ''
          const isOptional = fieldName ? optionalSet.has(fieldName) : false

          if (isOptional) {
            const checked = checkedSet.has(fieldName)
            return (
              <View key={fieldName || index}>
                <TouchableOpacity
                  style={styles.optionalRow}
                  onPress={() => toggleOptionalClaim(inputDescriptorId, fieldName, optionalAttributes ?? [])}
                  activeOpacity={0.7}
                  hitSlop={hitSlop}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                >
                  <Icon
                    name={checked ? 'check-box' : 'check-box-outline-blank'}
                    size={28}
                    color={Inputs.checkBoxColor.color}
                  />
                  <View style={styles.optionalContent}>
                    <ThemedText style={styles.optionalLabel}>
                      {field.label ?? startCase(fieldName)}
                    </ThemedText>
                    <ThemedText style={styles.optionalValue}>
                      {(field as any).value}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
                {index + 1 < fields.length && fields[index + 1] && (optionalSet.has(fields[index + 1].name || ''))
                  ? null
                  : <View style={styles.optionalDivider} />}
              </View>
            )
          }

          // Essential claim — render as standard field
          return (
            <RecordField
              key={fieldName || index}
              field={field}
              hideFieldValue={false}
              shown
              hideBottomBorder={false}
            />
          )
        }

        // Determine claim set grouping
        const credentialClaimSets = credentialSubmission?.claimSets
        const hasClaimSets = credentialClaimSets && credentialClaimSets.length > 0
        const fieldsByClaimSet = hasClaimSets
          ? credentialClaimSets!.map((cs) => ({
              ...cs,
              sectionFields: fields.filter((f) => f.name && cs.claimKeys.includes(f.name)),
            })).filter((cs) => cs.sectionFields.length > 0)
          : []

        const renderClaimsSection = () => {
          // Fallback: flat list when no claim sets or only one group
          if (!hasClaimSets || fieldsByClaimSet.length <= 1) {
            return (
              <View style={styles.detailContainer}>
                <Record
                  fields={fields}
                  hideFieldValues={false}
                  header={() => (
                    <>
                      <ThemedText style={TextTheme.headingFour}>{t('ProofRequest.DetailsHeader')}</ThemedText>
                      {optionalAttributes && optionalAttributes.length > 0 && (
                        <ThemedText style={[ListItems.recordAttributeLabel, styles.lockedHint]}>
                          {t('ProofRequest.OptionalHint')}
                        </ThemedText>
                      )}
                    </>
                  )}
                  scrollEnabled={false}
                  isProofRequest
                  field={renderField}
                />
              </View>
            )
          }

          // Claim set grouping mode
          return (
            <View style={[styles.detailContainer, { paddingHorizontal: 0, paddingVertical: 0, paddingBottom: 16 }]}>
              <ThemedText style={[TextTheme.headingFour, { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }]}>
                {t('ProofRequest.DetailsHeader')}
              </ThemedText>
              {optionalAttributes && optionalAttributes.length > 0 && (
                <ThemedText style={[ListItems.recordAttributeLabel, styles.lockedHint]}>
                  {t('ProofRequest.OptionalHint')}
                </ThemedText>
              )}
              {fieldsByClaimSet.map((cs) => (
                <View key={cs.id} style={styles.claimSetSection}>
                  <View style={styles.claimSetHeader}>
                    <ThemedText style={styles.claimSetTitle}>{cs.label}</ThemedText>
                    <TouchableOpacity
                      style={styles.detailButton}
                      hitSlop={hitSlop}
                      onPress={() => {
                        setDetailClaimSet(cs)
                        setDetailRequestedAttrs(requestedAttributes ?? [])
                      }}
                      accessibilityLabel={`Detail ${cs.label}`}
                    >
                      <Icon name="info-outline" size={22} color={ColorPalette.brand.buttonText} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.claimSetBody}>
                    {cs.sectionFields.map((field, idx, arr) => renderField(field, idx, arr))}
                  </View>
                </View>
              ))}
            </View>
          )
        }

        return (
          <View key={credentialSimplified.id}>
            <View style={styles.cardContainer}>
              {isSatisfied && requestedAttributes && (
                <CredentialCardGen credential={credential} hasAltCredentials={hasMultipleCreds} />
              )}
              {hasMultipleCreds && (
                <View style={{ flex: 1, flexDirection: 'row-reverse', paddingTop: Spacing.sm }}>
                  <Pressable
                    onPress={() => onPressAltCredChange(correspondingSubmission.inputDescriptorId, credential.id)}
                  >
                    <ThemedText style={ListItems.recordLink}>{t('ProofRequest.UseDifferentCard')}</ThemedText>
                  </Pressable>
                </View>
              )}
            </View>
            {renderClaimsSection()}
          </View>
        )
       })}
      <ClaimSetDetailModal
        visible={!!detailClaimSet}
        claimSetLabel={detailClaimSet?.label ?? ''}
        claimKeys={detailClaimSet?.claimKeys ?? []}
        requestedAttributes={detailRequestedAttrs}
        onClose={() => setDetailClaimSet(null)}
      />
     </View>
   )
}

export default OpenIDProofRequestBody
