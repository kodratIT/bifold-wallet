# Backup & Restore Package Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a standalone package `@bifold/backup` that implements Wallet Portability (Backup & Restore) and integrate it into the main app via dependency injection, keeping `@bifold/core` clean.

**Architecture:**
We will create a new monorepo package `packages/backup`. This package will export a `BackupModule` and UI components. The main app (`samples/app`) will consume this package and register it in the dependency container. This ensures the backup feature is completely decoupled from the core wallet logic and avoids fork conflicts.

**Tech Stack:** React Native, Credo-TS (Aries Framework), TypeScript, Tsyringe (DI), React Native FS/Share/DocumentPicker.

## Phase 1: Package Scaffold

### Task 1: Create @bifold/backup Package Structure

**Files:**

- Create: `packages/backup/package.json`
- Create: `packages/backup/tsconfig.json`
- Create: `packages/backup/src/index.ts`
- Modify: `package.json` (Root) -> Add to workspaces

**Step 1: Create package.json**

```json
{
  "name": "@bifold/backup",
  "version": "0.1.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "license": "Apache-2.0",
  "dependencies": {
    "@credo-ts/core": "0.5.17",
    "react": "18.3.1",
    "react-native": "0.73.11",
    "tsyringe": "~4.8.0"
  },
  "devDependencies": {
    "typescript": "~5.5.4"
  }
}
```

**Step 2: Create tsconfig.json**
Use `extends` from root base if possible, or copy standard config.

**Step 3: Create Entry Point**
`packages/backup/src/index.ts`

```typescript
export const BackupPackageVersion = '0.1.0'
```

**Step 4: Register Workspace**
Run `yarn install` to link the new workspace.

---

## Phase 2: Service Implementation

### Task 2: Implement BackupService in Package

**Files:**

- Create: `packages/backup/src/services/BackupService.ts`
- Create: `packages/backup/src/services/__tests__/BackupService.test.ts`

**Step 1: Write Interface & Mnemonic Logic**
Implement `generateMnemonic` using `bip39`.

**Step 2: Implement Export/Import Logic**
Move the logic we planned previously into this standalone service.

- Use `fs` and `share` libraries (ensure they are peerDependencies).

**Step 3: Export from Index**
Update `packages/backup/src/index.ts` to export `BackupService`.

---

## Phase 3: UI Components

### Task 3: Create UI Screens in Package

**Files:**

- Create: `packages/backup/src/screens/BackupWalletScreen.tsx`
- Create: `packages/backup/src/screens/RestoreWalletScreen.tsx`

**Step 1: Implement Backup Screen**
Copy the UI logic planned earlier. Ensure it imports `BackupService` from `../services/BackupService`.

**Step 2: Implement Restore Screen**
Same as above.

---

## Phase 4: Integration (The Extension)

### Task 4: Integrate into Sample App

**Files:**

- Modify: `samples/app/package.json` (Add `@bifold/backup`)
- Modify: `samples/app/container-imp.tsx`

**Step 1: Add Dependency**
`yarn workspace bifold-app add @bifold/backup`

**Step 2: Register in Container**
In `samples/app/container-imp.tsx`:

```typescript
import { BackupService } from '@bifold/backup'

// Inside init()
this.container.registerSingleton(BackupService)
```

**Step 3: Add Navigation Routes**
In `samples/app/src/navigators/RootStack.tsx` (or equivalent), add the screens from the package.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-01-12-backup-package-plan.md`.

**Two execution options:**

1.  **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration.
2.  **Parallel Session (separate)** - Open new session with executing-plans.

**Which approach?**
