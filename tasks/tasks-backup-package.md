## Relevant Files

- `packages/backup/package.json`
- `packages/backup/tsconfig.json`
- `packages/backup/src/index.ts`
- `packages/backup/src/services/BackupService.ts`
- `packages/backup/src/services/__tests__/BackupService.test.ts`
- `packages/backup/src/screens/BackupWalletScreen.tsx`
- `packages/backup/src/screens/RestoreWalletScreen.tsx`
- `package.json` (Root)
- `samples/app/package.json`
- `samples/app/container-imp.tsx`

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, check it off by changing `- [ ]` to `- [x]`. Update after completing each sub-task.

## Tasks

- [ ] 0.0 Create feature branch

  - [ ] 0.1 Create and checkout new branch (`feature/backup-package`) @orchestrator "Start the party in a new room! 🕺"

- [ ] 1.0 Create @bifold/backup Package Structure

  - [ ] 1.1 Create `packages/backup/package.json` @backend-architect "Lay the foundation! 🧱"
  - [ ] 1.2 Create `packages/backup/tsconfig.json` @typescript-expert "Set the rules! 📏"
  - [ ] 1.3 Create `packages/backup/src/index.ts` entry point @backend-specialist "Open the front door! 🚪"
  - [ ] 1.4 Register workspace in root `package.json` @devops-specialist "Join the family! 👨‍👩‍👧‍👦"
  - [ ] 1.5 Install dependencies (`yarn install`) @devops-specialist "Gather the supplies! 🛒"

- [ ] 2.0 Implement BackupService in Package

  - [ ] 2.1 Implement `BackupService.ts` (Mnemonic, Export, Import) @backend-specialist "Build the engine! ⚙️"
  - [ ] 2.2 Implement Unit Tests for BackupService @test-automator "Safety check! ⛑️"

- [ ] 3.0 Create UI Screens in Package

  - [ ] 3.1 Implement `BackupWalletScreen.tsx` @frontend-developer "Paint the export room! 🎨"
  - [ ] 3.2 Implement `RestoreWalletScreen.tsx` @frontend-developer "Paint the import room! 🖌️"
  - [ ] 3.3 Export screens from `src/index.ts` @backend-specialist "Show off the goods! 🛍️"

- [ ] 4.0 Integrate into Sample App

  - [ ] 4.1 Add `@bifold/backup` dependency to `samples/app/package.json` @devops-specialist "Connect the pipes! 🔗"
  - [ ] 4.2 Register BackupService in `samples/app/container-imp.tsx` @backend-architect "Plug it in! 🔌"
  - [ ] 4.3 Add Navigation Routes in App @mobile-developer "Draw the map! 🗺️"

- [ ] 5.0 Verification
  - [ ] 5.1 Run all tests (`yarn test`) @qa-specialist "The final exam! 📝"
  - [ ] 5.2 Verify app build (`yarn android` / `yarn ios`) @mobile-developer "Launch the rocket! 🚀"
