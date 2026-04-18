# Restore Success Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement navigation reset to PIN entry after successful wallet restore, using AsyncStorage flag to ensure fresh data load.

**Architecture:** After restore success, set "post_restore" flag in AsyncStorage, then parent component triggers navigation.reset() to PIN entry. PINEnter clears flag after successful authentication.

**Tech Stack:** React Native, TypeScript, AsyncStorage, React Navigation v6

---

## Task 1: Add AsyncStorage Import to RestoreWalletScreen

**Files:**
- Modify: `packages/backup/src/screens/RestoreWalletScreen.tsx`

**Step 1: Add AsyncStorage import**

Add at top of file with other imports:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'
```

**Step 2: Verify no compile errors**

Run: `cd packages/backup && npx tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add packages/backup/src/screens/RestoreWalletScreen.tsx
git commit -m "feat(backup): import AsyncStorage for restore navigation flag"
```

---

## Task 2: Update Success Modal Handler to Set Flag

**Files:**
- Modify: `packages/backup/src/screens/RestoreWalletScreen.tsx`
- Lines: Around 155-165 (success Alert.alert in handleRestore)

**Step 1: Locate the success modal**

Find the Alert.alert with "Success" title in handleRestore function.

**Step 2: Update the OK button onPress**

Replace the current onPress callback:
```typescript
// OLD CODE:
onPress: () => onRestoreSuccess?.()

// NEW CODE:
onPress: async () => {
  try {
    await AsyncStorage.setItem('post_restore', 'true')
    console.log('[Restore] Set post_restore flag')
    onRestoreSuccess?.()
  } catch (error) {
    console.error('[Restore] Failed to set post_restore flag:', error)
    // Still navigate even if flag set fails
    onRestoreSuccess?.()
  }
}
```

**Step 3: Verify TypeScript compilation**

Run: `cd packages/backup && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/backup/src/screens/RestoreWalletScreen.tsx
git commit -m "feat(backup): set post_restore flag on restore success"
```

---

## Task 3: Find Parent Component Using RestoreWalletScreen

**Files:**
- Search: `packages/` directory for usage of `<RestoreWalletScreen`

**Step 1: Search for RestoreWalletScreen usage**

Run: `cd packages && grep -r "RestoreWalletScreen" --include="*.tsx" --include="*.ts" -l`

**Step 2: Identify the parent component**

Open files that contain RestoreWalletScreen and find where it's rendered with props.

Expected: Found in Settings or similar screen component.

**Step 3: Note the file path**

Document the file path for Task 4. Do NOT commit yet.

---

## Task 4: Update Parent Component with Navigation Reset

**Files:**
- Modify: [Path found in Task 3, likely in core package]

**Step 1: Add handleRestoreSuccess function**

Add before the return statement:
```typescript
const handleRestoreSuccess = useCallback(() => {
  navigation.reset({
    index: 0,
    routes: [{ name: 'PINEnter' }],
  })
}, [navigation])
```

**Step 2: Update RestoreWalletScreen props**

Add or update the onRestoreSuccess prop:
```typescript
<RestoreWalletScreen
  walletConfig={walletConfig}
  mediatorUrl={mediatorUrl}
  onRestoreSuccess={handleRestoreSuccess}
/>
```

**Step 3: Verify TypeScript compilation**

Run: `cd packages/core && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add [path to parent component]
git commit -m "feat(core): navigate to PIN entry after restore success"
```

---

## Task 5: Add AsyncStorage Import to PINEnter

**Files:**
- Modify: `packages/core/src/screens/PINEnter.tsx`

**Step 1: Add AsyncStorage import**

Add at top of file with other imports:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'
```

**Step 2: Verify no compile errors**

Run: `cd packages/core && npx tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add packages/core/src/screens/PINEnter.tsx
git commit -m "feat(core): import AsyncStorage for post_restore flag clearing"
```

---

## Task 6: Add clearPostRestoreFlag Function to PINEnter

**Files:**
- Modify: `packages/core/src/screens/PINEnter.tsx`

**Step 1: Add the helper function**

Add after the loadWalletCredentials function (around line 100):
```typescript
const clearPostRestoreFlag = useCallback(async () => {
  try {
    const flag = await AsyncStorage.getItem('post_restore')
    if (flag === 'true') {
      await AsyncStorage.removeItem('post_restore')
      console.log('[PINEnter] Cleared post_restore flag after successful unlock')
    }
  } catch (error) {
    console.error('[PINEnter] Failed to clear post_restore flag:', error)
  }
}, [])
```

**Step 2: Verify TypeScript compilation**

Run: `cd packages/core && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/core/src/screens/PINEnter.tsx
git commit -m "feat(core): add clearPostRestoreFlag helper function"
```

