import { Agent } from '@credo-ts/core'
import { AskarStoreManager } from '@credo-ts/askar'
import { generateMnemonic as bip39GenerateMnemonic } from 'bip39'
import RNFS from 'react-native-fs'
import Share from 'react-native-share'
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker'
import { zip, unzip } from 'react-native-zip-archive'
import { Platform } from 'react-native'
import { injectable } from 'tsyringe'
// Import directly from the utils file since it's not exported from the main package
import { setMediationToDefault } from '../../../core/src/utils/mediatorhelpers'

export type WalletConfig = {
  id: string
  key?: string
  [key: string]: unknown
}

/**
 * Status enum for wallet restore progress
 */
export enum RestoreStatus {
  VALIDATING = 'validating',
  SHUTTING_DOWN = 'shutting_down',
  DELETING_OLD = 'deleting_old',
  IMPORTING = 'importing',
  INITIALIZING = 'initializing',
  CONNECTING_MEDIATOR = 'connecting_mediator',
  SUCCESS = 'success',
}

/**
 * Interface for restore progress updates
 */
export interface RestoreProgress {
  status: RestoreStatus
  message: string
  error?: Error
}

@injectable()
export class BackupService {
  /**
   * Generates a new mnemonic for wallet backup/restore
   * @param strength Strength of the mnemonic (default: 256)
   * @returns string Mnemonic phrase
   */
  public generateMnemonic(strength = 256): string {
    return bip39GenerateMnemonic(strength)
  }

  /**
   * Exports the current wallet to a zip file, saves to Downloads, and opens the share sheet
   * @param agent The agent instance
   * @param key The backup key (derived from pin/mnemonic)
   * @param fileName Optional filename (default: backup.zip)
   * @returns The path to the saved backup file
   */
  public async exportWallet(agent: Agent, key: string, fileName: string = 'backup.zip'): Promise<string> {
    const backupDir = `${RNFS.CachesDirectoryPath}/backup_export`
    const dbFileName = 'sqlite.db'
    const dbPath = `${backupDir}/${dbFileName}`
    const zipPath = `${RNFS.CachesDirectoryPath}/${fileName}`
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const finalFileName = `wallet-backup-${timestamp}.zip`
    const downloadPath = `${RNFS.DownloadDirectoryPath}/${finalFileName}`

    try {
      // 1. Prepare directory
      if (await RNFS.exists(backupDir)) {
        await RNFS.unlink(backupDir)
      }
      await RNFS.mkdir(backupDir)

      if (await RNFS.exists(zipPath)) {
        await RNFS.unlink(zipPath)
      }

      // 2. Export database from agent using AskarStoreManager
      const storeManager = agent.dependencyManager.resolve(AskarStoreManager)
      
      if (!storeManager.isStoreOpen(agent.context)) {
        throw new Error('Store is not open. Please ensure the agent is initialized.')
      }
      
      await storeManager.exportStore(agent.context, {
        exportToStore: {
          id: 'backup-export',
          key,
          database: {
            type: 'sqlite',
            config: {
              path: dbPath,
            },
          },
        },
      })

      // 3. Zip the exported file
      await zip(backupDir, zipPath)

      // 4. Copy to Downloads folder
      await RNFS.copyFile(zipPath, downloadPath)

      // 5. Share the zip file (optional - user can still share if needed)
      await Share.open({
        url: Platform.OS === 'android' ? `file://${downloadPath}` : downloadPath,
        type: 'application/zip',
        failOnCancel: false,
      })
      
      return downloadPath
    } finally {
      // Best effort cleanup of temporary files
      try {
        if (await RNFS.exists(backupDir)) await RNFS.unlink(backupDir)
        if (await RNFS.exists(zipPath)) await RNFS.unlink(zipPath)
      } catch (error) {
        // ignore cleanup error
      }
    }
  }

