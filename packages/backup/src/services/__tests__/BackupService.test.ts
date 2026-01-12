import 'reflect-metadata'
import { Agent, WalletConfig } from '@credo-ts/core'
import { BackupService } from '../BackupService'
import RNFS from 'react-native-fs'
import Share from 'react-native-share'
import DocumentPicker from 'react-native-document-picker'
import { generateMnemonic } from 'bip39'

// Mock dependencies
jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/mock/cache/path',
  exists: jest.fn(),
  unlink: jest.fn(),
}))

jest.mock('react-native-share', () => ({
  open: jest.fn(),
}))

jest.mock('react-native-document-picker', () => ({
  pickSingle: jest.fn(),
  isCancel: jest.fn(),
  types: {
    allFiles: 'public.item',
  },
}))

jest.mock('bip39', () => ({
  generateMnemonic: jest.fn(),
}))

describe('BackupService', () => {
  let backupService: BackupService
  let mockAgent: Agent

  beforeEach(() => {
    backupService = new BackupService()
    mockAgent = {
      wallet: {
        export: jest.fn(),
        import: jest.fn(),
      },
    } as unknown as Agent

    jest.clearAllMocks()
  })

  describe('generateMnemonic', () => {
    it('should generate a mnemonic using bip39', () => {
      (generateMnemonic as jest.Mock).mockReturnValue('mock mnemonic')
      const result = backupService.generateMnemonic()
      expect(result).toBe('mock mnemonic')
      expect(generateMnemonic).toHaveBeenCalledWith(256)
    })
  })

  describe('exportWallet', () => {
    it('should export wallet and share it', async () => {
      const key = 'backup-key'
      ;(RNFS.exists as jest.Mock).mockResolvedValue(false)

      await backupService.exportWallet(mockAgent, key)

      const expectedPath = '/mock/cache/path/backup.wallet'

      expect(mockAgent.wallet.export).toHaveBeenCalledWith({
        path: expectedPath,
        key,
      })

      expect(Share.open).toHaveBeenCalledWith({
        url: `file://${expectedPath}`,
        type: 'application/octet-stream',
        failOnCancel: false,
      })
    })

    it('should remove existing file before export', async () => {
      const key = 'backup-key'
      ;(RNFS.exists as jest.Mock).mockResolvedValueOnce(true).mockResolvedValue(false)

      await backupService.exportWallet(mockAgent, key)

      const expectedPath = '/mock/cache/path/backup.wallet'

      expect(RNFS.unlink).toHaveBeenCalledWith(expectedPath)
    })
  })

  describe('pickBackupFile', () => {
    it('should pick a file and return uri', async () => {
      const mockResult = { fileCopyUri: 'file:///picked/path' }
      ;(DocumentPicker.pickSingle as jest.Mock).mockResolvedValue(mockResult)

      const result = await backupService.pickBackupFile()

      expect(result).toBe('file:///picked/path')
      expect(DocumentPicker.pickSingle).toHaveBeenCalledWith({
        type: ['public.item'],
        copyTo: 'cachesDirectory',
      })
    })

    it('should return null if cancelled', async () => {
      const error = new Error('cancelled')
      ;(DocumentPicker.pickSingle as jest.Mock).mockRejectedValue(error)
      ;(DocumentPicker.isCancel as jest.Mock).mockReturnValue(true)

      const result = await backupService.pickBackupFile()

      expect(result).toBeNull()
    })
  })

  describe('importWallet', () => {
    it('should import wallet using agent', async () => {
      const path = '/path/to/backup'
      const key = 'backup-key'
      const walletConfig: WalletConfig = {
        id: 'new-wallet-id',
        key: 'new-wallet-key',
      }

      await backupService.importWallet(mockAgent, path, key, walletConfig)

      expect(mockAgent.wallet.import).toHaveBeenCalledWith(walletConfig, {
        path,
        key,
      })
    })
  })
})
