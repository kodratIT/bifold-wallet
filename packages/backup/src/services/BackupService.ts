import { Agent, WalletConfig } from '@credo-ts/core'
import { generateMnemonic as bip39GenerateMnemonic } from 'bip39'
import RNFS from 'react-native-fs'
import Share from 'react-native-share'
import DocumentPicker from 'react-native-document-picker'
import { injectable } from 'tsyringe'

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
   * Exports the current wallet to a file and opens the share sheet
   * @param agent The agent instance
   * @param key The backup key (derived from pin/mnemonic)
   * @param fileName Optional filename (default: backup.wallet)
   */
  public async exportWallet(agent: Agent, key: string, fileName: string = 'backup.wallet'): Promise<void> {
    const path = `${RNFS.CachesDirectoryPath}/${fileName}`

    try {
      // Ensure previous file is removed
      if (await RNFS.exists(path)) {
        await RNFS.unlink(path)
      }

      await agent.wallet.export({
        path,
        key,
      })

      await Share.open({
        url: `file://${path}`,
        type: 'application/octet-stream',
        failOnCancel: false,
      })
    } finally {
      // Best effort cleanup
      try {
        if (await RNFS.exists(path)) {
          await RNFS.unlink(path)
        }
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
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
        copyTo: 'cachesDirectory',
      })

      return result.fileCopyUri || null
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        return null
      }
      throw err
    }
  }

  /**
   * Imports a wallet from a backup file
   * @param agent The agent instance
   * @param path Path to the backup file
   * @param key The backup key used to encrypt the wallet
   * @param walletConfig Configuration for the imported wallet
   */
  public async importWallet(agent: Agent, path: string, key: string, walletConfig: WalletConfig): Promise<void> {
    await agent.wallet.import(walletConfig, {
      path,
      key,
    })
  }
}
