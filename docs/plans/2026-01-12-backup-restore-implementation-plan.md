# Master Implementation Plan: Bifold Wallet Backup & Restore

Based on the provided specifications, I have synthesized a detailed, step-by-step implementation plan. This plan follows the "Clean Architecture" approach, keeping the core logic isolated from the UI.

## Phase 1: Preparation & Dependencies

First, we need to equip the project with the necessary tools for file handling, sharing, and cryptography.

**Action Items:**

1.  **Install Libraries:**
    Run the following command in `samples/app` (or the root if using workspaces):

    ```bash
    yarn add react-native-fs react-native-share react-native-document-picker bip39 buffer react-native-get-random-values
    ```

2.  **Native Setup (iOS):**

    ```bash
    cd samples/app/ios && pod install && cd ../..
    ```

3.  **Android Permissions:**
    Verify `samples/app/android/app/src/main/AndroidManifest.xml` includes:
    ```xml
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    ```

---

## Phase 2: Logic Layer (BackupService)

We will implement the "Brain" of the feature. This service handles the orchestration between the UI, the Aries Agent, and the File System.

**File:** `samples/app/src/services/BackupService.ts`

**Key Responsibilities:**

- **Mnemonic Generation:** Generate 12-word BIP39 phrases.
- **Export Orchestration:**
  1.  Define a temporary path in `RNFS.CachesDirectoryPath`.
  2.  Call `agent.wallet.export({ key: mnemonic, path: tempPath })`.
  3.  Trigger `Share.open()` to send the file to GDrive/Files.
  4.  **CRITICAL:** `RNFS.unlink(tempPath)` in a `finally` block to ensure no data leaks.
- **Import Orchestration:**
  1.  Pick file using `DocumentPicker`.
  2.  Call `agent.wallet.import(config, { key: mnemonic, path: filePath })`.

---

## Phase 3: UI Implementation

We will create two dedicated screens to handle the user flows.

### 3.1. Backup Screen (Export)

**File:** `samples/app/src/screens/BackupWalletScreen.tsx`

**Flow:**

1.  **Warning Modal:** "Anyone with these words can steal your wallet."
2.  **Mnemonic Display:** Show the 12 words. **Disable Screenshots.**
3.  **Verification (The Quiz):** Ask "What is word #3 and #7?" to prove they wrote it down.
4.  **Action:** Call `BackupService.exportWallet()`. Show a spinner while encrypting.

### 3.2. Restore Screen (Import)

**File:** `samples/app/src/screens/RestoreWalletScreen.tsx`

**Flow:**

1.  **File Picker:** Button to select the `.wallet` file.
2.  **Secret Entry:** Text area for the 12-word mnemonic.
3.  **Action:** Call `BackupService.importWallet()`.
4.  **Success:** Navigate to Home.

---

## Phase 4: Integration & Wiring

Now we connect the new components to the existing app structure.

**Action Items:**

1.  **Dependency Injection:**
    Register `BackupService` in `samples/app/container-imp.tsx` so it can be injected into screens.
2.  **Navigation (Settings):**
    Add `BackupWalletScreen` to the Settings Stack in `packages/core/src/navigators/SettingStack.tsx` (or override it in the app).
3.  **Navigation (Onboarding):**
    Add `RestoreWalletScreen` to the Onboarding Stack. Add a "I have a backup" link on the `Splash` or `Onboarding` screen.

---

## Phase 5: Verification Checklist

Before marking as complete, we must verify:

- [ ] **Security:** Mnemonic is never logged to console.
- [ ] **Cleanup:** Temporary backup files are deleted after export.
- [ ] **Usability:** The "Quiz" prevents users from skipping the backup note-taking.
- [ ] **Functionality:** A wallet exported from Device A can be successfully imported on Device B (or a simulator).

---

**Ready to start?**
I recommend we begin with **Phase 1 (Dependencies)** and then move to **Phase 2 (Service Implementation)**. Shall I proceed with installing the dependencies?
