# 03 - Technical Implementation: Export Process (ZIP Standard)

**Document Status:** DRAFT v1.1 (ZIP Support)  
**Owner:** Backend/Core Team  
**Module:** `BackupService` (Export Logic)  
**Context:** Bifold Wallet (Credo-TS)

---

## 1. Overview

Modul ini mengekspor database wallet, menambahkan metadata, dan membungkusnya dalam arsip ZIP. Format ini kompatibel dengan standar portabilitas SSI modern (seperti Trinsic/Lissi).

### Kebutuhan Library
```bash
yarn add react-native-zip-archive
yarn add react-native-fs
yarn add react-native-share
```

---

## 2. File Structure (Inside ZIP)
File output `backup.zip` akan berisi:
```text
backup.zip
├── wallet.db        <-- Binary Encrypted Askar
└── metadata.json    <-- Info Backup
```

**Isi Metadata (`metadata.json`):**
```json
{
  "version": "1.0",
  "created_at": "2024-01-07T10:00:00Z",
  "app_id": "com.bifold.app",
  "framework": "credo-ts"
}
```

---

## 3. Implementation Code

### 3.1. Class Definition

```typescript
import { Agent, WalletExportImportConfig } from '@aries-framework/core'
import RNFS from 'react-native-fs'
import Share from 'react-native-share'
import { zip } from 'react-native-zip-archive'
import { Platform } from 'react-native'

export class WalletBackupService {
  
  private getCacheDir(): string {
    return RNFS.CachesDirectoryPath
  }

  public async exportWallet(agent: Agent, mnemonic: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const workDirName = `backup_work_${timestamp}`
    const workDirPath = `${this.getCacheDir()}/${workDirName}`
    const zipFileName = `wallet-backup-${timestamp}.zip`
    const zipFilePath = `${this.getCacheDir()}/${zipFileName}`

    try {
      console.log(`[Backup] Preparing workspace: ${workDirPath}`)
      
      // 1. Buat Folder Kerja Sementara
      await RNFS.mkdir(workDirPath)

      // 2. Export Wallet Binary (Raw) ke dalam folder kerja
      const walletPath = `${workDirPath}/wallet.db`
      const exportConfig: WalletExportImportConfig = {
        key: mnemonic,
        path: walletPath,
      }
      
      console.log('[Backup] Snapshotting wallet...')
      await agent.wallet.export(exportConfig)

      // 3. Buat Metadata JSON
      const metadata = {
        version: "1.0",
        created_at: new Date().toISOString(),
        platform: Platform.OS,
        type: "askar-encrypted-wallet"
      }
      const metadataPath = `${workDirPath}/metadata.json`
      await RNFS.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8')

      // 4. Kompresi Folder menjadi ZIP
      console.log('[Backup] Zipping content...')
      // Parameter: (SourceFolder, TargetZipFile)
      await zip(workDirPath, zipFilePath)

      // 5. Share ZIP File
      console.log('[Backup] Opening share sheet...')
      await Share.open({
        title: 'Save Wallet Backup',
        url: Platform.OS === 'android' ? `file://${zipFilePath}` : zipFilePath,
        type: 'application/zip',
        failOnCancel: false,
      })

    } catch (error: any) {
      console.error('[Backup] Export Failed:', error)
      throw new Error(`Backup Gagal: ${error.message}`)
    } finally {
      // 6. CLEANUP (Hapus Folder Kerja & File Zip)
      // Kita harus menghapus folder kerja (berisi wallet raw) dan zip final
      try {
        await RNFS.unlink(workDirPath) // Hapus folder sementara
        await RNFS.unlink(zipFilePath) // Hapus zip dari cache (setelah dishare)
        console.log('[Backup] Cleanup completed.')
      } catch (e) {
        console.warn('[Backup] Cleanup warning:', e)
      }
    }
  }
}
```

---

## 4. Testing Checkpoints

1.  **Structure Check:** Rename file `.zip` hasil export, ekstrak di PC. Pastikan isinya `wallet.db` dan `metadata.json`.
2.  **Metadata Check:** Buka `metadata.json` di text editor, pastikan tanggal `created_at` benar.
3.  **Cleanup Check:** Pastikan folder `backup_work_...` tidak tertinggal di cache aplikasi.

---

**End of Document**
