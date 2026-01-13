## Relevant Files

- `samples/app/package.json` - Add backup dependencies
- `samples/app/ios/Podfile` - iOS native dependencies
- `samples/app/android/app/src/main/AndroidManifest.xml` - Android permissions
- `samples/app/src/services/BackupService.ts` - Core backup logic (export/import)
- `samples/app/src/services/BackupService.test.ts` - Tests for backup logic
- `samples/app/src/screens/BackupWalletScreen.tsx` - UI for backup process
- `samples/app/src/screens/RestoreWalletScreen.tsx` - UI for restore process
- `samples/app/src/screens/__tests__/BackupWalletScreen.test.tsx` - UI tests
- `samples/app/src/screens/__tests__/RestoreWalletScreen.test.tsx` - UI tests
- `samples/app/container-imp.tsx` - DI registration
- `samples/app/src/navigators/BackupStack.tsx` - Navigation configuration

### Notes

- Unit tests should be placed alongside the code files they test
- Use `yarn test` to run tests

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, check it off by changing `- [ ]` to `- [x]`. Update after completing each sub-task.

## Tasks

- [ ] 0.0 Create feature branch

  - [ ] 0.1 Create and checkout new branch (`git checkout -b feature/backup-restore`) @orchestrator "Let's get this party started! 🚀"

- [ ] 1.0 Setup Environment & Dependencies

  - [ ] 1.1 Install npm packages (`react-native-fs`, `react-native-share`, `react-native-document-picker`, `bip39`, `buffer`, `react-native-get-random-values`) @devops-specialist "Gather the tools for the heist! 🛠️"
  - [ ] 1.2 Update iOS Pods (`cd samples/app/ios && pod install`) @ios-developer "Mix the cement for the foundation! 🍏"
  - [ ] 1.3 Add Android Permissions (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`) to `AndroidManifest.xml` @mobile-developer "Unlock the gates! 🤖"

- [ ] 2.0 Implement BackupService Logic

  - [ ] 2.1 Create `samples/app/src/services/BackupService.ts` skeleton @backend-specialist "Draft the blueprints! 📝"
  - [ ] 2.2 Implement `generateMnemonic()` method using `bip39` @security-specialist "Cook up some secret sauce! 🔐"
  - [ ] 2.3 Implement `exportWallet()` with encryption and file handling @backend-specialist "Pack the treasure chest! 💎"
  - [ ] 2.4 Implement `importWallet()` with decryption and wallet restoration @backend-specialist "Unpack the loot! 🎁"
  - [ ] 2.5 Implement `pickBackupFile()` wrapper for DocumentPicker @mobile-developer "Fetch the map! 🗺️"
  - [ ] 2.6 Add defensive file cleanup (unlink temporary files) @security-specialist "Clean up the evidence! 🧹"
  - [ ] 2.7 Write unit tests for `BackupService` logic @test-automator "Stress test the vault! 🧪"

- [ ] 3.0 Implement Backup UI (Export Flow)

  - [ ] 3.1 Create `samples/app/src/screens/BackupWalletScreen.tsx` layout @frontend-developer "Paint the canvas! 🎨"
  - [ ] 3.2 Implement "Warning Modal" logic (User must accept risks) @ui-ux-designer "Put up the caution tape! ⚠️"
  - [ ] 3.3 Display Mnemonic Phrase (Disable screenshots if possible) @security-specialist "Show the secret code! 🤐"
  - [ ] 3.4 Implement "Verification Quiz" (Ask for specific words) @frontend-developer "Quiz time! 📝"
  - [ ] 3.5 Connect "Export" button to `BackupService` with loading state @frontend-developer "Push the big red button! 🔴"

- [ ] 4.0 Implement Restore UI (Import Flow)

  - [ ] 4.1 Create `samples/app/src/screens/RestoreWalletScreen.tsx` layout @frontend-developer "Design the recovery room! 🏥"
  - [ ] 4.2 Implement File Picker button and display selected file info @mobile-developer "Open the file vault! 📂"
  - [ ] 4.3 Implement Mnemonic Input area with validation @frontend-developer "Type the secret password! 🔑"
  - [ ] 4.4 Connect "Restore" button to `BackupService` and handle errors @frontend-developer "Revive the system! ⚡"

- [ ] 5.0 Integrate Navigation & Container

  - [ ] 5.1 Register `BackupService` in `samples/app/container-imp.tsx` @backend-architect "Wire up the mainframe! 🔌"
  - [ ] 5.2 Add `BackupWalletScreen` to Settings navigation stack @mobile-developer "Add the secret door! 🚪"
  - [ ] 5.3 Add `RestoreWalletScreen` access from Onboarding flow @mobile-developer "Pave the entrance! 🛣️"

- [ ] 6.0 End-to-End Verification
  - [ ] 6.1 Verify Backup flow on Simulator (iOS/Android) @qa-specialist "Run the gauntlet! 🏃"
  - [ ] 6.2 Verify Restore flow with a fresh install @qa-specialist "Phoenix rising! 🔥"
  - [ ] 6.3 Verify security checks (No logs, cleanup works) @security-auditor "Security sweep! 🕵️"
