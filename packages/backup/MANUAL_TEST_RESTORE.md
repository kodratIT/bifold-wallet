# Manual Testing Guide: Restore Success Navigation

## Overview

This guide provides step-by-step instructions for manually testing the happy path scenario for wallet restoration and navigation flow.

## Happy Path Test

### Test Case: Complete Restore Flow

**Objective:** Verify that wallet restoration succeeds and properly navigates through the PIN entry flow.

**Preconditions:**
- App running in development mode with console logging enabled
- Existing wallet with PIN setup already exists
- Valid backup file available (.json format)
- Mnemonic phrase known and accessible

---

## Test Steps

### Step 1: Initial App State
1. Launch the application
2. Unlock existing wallet with PIN
3. Verify you're on the home screen

### Step 2: Navigate to Restore
1. Tap on **Settings**
2. Tap on **Restore Wallet** option
3. Verify restore screen appears with:
   - "Select File" button
   - Mnemonic text input field
   - "Restore Wallet" button

### Step 3: Select Backup File
1. Tap **"Select File"** button
2. Navigate to your backup file location
3. Select the backup `.json` file
4. Verify file name is displayed

### Step 4: Enter Mnemonic
1. In the mnemonic text field, enter your 12 or 24-word mnemonic phrase
2. Verify words are properly formatted (space-separated)
3. Double-check for typos

### Step 5: Initiate Restore
1. Tap **"Restore Wallet"** button
2. Wait for restore process to complete
3. **Observe console logs** for:
   ```
   [Restore] Wallet restored successfully
   [Restore] Set post_restore flag
   ```

### Step 6: Success Modal
1. Verify success modal appears with message:
   > "Wallet restored successfully! The app will now refresh."
2. Verify **"OK"** button is present
3. Tap **"OK"** button

### Step 7: Navigation Reset Verification
1. **Verify PIN entry screen appears**
2. **Check there is NO back button** (navigation stack cleared)
3. **Observe console logs** for:
   ```
   [PINEnter] Checking for post_restore flag: true
   ```

### Step 8: Enter PIN
1. Enter your PIN using the PIN pad
2. **Observe console logs** for:
   ```
   [PINEnter] PIN verified successfully
   [PINEnter] Cleared post_restore flag
   ```
3. Verify navigation to home screen

### Step 9: Verify Restored Data
1. Check wallet balance matches backup
2. Verify transaction history is present
3. Check wallet settings match backup
4. Confirm all wallet data is from restored backup, not old data

---

## Verification Methods

### AsyncStorage Flag Verification

**Method 1: Console Logging (Recommended for Development)**
- Ensure console logging is enabled in the app
- Watch for these specific log messages during test:
  - `[Restore] Set post_restore flag` - Confirms flag is set after restore
  - `[PINEnter] Checking for post_restore flag: true` - Confirms flag is detected
  - `[PINEnter] Cleared post_restore flag` - Confirms flag is cleared after PIN entry

**Method 2: React Native Debugger**
1. Open React Native Debugger
2. Go to **Storage** → **AsyncStorage**
3. Look for key: `post_restore`
4. Verify value is `"true"` after restore completes
5. Verify key is removed after PIN entry

**Method 3: Direct Inspection (Code)**
Add temporary logging in these locations:
- `packages/backup/src/screens/RestoreScreen.tsx` after `setPostRestoreFlag()` call
- `packages/wallet/src/screens/PINEnterScreen.tsx` in the `useEffect` hook

### Navigation Reset Verification

**Visual Checks:**
1. After tapping "OK" on success modal, verify:
   - ✅ PIN entry screen is displayed
   - ✅ **No back button** visible in header
   - ✅ Cannot swipe back to previous screen
   - ✅ Hardware back button (Android) does nothing

**Technical Verification:**
- Navigation stack should be reset to contain only PIN entry screen
- Navigation state index should be 0

### Wallet Data Verification

**Compare with Backup Data:**
1. Open your backup `.json` file
2. Compare the following with restored app:
   - Wallet address
   - Balance
   - Transaction count
   - Account name
   - Settings/preferences

**Console Verification:**
Look for log: `[Restore] Wallet restored successfully` which contains the restored address.

---

## Expected Results Summary

| Step | Expected Result | Verification Method |
|------|----------------|---------------------|
| 1-4 | Navigation to restore screen, file selection, mnemonic input | Visual check |
| 5 | Restore process completes without errors | Console logs |
| 6 | Success modal appears | Visual check |
| 7 | AsyncStorage flag set to "true" | Console: `[Restore] Set post_restore flag` |
| 8 | Navigation resets to PIN entry (no back button) | Visual: No back button |
| 9 | Enter PIN | PIN pad functionality |
| 10 | AsyncStorage flag cleared | Console: `[PINEnter] Cleared post_restore flag` |
| 11 | Wallet unlocks with RESTORED data | Compare balance/address with backup |
| 12 | Navigate to home screen | Visual check |

---

## Success Criteria

The test passes if ALL of the following are true:

- ✅ Restore completes without errors
- ✅ Success modal appears with correct message
- ✅ AsyncStorage flag "post_restore" is set to "true" after restore
- ✅ App navigates to PIN entry screen
- ✅ No back button available on PIN entry screen
- ✅ PIN entry is functional
- ✅ AsyncStorage flag "post_restore" is cleared after PIN entry
- ✅ Wallet unlocks successfully
- ✅ Restored wallet data matches backup file
- ✅ User can access main app with restored data

---

## Troubleshooting

### Issue: Success modal doesn't appear
- Check console for restore errors
- Verify backup file format is valid
- Verify mnemonic is correct

### Issue: Navigation doesn't reset to PIN entry
- Check console for `[Restore] Set post_restore flag` log
- Verify `post_restore` key in AsyncStorage
- Check navigation reset logic in RestoreScreen

### Issue: Back button still available
- Navigation stack not properly reset
- Check `navigation.reset()` implementation in RestoreScreen

### Issue: Wallet unlocks with old data
- Check if restore actually completed successfully
- Verify backup file contains correct data
- Check wallet state update logic

### Issue: AsyncStorage flag not cleared
- Check PINEnterScreen useEffect logic
- Verify `clearPostRestoreFlag()` is called after PIN verification
- Check console for `[PINEnter] Cleared post_restore flag`

---

## Additional Notes

- **Console Logging**: Essential for verification in development mode
- **Test Environment**: Use development build for better debugging
- **Backup Files**: Keep multiple backup files for testing different scenarios
- **Mnemonic**: Always have mnemonic ready before starting test
- **Clean State**: For repeated testing, clear app data between tests

---

## Related Documentation

- [Restore Flow Architecture](./RESTORE_FLOW.md)
- [PIN Entry Screen Documentation](../wallet/src/screens/PINEnterScreen.tsx)
- [Restore Screen Implementation](./src/screens/RestoreScreen.tsx)
