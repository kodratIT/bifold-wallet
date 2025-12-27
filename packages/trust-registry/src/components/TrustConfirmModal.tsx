import React from 'react'
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialIcons'

export interface TrustConfirmModalProps {
    visible: boolean
    isAuthorized: boolean
    onAccept: () => void
    onDecline: () => void
    onClose: () => void
    /** Custom message override */
    message?: string
}

/**
 * Simple confirmation modal for Accept/Decline actions
 * Shows brief trust status message
 */
export const TrustConfirmModal: React.FC<TrustConfirmModalProps> = ({
    visible,
    isAuthorized,
    onAccept,
    onDecline,
    onClose,
    message
}) => {
    if (!visible) return null

    const statusColor = isAuthorized ? '#22C55E' : '#EAB308'
    const statusIcon = isAuthorized ? 'verified-user' : 'warning'
    const defaultMessage = isAuthorized
        ? 'Issuer ini terpercaya dan terverifikasi oleh Trust Registry.'
        : 'Issuer ini TIDAK terpercaya. Lanjutkan dengan hati-hati.'

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Icon */}
                    <View style={[styles.iconContainer, { backgroundColor: statusColor }]}>
                        <Icon name={statusIcon} size={40} color="#FFFFFF" />
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>
                        {isAuthorized ? 'Issuer Terpercaya' : 'Issuer Tidak Terpercaya'}
                    </Text>

                    {/* Message */}
                    <Text style={styles.message}>
                        {message || defaultMessage}
                    </Text>

                    {/* Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={onClose}
                        >
                            <Text style={styles.secondaryButtonText}>Batal</Text>
                        </TouchableOpacity>

                        {isAuthorized ? (
                            <TouchableOpacity
                                style={[styles.primaryButton, { backgroundColor: statusColor }]}
                                onPress={onAccept}
                            >
                                <Text style={styles.primaryButtonText}>Terima</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.primaryButton, { backgroundColor: '#EF4444' }]}
                                onPress={onAccept}
                            >
                                <Text style={styles.primaryButtonText}>Lanjutkan</Text>
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    container: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    iconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    primaryButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
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
    },
    secondaryButtonText: {
        color: '#4B5563',
        fontSize: 16,
        fontWeight: '600',
    },
})

export default TrustConfirmModal