  /**
   * Picks a backup file using the document picker
   * @returns The path to the selected file or null if cancelled
   */
  public async pickBackupFile(): Promise<string | null> {
    try {
      const [result] = await pick({
        type: [types.allFiles, types.zip],
      })

      return result?.uri || null
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return null
      }
      throw err
    }
  }

  /**
   * Imports a wallet from a backup file (supports .zip or direct .db)
   * @param agent The agent instance
   * @param path Path to the backup file
   * @param key The backup key used to encrypt the wallet
   * @param walletConfig Configuration for the imported wallet
   */
  public async importWallet(agent: Agent, path: string, key: string, walletConfig: WalletConfig): Promise<void> {
    let importPath = Platform.OS === 'android' ? decodeURIComponent(path.replace('file://', '')) : path
    const unzipDir = `${RNFS.CachesDirectoryPath}/backup_import_${Date.now()}`

    try {
      // Check if it's a zip file
      if (importPath.toLowerCase().endsWith('.zip')) {
        await RNFS.mkdir(unzipDir)
        await unzip(importPath, unzipDir)

        // Try to find the database file in the unzipped folder
        const files = await RNFS.readDir(unzipDir)
        const dbFile = files.find((f: { name: string; path: string }) => f.name.endsWith('.db') || f.name === 'sqlite.db')

        if (!dbFile) {
          throw new Error('No valid wallet database found in the zip file')
        }
        importPath = dbFile.path
      }

      const storeManager = agent.dependencyManager.resolve(AskarStoreManager)
      
      await storeManager.importStore(agent.context, {
        importFromStore: {
          id: walletConfig.id,
          key,
          database: {
            type: 'sqlite',
            config: {
              path: importPath,
            },
          },
        },
      })
    } finally {
      // Best effort cleanup of unzipped files
      try {
        if (await RNFS.exists(unzipDir)) {
          await RNFS.unlink(unzipDir)
        }
      } catch (error) {
        // ignore cleanup error
      }
    }
  }

  /**
   * Safely deletes an existing wallet directory
   * @param walletId The ID of the wallet to delete
   * @throws Error if deletion fails due to permissions or other issues
   */
  public async deleteWallet(walletId: string): Promise<void> {
    // Construct wallet directory path
    // Android: /data/user/0/com.ariesbifold/files/.afj/wallet/{walletId}
    // iOS: {DocumentDirectory}/.afj/wallet/{walletId}
    const walletDir = `${RNFS.DocumentDirectoryPath}/.afj/wallet/${walletId}`

    // Check if wallet directory exists
    if (await RNFS.exists(walletDir)) {
      try {
        // Delete entire directory recursively
        await RNFS.unlink(walletDir)
        // Wallet deleted successfully - no console.log in production
      } catch (error) {
        // Log error for debugging
        throw new Error(`Failed to delete wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else {
      // Wallet does not exist, skipping deletion - no console.log in production
    }
  }

  /**
   * Validates a backup file before proceeding with restore
   * @param filePath Path to the backup file (should already be normalized)
   * @throws Error if validation fails
   * @returns Normalized path that can be used for restore
   * @private
   */
  private async validateBackupFile(filePath: string): Promise<string> {
    // Normalize path for Android content:// URIs
    let normalizedPath = filePath
    
    // Handle Android content:// URIs
    if (Platform.OS === 'android') {
      if (filePath.startsWith('content://')) {
        // Content URIs need special handling - copy to temp location first
        const tempPath = `${RNFS.CachesDirectoryPath}/temp_restore_${Date.now()}.zip`
        try {
          await RNFS.copyFile(filePath, tempPath)
          normalizedPath = tempPath
        } catch (error) {
          throw new Error(`Failed to access backup file: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      } else if (filePath.startsWith('file://')) {
        normalizedPath = decodeURIComponent(filePath.replace('file://', ''))
      }
    }
    
    // Check file exists
    if (!(await RNFS.exists(normalizedPath))) {
      throw new Error(`Backup file not found at: ${normalizedPath}`)
    }

    // Check file size (should be > 0)
    const stat = await RNFS.stat(normalizedPath)
    if (stat.size === 0) {
      throw new Error('Backup file is empty')
    }

    // If zip file, check it can be unzipped and contains a database
    if (normalizedPath.toLowerCase().endsWith('.zip')) {
      const testUnzipDir = `${RNFS.CachesDirectoryPath}/test_unzip_${Date.now()}`
      
      try {
        await RNFS.mkdir(testUnzipDir)
        await unzip(normalizedPath, testUnzipDir)

        // Check for sqlite.db file
        const files = await RNFS.readDir(testUnzipDir)
        const hasDb = files.some((f: { name: string }) => f.name.endsWith('.db'))

        if (!hasDb) {
          throw new Error('No database file found in backup')
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'No database file found in backup') {
          throw error
        }
        throw new Error('Backup file is corrupted or invalid')
      } finally {
        // Cleanup test directory
        try {
          if (await RNFS.exists(testUnzipDir)) {
            await RNFS.unlink(testUnzipDir)
          }
        } catch (cleanupError) {
          // Ignore cleanup errors - no console.warn in production
        }
      }
    }
    
    return normalizedPath
  }

  /**
   * Complete restore flow including agent reinitialize and mediator setup
   * 
   * IMPORTANT: This method uses two different keys:
   * 1. `mnemonic` - Used ONLY to decrypt the backup file
   * 2. `walletConfig.key` - Used as the wallet key (should be hashed PIN from keychain)
   * 
   * The wallet will be imported with the key from walletConfig, NOT the mnemonic.
   * This ensures the restored wallet uses the same key as the existing wallet secret in keychain.
   * 
   * @param agent The agent instance
   * @param backupFilePath Path to the backup file
   * @param mnemonic The mnemonic used to DECRYPT the backup file (not used as wallet key)
   * @param walletConfig Configuration for the wallet (key should be from keychain, not mnemonic)
   * @param mediatorUrl URL of the mediator to connect to
   * @param onProgress Optional callback for progress updates
   * @throws Error if any step of the restore process fails
   */
  public async restoreWalletComplete(
    agent: Agent,
    backupFilePath: string,
    mnemonic: string,
    walletConfig: WalletConfig,
    mediatorUrl: string,
    onProgress?: (status: RestoreStatus) => void
  ): Promise<void> {
    const walletId = walletConfig.id
    // Use the key from walletConfig (should be hashed PIN from keychain)
    const walletKey = walletConfig.key
    
    if (!walletKey) {
      throw new Error('Wallet key is required in walletConfig')
    }
    
    // Step 1: Validate backup file and get normalized path
    onProgress?.(RestoreStatus.VALIDATING)
    const normalizedPath = await this.validateBackupFile(backupFilePath)

    // Step 2: Close current wallet (but don't shutdown agent completely)
    onProgress?.(RestoreStatus.SHUTTING_DOWN)
    try {
      // Check if store is open before trying to close
      const storeManager = agent.dependencyManager.resolve(AskarStoreManager)
      
      if (storeManager.isStoreOpen(agent.context)) {
        await storeManager.closeStore(agent.context)
      }
    } catch (error) {
      // If store is already closed, that's fine
      // Continue with the restore process
    }

    // Step 3: Delete old wallet if exists
    onProgress?.(RestoreStatus.DELETING_OLD)
    await this.deleteWallet(walletId)

    // Step 4: Import wallet from backup
    // IMPORTANT: Use mnemonic to decrypt the backup, but walletKey (from keychain) as the wallet key
    onProgress?.(RestoreStatus.IMPORTING)
    await this.importWallet(agent, normalizedPath, mnemonic, walletConfig)

    // Step 5: Open the restored store
    onProgress?.(RestoreStatus.INITIALIZING)
    const storeManager = agent.dependencyManager.resolve(AskarStoreManager)
    
    await storeManager.openStore(agent.context)
    
    // Initialize agent with the restored wallet (only if not already initialized)
    if (!agent.isInitialized) {
      await agent.initialize()
    }

    // Step 6: Setup mediator connection
    onProgress?.(RestoreStatus.CONNECTING_MEDIATOR)
    try {
      await setMediationToDefault(agent, mediatorUrl)
    } catch (mediatorError) {
      // Don't fail entire restore if mediator fails
      // User can reconnect manually later - no console.warn in production
    }

    // Step 7: Success
    onProgress?.(RestoreStatus.SUCCESS)
  }
}