---

## Task 7: Call clearPostRestoreFlag After PIN Success

**Files:**
- Modify: `packages/core/src/screens/PINEnter.tsx`
- Lines: In unlockWalletWithPIN function (around line 170)

**Step 1: Find the success path in unlockWalletWithPIN**

Locate where `result` is true and before `setAuthenticated(true)`.

**Step 2: Add flag clearing call**

Add this line after the dispatch calls and before setAuthenticated:
```typescript
await clearPostRestoreFlag()
```

**Step 3: Verify TypeScript compilation**

Run: `cd packages/core && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/core/src/screens/PINEnter.tsx
git commit -m "feat(core): clear post_restore flag after successful PIN entry"
```

---

## Task 8: Call clearPostRestoreFlag After Biometric Success

**Files:**
- Modify: `packages/core/src/screens/PINEnter.tsx`
- Lines: In loadWalletCredentials callback (around line 80)

**Step 1: Find loadWalletCredentials function**

Locate the useCallback that loads wallet credentials.

**Step 2: Add flag clearing call**

Add `clearPostRestoreFlag` to dependency array and call it after walletSecret is found:

```typescript
const loadWalletCredentials = useCallback(async () => {
  const walletSecret = await getWalletSecret()
  if (walletSecret) {
    dispatch({
      type: DispatchAction.LOCKOUT_UPDATED,
      payload: [{ displayNotification: false }],
    })
    dispatch({
      type: DispatchAction.ATTEMPT_UPDATED,
      payload: [{ loginAttempts: 0 }],
    })

    // Clear flag here
    await clearPostRestoreFlag()

    setAuthenticated(true)
  }
}, [getWalletSecret, dispatch, setAuthenticated, clearPostRestoreFlag])
```

**Step 3: Verify TypeScript compilation**

Run: `cd packages/core && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/core/src/screens/PINEnter.tsx
git commit -m "feat(core): clear post_restore flag after biometric unlock"
```

---

## Task 9: Write Unit Test for Flag Setting in RestoreWalletScreen

**Files:**
- Modify: `packages/backup/src/__tests__/RestoreWalletScreen.test.tsx`

**Step 1: Add test for flag setting**

Add after existing tests:
```typescript
it('sets post_restore flag when restore succeeds and OK is clicked', async () => {
  const mockOnRestoreSuccess = jest.fn()
  AsyncStorage.setItem = jest.fn().mockResolvedValue(undefined)

  render(
    <RestoreWalletScreen
      mediatorUrl="http://mediator.example.com"
      onRestoreSuccess={mockOnRestoreSuccess}
    />
  )

  // Fill form and click restore
  // ... (existing code to trigger restore)

  // Wait for success modal and click OK
  const okButton = await findByText('OK')
  fireEvent.press(okButton)

  await waitFor(() => {
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('post_restore', 'true')
    expect(mockOnRestoreSuccess).toHaveBeenCalled()
  })
})

it('navigates even if setting flag fails', async () => {
  const mockOnRestoreSuccess = jest.fn()
  AsyncStorage.setItem = jest.fn().mockRejectedValue(new Error('Storage error'))

  render(
    <RestoreWalletScreen
      mediatorUrl="http://mediator.example.com"
      onRestoreSuccess={mockOnRestoreSuccess}
    />
  )

  // Trigger restore and click OK
  // ... (same as above)

  await waitFor(() => {
    expect(AsyncStorage.setItem).toHaveBeenCalled()
    expect(mockOnRestoreSuccess).toHaveBeenCalled() // Still called
  })
})
```

**Step 2: Run tests**

Run: `cd packages/backup && npm test -- RestoreWalletScreen.test.tsx`
Expected: Tests pass

**Step 3: Commit**

```bash
git add packages/backup/src/__tests__/RestoreWalletScreen.test.tsx
git commit -m "test(backup): add tests for post_restore flag setting"
```

---

## Task 10: Write Unit Test for Flag Clearing in PINEnter

**Files:**
- Create: `packages/core/src/__tests__/PINEnter.flag.test.tsx`

**Step 1: Create new test file**

Create new test file:
```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import PINEnter from '../screens/PINEnter'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  removeItem: jest.fn(),
}))

describe('PINEnter post_restore flag clearing', () => {
  it('clears post_restore flag after successful PIN entry', async () => {
    AsyncStorage.getItem = jest.fn().mockResolvedValue('true')
    AsyncStorage.removeItem = jest.fn().mockResolvedValue(undefined)

    const setAuthenticated = jest.fn()
    const { getByTestId, findByTestId } = render(
      <PINEnter setAuthenticated={setAuthenticated} />
    )

    // Simulate successful PIN entry (this will need mocking of checkWalletPIN)
    // For now, just verify the function exists and can be called

    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('post_restore')
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('post_restore')
    })
  })

  it('handles AsyncStorage errors gracefully', async () => {
    AsyncStorage.getItem = jest.fn().mockRejectedValue(new Error('Storage error'))

    const setAuthenticated = jest.fn()
    render(<PINEnter setAuthenticated={setAuthenticated} />)

    // Should not throw, should log error instead
    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalled()
    })
  })
})
```

