import React, { useState } from 'react'
import { View, Text, Button, TextInput, ActivityIndicator, StyleSheet, ScrollView, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAgent } from '@credo-ts/react-hooks'
import { container } from 'tsyringe'
import { WalletConfig } from '@credo-ts/core'
import { BackupService, RestoreStatus } from '../services/BackupService'
import { useAuth } from '../../../core/src/contexts/auth'
import { walletId } from '../../../core/src/constants'

interface RestoreWalletScreenProps {
  /**
   * Configuration for the wallet to be restored.
   * If not provided, will use the default walletId from constants.
   * IMPORTANT: The walletConfig.id must match the wallet ID stored in the backup file.
   */
  walletConfig?: WalletConfig
  /**
   * URL of the mediator to connect to after restore
   */
  mediatorUrl: string
  /**
   * Callback when restore is successful
   */
  onRestoreSuccess?: () => void
}

export const RestoreWalletScreen = ({ walletConfig, mediatorUrl, onRestoreSuccess }: RestoreWalletScreenProps) => {
  const { agent } = useAgent()
  const { walletSecret } = useAuth()
  const [mnemonic, setMnemonic] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [restoreStatus, setRestoreStatus] = useState<RestoreStatus | null>(null)
  const [backupService] = useState(() => container.resolve(BackupService))

  const handlePickFile = async () => {
    try {
      const path = await backupService.pickBackupFile()
      if (path) {
        setFilePath(path)
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick file')
    }
  }

  const getStatusMessage = (status: RestoreStatus): string => {
    const messages = {
      [RestoreStatus.VALIDATING]: 'Validating backup file...',
      [RestoreStatus.SHUTTING_DOWN]: 'Preparing for restore...',
      [RestoreStatus.DELETING_OLD]: 'Removing old wallet...',
      [RestoreStatus.IMPORTING]: 'Importing wallet from backup...',
      [RestoreStatus.INITIALIZING]: 'Initializing wallet...',
      [RestoreStatus.CONNECTING_MEDIATOR]: 'Connecting to mediator...',
      [RestoreStatus.SUCCESS]: 'Wallet restored successfully!',
    }
    return messages[status] || 'Processing...'
  }

  const getErrorMessage = (error: Error): string => {
    const message = error.message.toLowerCase()

    if (message.includes('not found')) {
      return 'Backup file not found. Please select a valid backup file.'
    }
    if (message.includes('corrupted') || message.includes('invalid')) {
      return 'Backup file is corrupted or invalid. Please check your backup file.'
    }
    if (message.includes('mnemonic') || message.includes('key')) {
      return 'Incorrect mnemonic or key. Please check and try again.'
    }
    if (message.includes('permission')) {
      return 'Cannot access wallet files. Please restart the app and try again.'
    }
    if (message.includes('already exists')) {
      return 'Wallet already exists. Please contact support.'
    }
    // Specific error for wallet ID mismatch
    if (message.includes('walletconfig.id must match') || message.includes('default profile')) {
      return 'Wallet ID mismatch. This backup file may be from a different app version. Please contact support.'
    }

    // Generic error
    return `Failed to restore wallet: ${error.message}`
  }

  const handleRestore = async () => {
    if (!agent) return
    if (!filePath || !mnemonic) {
      Alert.alert('Error', 'Please provide backup file and mnemonic')
      return
    }

    // Check if user has unlocked wallet (walletSecret is available from AuthContext)
    // This avoids triggering biometric prompt since walletSecret is cached after PIN entry
    if (!walletSecret) {
      Alert.alert(
        'Wallet Locked',
        'Please unlock your wallet with PIN first before restoring.',
        [{ text: 'OK' }]
      )
      return
    }

    // Prepare wallet config for restore
    // IMPORTANT: Use the same walletId constant that was used during wallet creation
    // The backup file contains a wallet with profile id = 'walletId', so we must use the same ID during import
    const restoreWalletConfig: WalletConfig = walletConfig || {
      id: walletId,
      key: walletSecret.key,
    }

    // Show confirmation dialog
    Alert.alert(
      'Confirm Restore',
      'This will replace your current wallet data with the backup. Your PIN will stay the same. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setLoading(true)
            try {
              console.log('[Restore] Starting restore process...')
              console.log('[Restore] Backup file:', filePath)
              console.log('[Restore] Mnemonic length:', mnemonic.length)
              console.log('[Restore] Using cached walletSecret from AuthContext')
              
              await backupService.restoreWalletComplete(
                agent,
                filePath,
                mnemonic,
                restoreWalletConfig,
                mediatorUrl,
                (status) => {
                  console.log('[Restore] Status:', status)
                  setRestoreStatus(status)
                }
              )
              
              console.log('[Restore] Restore completed successfully')
              Alert.alert(
                'Success',
                'Wallet restored successfully! The app will now refresh.',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      try {
                        await AsyncStorage.setItem('post_restore', 'true')
                        console.log('[Restore] Set post_restore flag')
                        onRestoreSuccess?.()
                      } catch (error) {
                        console.error('[Restore] Failed to set post_restore flag:', error)
                        // Still navigate even if flag set fails
                        onRestoreSuccess?.()
                      }
                    }
                  }
                ]
              )
            } catch (error) {
              console.error('[Restore] Error occurred:', error)
              console.error('[Restore] Error message:', (error as Error).message)
              console.error('[Restore] Error stack:', (error as Error).stack)
              
              Alert.alert('Error', getErrorMessage(error as Error))
            } finally {
              setLoading(false)
              setRestoreStatus(null)
            }
          }
        }
      ]
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Restore Wallet</Text>

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ This will replace your current wallet data with the backup. Your PIN will stay the same.
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Backup File</Text>
          <View style={styles.fileRow}>
            <Text style={styles.filePath} numberOfLines={1} ellipsizeMode="middle">
              {filePath || 'No file selected'}
            </Text>
            <Button title="Select File" onPress={handlePickFile} />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mnemonic / Key</Text>
          <TextInput
            style={styles.input}
            value={mnemonic}
            onChangeText={setMnemonic}
            placeholder="Enter mnemonic phrase"
            multiline
            autoCapitalize="none"
            placeholderTextColor="#999"
          />
        </View>

        {loading ? (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            {restoreStatus && (
              <Text style={styles.progressText}>{getStatusMessage(restoreStatus)}</Text>
            )}
          </View>
        ) : (
          <Button
            title="Restore Wallet"
            onPress={handleRestore}
            disabled={!agent || !filePath || !mnemonic || !walletSecret}
          />
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  content: {
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#000',
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
    padding: 15,
    marginBottom: 20,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
    color: '#333',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  filePath: {
    flex: 1,
    marginRight: 10,
    color: '#333',
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    color: '#333',
  },
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  progressText: {
    marginTop: 15,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
})
