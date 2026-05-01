import 'reflect-metadata'
import { Agent } from '@credo-ts/core'
import { BackupService, WalletConfig } from '../BackupService'
import RNFS from 'react-native-fs'
import Share from 'react-native-share'
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker'
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

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  isErrorWithCode: jest.fn(),
  errorCodes: {
    OPERATION_CANCELED: 'OPERATION_CANCELED',
  },
  types: {
    allFiles: 'public.item',
    zip: 'public.zip-archive',
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
      const mockResult = { uri: 'file:///picked/path' }
      ;(pick as jest.Mock).mockResolvedValue([mockResult])

      const result = await backupService.pickBackupFile()

      expect(result).toBe('file:///picked/path')
      expect(pick).toHaveBeenCalledWith({
        type: [types.allFiles, types.zip],
      })
    })

    it('should return null if cancelled', async () => {
      const error = new Error('cancelled')
      ;(pick as jest.Mock).mockRejectedValue(error)
      ;(isErrorWithCode as unknown as jest.Mock).mockImplementation((err) => {
        ;(err as { code?: string }).code = errorCodes.OPERATION_CANCELED
        return true
      })

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
