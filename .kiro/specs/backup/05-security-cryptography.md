# 05 - Security & Cryptography Specifications

**Document Status:** DRAFT v1.0  
**Owner:** Security Architecture Team  
**Module:** Backup & Restore  
**Compliance:** Aries RFC 0050, NIST Guidelines for Password Storage

---

## 1. Cryptographic Primitives

Implementasi keamanan wallet portability pada Bifold bergantung sepenuhnya pada standar kriptografi modern yang disediakan oleh engine **Aries Askar** (ditulis dalam Rust). Kami **TIDAK** membuat algoritma kriptografi sendiri (*Rolling our own crypto*).

| Komponen | Algoritma / Standar | Implementasi |
| :--- | :--- | :--- |
| **Authenticated Encryption** | **XChaCha20-Poly1305** | Standar enkripsi stream yang lebih cepat dari AES pada mobile CPU (ARM) tanpa hardware acceleration, dan kebal terhadap serangan *Timing Attacks*. Poly1305 menjamin integritas data. |
| **Key Derivation (KDF)** | **Argon2i** | Algoritma *Memory-Hard* pemenang *Password Hashing Competition*. Dirancang khusus untuk melawan serangan Brute-Force menggunakan GPU/ASIC. |
| **Random Number Gen** | **OS CSPRNG** | Menggunakan *Cryptographically Secure Pseudo-Random Number Generator* dari OS (`/dev/urandom` di Android, `SecRandomCopyBytes` di iOS) untuk entropy Mnemonic. |
| **Key Strength** | **128-bit Entropy** | Mnemonic 12 kata menghasilkan entropy 128-bit, yang secara matematis mustahil ditebak dengan teknologi komputasi saat ini. |

---

## 2. Data Protection States

### 2.1. Data At Rest (Di HP User)
*   Database wallet (`.sqlite`) selalu terenkripsi oleh **Local Wallet Key**.
*   Local Wallet Key disimpan di **Secure Enclave** (iOS) atau **Keystore** (Android) melalui library `react-native-keychain` atau sejenisnya.
*   Aplikasi tidak pernah menyimpan kunci ini dalam plain text di `AsyncStorage` atau `SharedPreferences`.

### 2.2. Data in Transit (File Backup)
*   Saat proses Export, snapshot database dienkripsi ulang menggunakan kunci turunan dari **Mnemonic**.
*   File `.wallet` yang dihasilkan adalah *Binary Blob* terenkripsi.
*   **Threat Scenario:** Jika file backup ini dicuri dari Google Drive user, penyerang hanya melihat data acak. Tanpa Mnemonic, file ini tidak berguna.

### 2.3. Data in Memory (Saat Proses Berjalan)
*   Mnemonic hanya berada di RAM saat user melihatnya di layar atau saat mengetiknya kembali.
*   Segera setelah proses Export/Import selesai, variabel Mnemonic harus di-*garbage collect* (dibiarkan hilang dari scope fungsi).
*   **Anti-Forensik:** OS modern (iOS/Android) mempersulit pengambilan dump RAM aplikasi lain tanpa akses root/jailbreak.

---

## 3. Threat Model & Mitigasi

Berikut adalah analisis risiko menggunakan model STRIDE/DREAD sederhana.

### A. Ancaman: Pencurian Mnemonic (Social Engineering)
*   **Skenario:** Penyerang menipu user untuk memberikan 12 kata rahasia (Phishing).
*   **Dampak:** Kritis. Penyerang bisa mengkloning identitas user sepenuhnya.
*   **Mitigasi Teknis:** Tidak ada (ini masalah manusia).
*   **Mitigasi UX:**
    *   Tampilkan pesan peringatan merah berkedip/tebal: *"JANGAN BERIKAN KODE INI PADA SIAPAPUN, TERMASUK PETUGAS BANK/IT SUPPORT"*.
    *   Blokir fitur Screenshot pada layar Mnemonic (`SECURE_WINDOW`).

### B. Ancaman: Sisa File Backup (Data Remanence)
*   **Skenario:** Aplikasi crash saat proses share file, meninggalkan file `backup.wallet` di folder cache publik/semi-publik. Malware lain membaca cache tersebut.
*   **Dampak:** Tinggi. Jika malware juga memiliki keylogger untuk mencuri Mnemonic, mereka dapat membuka file tersebut.
*   **Mitigasi:**
    *   Implementasi `try...finally { unlink() }` yang ketat pada kode.
    *   Gunakan direktori Cache sistem (`RNFS.CachesDirectoryPath`). OS Android/iOS secara otomatis menghapus file di direktori ini jika storage penuh atau dalam interval waktu tertentu.

### C. Ancaman: Weak Mnemonic
*   **Skenario:** User mencoba membuat Mnemonic sendiri (misal: "satu dua tiga...").
*   **Dampak:** Mudah ditebak (Brute Force).
*   **Mitigasi:**
    *   Aplikasi **HANYA** menerima Mnemonic yang valid sesuai daftar kata BIP39.
    *   Mnemonic harus memiliki Checksum yang valid.
    *   Aplikasi yang men-generate Mnemonic, bukan User.

---

## 4. Key Management Lifecycle

### 4.1. Creation
1.  User klik "Backup".
2.  App generate entropy 128-bit -> Convert ke 12 Kata BIP39.
3.  Tampilkan ke User.

### 4.2. Usage (Export)
1.  App terima string Mnemonic.
2.  Pass ke Askar Engine.
3.  Askar run `Argon2i(mnemonic, salt)` -> `DerivedKey`.
4.  Encrypt DB dengan `DerivedKey`.

### 4.3. Destruction
1.  Setelah fungsi return, variable Mnemonic di JS dilepas.
2.  File di disk dihapus.

---

## 5. Security Checklist for Release

Sebelum fitur ini naik ke Production, **WAJIB** lolos cek berikut:

*   [ ] **No Logging:** Pastikan tidak ada `console.log(mnemonic)` atau `console.log(key)` di kode production.
*   [ ] **Screenshot Prevention:** Flag `secureTextEntry` atau `allowScreenCapture: false` aktif di layar Mnemonic.
*   [ ] **Clipboard:** Pastikan Mnemonic tidak otomatis tercopy ke clipboard (atau clipboard dibersihkan otomatis setelah X detik).
*   [ ] **Dependency Audit:** Jalankan `npm audit` / `yarn audit` untuk memastikan library `bip39` dan `react-native-fs` tidak memiliki kerentanan yang diketahui.

---

**End of Document**
