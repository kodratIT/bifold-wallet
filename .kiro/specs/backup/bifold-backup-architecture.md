# Technical Design Document: Bifold Wallet Backup & Restore Module

**Author:** OpenAgent (Technical Architect)  
**Date:** 2024-01-07  
**Context:** Implementasi fitur Export/Import pada Bifold Wallet (Credo-TS based) mengacu pada standar Trinsic/Lissi.

---

## 1. Executive Summary

Fitur ini memungkinkan pengguna Bifold untuk memindahkan identitas digital (DID, Verifiable Credentials, Keys) dari satu perangkat ke perangkat lain dengan aman.

Pendekatan teknis menggunakan **Aries Askar Import/Export** standard. Ini memastikan backup berupa snapshot terenkripsi dari database internal wallet (SQLite/Askar) yang hanya bisa dibuka dengan **Recovery Phrase (Mnemonic)** yang valid.

---

## 2. High-Level Architecture

### Diagram Alur Data

```mermaid
graph TD
    User[User]
    
    subgraph "Device A (Source)"
        BifoldA[Bifold App]
        CredoTS_A[Credo-TS Agent]
        AskarA[Aries Askar Store]
        
        User -->|1. Request Backup| BifoldA
        BifoldA -->|2. Generate Mnemonic| KDF_A[Key Derivation]
        KDF_A -->|3. Derive Key| CredoTS_A
        CredoTS_A -->|4. Export Request| AskarA
        AskarA -->|5. Encrypted Stream| BackupFile[backup.json / .blob]
    end
    
    subgraph "Transfer Medium"
        Cloud[iCloud / GDrive / Airdrop]
    end
    
    subgraph "Device B (Target)"
        BifoldB[Bifold App (Fresh Install)]
        CredoTS_B[Credo-TS Agent]
        AskarB[Aries Askar Store]
        
        BackupFile --> Cloud --> BifoldB
        User -->|6. Input Mnemonic| BifoldB
        BifoldB -->|7. Derive Key| KDF_B[Key Derivation]
        KDF_B -->|8. Import Request| CredoTS_B
        CredoTS_B -->|9. Write Data| AskarB
    end
```

---

## 3. Spesifikasi Teknis

### 3.1. Standar Keamanan & Format
Kita akan menggunakan standar yang didukung oleh **Credo-TS (Aries Framework JS)**:

*   **Storage Engine:** Aries Askar (Default di Bifold).
*   **Export Format:** Askar Encrypted Stream (Raw binary atau Base64 encoded JSON).
*   **Encryption Algorithm:** Chacha20-Poly1305 (Authenticated Encryption) - Standard Askar.
*   **Key Derivation:** Argon2 atau PBKDF2 (untuk mengubah Mnemonic menjadi Key Enkripsi).

### 3.2. Requirement Paket
Pastikan `package.json` Bifold Anda memiliki dependensi ini (biasanya sudah ada di Bifold core):
- `@hyperledger/aries-askar-react-native`
- `@aries-framework/core`
- `react-native-fs` (Untuk akses file system)
- `react-native-share` (Untuk membagikan file backup)
- `bip39` (Untuk generate mnemonic phrase)

---

## 4. Implementasi Kode (The "Core")

Berikut adalah implementasi Service Layer. Buat file baru `src/services/BackupService.ts`.

### 4.1. Backup Service

```typescript
import { Agent } from '@aries-framework/core'
import { WalletExportImportConfig } from '@aries-framework/core'
import RNFS from 'react-native-fs'
import Share from 'react-native-share'

export class BackupService {
  private agent: Agent

  constructor(agent: Agent) {
    this.agent = agent
  }

  /**
   * Step 1: Export Wallet
   * Mengambil snapshot wallet, mengenkripsi dengan key, dan menyimpan ke file.
   */
  public async exportWallet(backupKey: string, fileName: string = 'bifold_backup'): Promise<void> {
    try {
      // 1. Tentukan path penyimpanan sementara
      const path = `${RNFS.DocumentDirectoryPath}/${fileName}.wallet`

      // 2. Konfigurasi Export
      // Penting: Key harus string yang kuat. Di UI kita pakai Mnemonic, 
      // tapi di sini kita terima raw string key.
      const exportConfig: WalletExportImportConfig = {
        key: backupKey, 
        path: path,
      }

      // 3. Eksekusi Export via Agent
      // Ini akan memblokir database sebentar untuk snapshot
      await this.agent.wallet.export(exportConfig)

      // 4. Share File ke User (Save to Files / GDrive / etc)
      await Share.open({
        url: `file://${path}`,
        type: 'application/octet-stream',
        title: 'Save Wallet Backup',
      })

      // 5. Cleanup file sementara setelah share (Security best practice)
      await RNFS.unlink(path)

    } catch (error) {
      console.error('Wallet export failed:', error)
      throw new Error('Failed to export wallet. Please try again.')
    }
  }

  /**
   * Step 2: Import Wallet
   * Digunakan saat inisialisasi aplikasi (Onboarding).
   * Note: Agent belum boleh di-initialize saat memanggil ini, 
   * atau harus menggunakan instance agent sementara.
   */
  public async importWallet(
    backupKey: string, 
    filePath: string,
    walletConfig: any // Config wallet baru (id, key, label)
  ): Promise<void> {
    try {
        // Credo-TS membutuhkan instance agent untuk memanggil wallet.import
        // Namun, logic import biasanya dilakukan sebelum agent utama start.
        // Kita menggunakan method static atau instance khusus untuk import.
        
        const importConfig: WalletExportImportConfig = {
            key: backupKey,
            path: filePath
        }

        // Import process akan membuat database file baru di storage HP
        await this.agent.wallet.import(walletConfig, importConfig)
        
        console.log("Wallet imported successfully")
        
    } catch (error) {
        console.error('Wallet import failed:', error)
        throw error
    }
  }
}
```

### 4.2. Helper: Mnemonic Management
Jangan biarkan user membuat password sendiri (biasanya lemah). Gunakan BIP39 Mnemonic seperti Trinsic/Lissi.

```typescript
// src/utils/crypto.ts
import { generateMnemonic } from 'bip39'