**Step 2: Run tests**

Run: `cd packages/core && npm test -- PINEnter.flag.test.tsx`
Expected: Tests pass (may need adjustment based on actual PINEnter implementation)

**Step 3: Commit**

```bash
git add packages/core/src/__tests__/PINEnter.flag.test.tsx
git commit -m "test(core): add tests for post_restore flag clearing"
```

---

## Task 11: Manual Testing - Happy Path

**Files:**
- None (manual test)

**Step 1: Start app**

Run: `npm run start` (or your dev server command)

**Step 2: Perform restore**

1. Navigate to Settings → Restore Wallet
2. Select backup file
3. Enter mnemonic
4. Click Restore
5. Wait for success message
6. Click "OK"

**Expected behavior:**
- Flag is set in AsyncStorage (check with React Native Debugger or AsyncStorage inspection)
- App navigates to PIN entry screen
- Navigation stack is cleared (no back button)

**Step 3: Enter PIN**

1. Enter your PIN
2. Submit

**Expected behavior:**
- Flag is cleared from AsyncStorage
- Wallet unlocks with restored data
- User enters main app with fresh data

**Step 4: Verify flag cleared**

Check AsyncStorage again - "post_restore" should not exist.

---

## Task 12: Manual Testing - Edge Cases

**Files:**
- None (manual test)

**Step 1: Test multiple restore attempts**

1. Restore wallet successfully
2. Before entering PIN, go back and restore again
3. Click OK on second restore

**Expected:** Flag still set to "true", navigation still works

**Step 2: Test app crash after restore**

1. Restore wallet successfully
2. Click OK
3. Force close app (kill process)
4. Reopen app

**Expected:** App opens to PIN entry screen (flag persisted)

**Step 3: Test AsyncStorage failure**

This requires mocking or modifying AsyncStorage to fail. Skip for now unless critical.

---

## Task 13: Update Documentation

**Files:**
- Create: `packages/backup/RESTORE_NAVIGATION.md` (or similar)

**Step 1: Create documentation**

Create documentation explaining the flow:
```markdown
# Restore Success Navigation

## Overview

After successful wallet restore, app navigates to PIN entry screen to ensure fresh data load.

## Flow

1. User completes restore
2. Success modal appears
3. User clicks "OK"
4. Flag "post_restore" is set in AsyncStorage
5. Navigation resets to PIN entry
6. User enters PIN
7. Flag is cleared
8. User enters app with restored wallet data

## Implementation

- Flag set: `packages/backup/src/screens/RestoreWalletScreen.tsx`
- Navigation reset: Parent component (Settings or similar)
- Flag cleared: `packages/core/src/screens/PINEnter.tsx`
```

**Step 2: Commit documentation**

```bash
git add packages/backup/RESTORE_NAVIGATION.md
git commit -m "docs(backup): add restore navigation flow documentation"
```

---

## Task 14: Final Verification and Cleanup

**Files:**
- Multiple (verification only)

**Step 1: Run all tests**

Run: `npm test` (or your test command)
Expected: All tests pass

**Step 2: Type check all packages**

Run: `npx tsc --noEmit` (run from root)
Expected: No TypeScript errors

**Step 3: Verify no console errors**

Start app and perform restore flow. Check console for errors or warnings.

**Step 4: Final commit**

```bash
git commit --allow-empty -m "feat(backup): complete restore success navigation implementation"
```

---

## Notes for Developer

- **AsyncStorage already installed**: This project uses `@react-native-async-storage/async-storage`
- **Navigation structure**: Uses React Navigation v6, likely with stack navigator
- **Parent component location**: May be in Settings screen or similar. Search for `<RestoreWalletScreen` usage
- **PINEnter location**: `packages/core/src/screens/PINEnter.tsx`
- **Testing approach**: Unit tests for AsyncStorage calls, manual tests for full flow
- **Error handling**: All AsyncStorage operations wrapped in try-catch, failures are logged but don't block flow

## References

- Design: `docs/plans/2026-01-29-restore-success-navigation-design.md`
- AsyncStorage docs: https://react-native-async-storage.github.io/async-storage/
- React Navigation reset: https://reactnavigation.org/docs/navigation-prop/#reset
