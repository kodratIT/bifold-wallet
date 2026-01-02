import React from 'react'
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { useTranslation } from 'react-i18next'

import { TrustResult, AuthorizationResponse } from '../types'

export interface TrustRegistryModalProps {
    visible: boolean
    trustResult: TrustResult | null
    authResponse: AuthorizationResponse | null
    onAccept?: () => void
    onDecline?: () => void
    onClose: () => void
    isDeclineAction?: boolean
    /** Title override */
    title?: string
}

export const TrustRegistryModal: React.FC<TrustRegistryModalProps> = ({
    visible,
    trustResult,
    authResponse,
    onAccept,
    onDecline,
    onClose,
    isDeclineAction = false,
    title
}) => {
    const { t } = useTranslation()

    if (!visible) return null

    const isFederated = trustResult?.level === 'trusted_federation'
    const isAuthorized = isFederated ? true : (authResponse?.authorized ?? trustResult?.authorized ?? false)
    const entityDid = authResponse?.entity_id || trustResult?.entityDid || 'Unknown DID'
    const credentialType = authResponse?.resource || trustResult?.credentialType || 'Credential'
    const action = authResponse?.action || trustResult?.action || 'issue'
    const message = authResponse?.message || trustResult?.message || ''
    const timeEvaluated = authResponse?.time_evaluated
        ? new Date(authResponse.time_evaluated).toLocaleString()
        : trustResult?.checkedAt?.toLocaleString() || ''

    // Design Constants
    const statusColor = isAuthorized ? '#22C55E' : '#EAB308'
    const statusIcon = isFederated ? 'security' : (isAuthorized ? 'verified-user' : 'gpp-maybe')
    const actionLabel = action === 'issue' ? 'Issuer' : 'Verifier'

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header with Icon */}
                    <View style={[styles.header, { backgroundColor: statusColor }]}>
                        <Icon name={statusIcon} size={48} color="#FFFFFF" />
                        <Text style={styles.headerTitle}>
                            {title || `${actionLabel} Information`}
                        </Text>
                    </View>

                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={styles.contentContainer}
                        showsVerticalScrollIndicator={true}
                    >
                        {/* Authorization Status */}
                        <View style={styles.section}>
                            <Text style={styles.label}>AUTHORIZATION STATUS</Text>
                            <View style={[styles.statusBadge, { backgroundColor: isAuthorized ? '#DCFCE7' : '#FEF3C7' }]}>
                                <Icon
                                    name={isAuthorized ? 'check-circle' : 'warning'}
                                    size={20}
                                    color={isAuthorized ? '#16A34A' : '#CA8A04'}
                                />
                                <Text style={[styles.statusText, { color: isAuthorized ? '#16A34A' : '#CA8A04' }]}>
                                    {isFederated ? 'Authorized via Federation' : (isAuthorized ? 'Authorized' : 'Not Authorized')}
                                </Text>
                            </View>
                        </View>

                        {/* Trust Authority (for Federation) */}
                        {isFederated && trustResult?.trustAuthority && (
                            <View style={styles.section}>
                                <Text style={styles.label}>TRUST AUTHORITY</Text>
                                <View style={styles.infoRow}>
                                    <Icon name="account-balance" size={18} color="#6B7280" />
                                    <Text style={styles.infoText}>
                                        {trustResult.trustAuthority.name || trustResult.trustAuthority.id}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Entity DID */}
                        <View style={styles.section}>
                            <Text style={styles.label}>{actionLabel.toUpperCase()} DID</Text>
                            <View style={styles.didContainer}>
                                <Icon name="fingerprint" size={18} color="#6B7280" />
                                <Text style={styles.didText} numberOfLines={3} ellipsizeMode="middle">
                                    {entityDid}
                                </Text>
                            </View>
                        </View>

                        {/* Credential Type */}
                        <View style={styles.section}>
                            <Text style={styles.label}>CREDENTIAL TYPE</Text>
                            <View style={styles.infoRow}>
                                <Icon name="description" size={18} color="#6B7280" />
                                <Text style={styles.infoText}>{credentialType}</Text>
                            </View>
                        </View>

                        {/* Action Type */}
                        <View style={styles.section}>
                            <Text style={styles.label}>ACTION</Text>
                            <View style={styles.infoRow}>
                                <Icon name={action === 'issue' ? 'badge' : 'verified'} size={18} color="#6B7280" />
                                <Text style={styles.infoText}>
                                    {action === 'issue' ? 'Issue Credential' : 'Verify Credential'}
                                </Text>
                            </View>
                        </View>

                        {/* Message */}
                        {message ? (
                            <View style={styles.section}>
                                <Text style={styles.label}>REGISTRY MESSAGE</Text>
                                <View style={styles.messageBox}>
                                    <Icon name="info" size={18} color="#3B82F6" />
                                    <Text style={styles.messageText}>{message}</Text>
                                </View>
                            </View>
                        ) : null}

                        {/* Checked At */}
                        {timeEvaluated ? (
                            <View style={styles.section}>
                                <Text style={styles.label}>VERIFIED AT</Text>
                                <View style={styles.infoRow}>
                                    <Icon name="schedule" size={18} color="#6B7280" />
                                    <Text style={styles.infoText}>{timeEvaluated}</Text>
                                </View>
                            </View>
                        ) : null}

                        {/* Info Box */}
                        <View style={[
                            styles.infoBox,
                            { backgroundColor: isAuthorized ? '#F0FDF4' : '#FFFBEB' }
                        ]}>
                            <Icon
                                name="security"
                                size={20}
                                color={isAuthorized ? '#16A34A' : '#CA8A04'}
                            />
                            <Text style={[
                                styles.infoBoxText,
                                { color: isAuthorized ? '#166534' : '#92400E' }
                            ]}>
                                {isFederated
                                    ? `This ${actionLabel.toLowerCase()} is authorized via trust federation through ${trustResult?.trustAuthority?.name || 'a recognized authority'}.`
                                    : isAuthorized
                                        ? `This ${actionLabel.toLowerCase()} is authorized by the trust registry to ${action} this credential type.`
                                        : `This ${actionLabel.toLowerCase()} is not authorized by the trust registry. Proceed with caution.`}
                            </Text>
                        </View>
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.footer}>
                        {onAccept && onDecline ? (
                            <>
                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={onClose}
                                >
                                    <Text style={styles.secondaryButtonText}>{t('Global.Back')}</Text>
                                </TouchableOpacity>

                                {isDeclineAction ? (
                                    <TouchableOpacity
                                        style={[styles.primaryButton, { backgroundColor: '#EF4444' }]}
                                        onPress={onDecline}
                                    >
                                        <Text style={styles.primaryButtonText}>{t('Global.Decline')}</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.primaryButton, { backgroundColor: statusColor }]}
                                        onPress={onAccept}
                                    >
                                        <Text style={styles.primaryButtonText}>{t('Global.Accept')}</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        ) : (
                            <TouchableOpacity
                                style={[styles.closeButton, { backgroundColor: statusColor }]}
                                onPress={onClose}
                            >
                                <Text style={styles.closeButtonText}>Close</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        width: '100%',
        maxHeight: '85%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    header: {
        paddingVertical: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 8,
    },
    content: {
        maxHeight: 400,
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 20,
    },
    section: {
        marginBottom: 16,
    },
    label: {
        fontSize: 11,
        color: '#9CA3AF',
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    didContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    didText: {
        flex: 1,
        fontSize: 13,
        color: '#374151',
        fontFamily: 'monospace',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoText: {
        fontSize: 15,
        color: '#374151',
        fontWeight: '500',
    },
    messageBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#EFF6FF',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    messageText: {
        flex: 1,
        fontSize: 13,
        color: '#1E40AF',
        lineHeight: 18,
    },
    infoBox: {
        flexDirection: 'row',
        padding: 14,
        borderRadius: 12,
        alignItems: 'flex-start',
        marginTop: 8,
        gap: 10,
    },
    infoBoxText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    footer: {
        padding: 16,
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        gap: 10,
    },
    primaryButton: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    secondaryButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        color: '#4B5563',
        fontSize: 16,
        fontWeight: '600',
    },
    closeButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
})