export const generateRecoveryPhrase = (): string => {
  // Generate 12 words mnemonic
  return generateMnemonic(128) 
}

// Note: Credo-TS wallet export `key` parameter mengharapkan string.
// Kita bisa mengirim mnemonic langsung sebagai key, atau hash dulu.
// Askar akan melakukan KDF (Key Derivation Function) sendiri di internalnya.
// Praktik terbaik: Kirim mnemonic mentah, biarkan Askar mengurus salt & hashing.
```

---

## 5. UI/UX Workflow Implementation

Integrasi ke Bifold Screens (`packages/app/src/screens`).

### A. Flow Backup (Export)

**Lokasi:** Settings Screen -> "Backup & Security"

1.  **Screen 1: Introduction**
    *   Teks: "Backup wallet Anda untuk memindahkannya ke perangkat lain. Kami akan membuat file terenkripsi."
    *   Button: "Start Backup"

2.  **Screen 2: Display Recovery Phrase (CRITICAL)**
    *   Action: Panggil `generateRecoveryPhrase()`.
    *   UI: Tampilkan 12 kata dalam kotak yang jelas.
    *   Warning: "Tulis ini di kertas. Jangan screenshot. Siapapun yang punya kode ini bisa mengakses wallet Anda."
    *   Button: "Saya sudah mencatatnya"

3.  **Screen 3: Verify Phrase (Optional tapi Recommended)**
    *   UI: Minta user memasukkan urutan kata ke-3, ke-7, dll untuk memastikan mereka mencatat.

4.  **Screen 4: Execute Export**
    *   Action: 
        *   Show Loading Spinner ("Encrypting Wallet...").
        *   Panggil `BackupService.exportWallet(mnemonic)`.
        *   Trigger `Share.open` dialog.
    *   UI: Success Message setelah file terkirim.

### B. Flow Restore (Import)

**Lokasi:** Onboarding Screen (Halaman Awal saat install baru)

1.  **Screen 1: Welcome**
    *   Button A: "Create New Wallet"
    *   Button B: "I already have a wallet (Restore)" <-- Fitur baru

2.  **Screen 2: Upload Backup File**
    *   UI: Button "Select Backup File". Gunakan `react-native-document-picker`.
    *   Result: Dapatkan `uri` file tersebut.

3.  **Screen 3: Input Recovery Phrase**
    *   UI: Text Area untuk user mengetik 12 kata mnemonic.
    *   Validation: Cek apakah mnemonic valid (BIP39 checksum).

4.  **Screen 4: Execute Import**
    *   Action:
        *   Panggil `BackupService.importWallet(inputMnemonic, fileUri, newWalletConfig)`.
        *   Jika sukses -> Initialize Agent -> Masuk ke Home Screen.
        *   Jika gagal (Wrong password/Corrupt file) -> Show Error.

---

## 6. Security Considerations (Penting!)

1.  **Cloud Sync Warning**: Jika user menyimpan file backup di Google Drive/iCloud, dan menyimpan Mnemonic di Notes (cloud synced), wallet mereka **TIDAK AMAN**.
    *   *Mitigasi:* Edukasi user untuk menyimpan Mnemonic secara offline (kertas).
2.  **File Cleanup**: Setelah export/import selesai, pastikan file temporary di cache aplikasi (`RNFS.DocumentDirectoryPath`) dihapus (`RNFS.unlink`).
3.  **No Server Side**: Proses ini 100% lokal. Jangan pernah kirim mnemonic atau file wallet ke server backend Anda.

## 7. Compatibility Note (Trinsic/Lissi)

Walaupun kita menggunakan standar Aries Askar, interoperabilitas langsung (cross-import) dengan Trinsic/Lissi tergantung pada:
1.  **Versi Askar:** Harus kompatibel.
2.  **Genesis Transaction:** Wallet baru harus connect ke Ledger yang sama (Indy/Cheqd) dengan konfigurasi Genesis yang sama agar kredensial valid.
3.  **Key Derivation Function:** Apakah Trinsic melakukan hashing tambahan pada mnemonic sebelum dikirim ke Askar? (Perlu riset eksperimental: coba export dari Trinsic, coba import di Bifold dev environment).

**Saran:** Fokuskan implementasi "Bifold-to-Bifold" terlebih dahulu untuk memastikan stabilitas internal sebelum mengejar interoperabilitas lintas vendor.
