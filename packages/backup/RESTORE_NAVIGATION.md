# Restore Success Navigation

## Overview

After successful wallet restore, the app automatically navigates to the PIN entry screen to ensure fresh data load and maintain security.

## Architecture

### Flow

1. User completes wallet restore (enters mnemonic, selects backup file)
2. Restore process completes successfully
3. Success modal appears
4. User clicks "OK"
5. System sets "post_restore" flag in AsyncStorage
6. Navigation stack resets to PIN entry
7. User enters PIN (or uses biometric)
8. System clears "post_restore" flag
9. Wallet unlocks with restored data
10. User enters app

### AsyncStorage Schema

- **Key:** `post_restore`
- **Type:** `string` ("true" or removed)
- **Purpose:** Track pending restore to trigger navigation reset

## Implementation

### Components Involved

1. **RestoreWalletScreen** (`packages/backup/src/screens/RestoreWalletScreen.tsx`)
   - Sets flag when user clicks OK on success modal
   - Calls `onRestoreSuccess` callback

2. **SettingStack** (`packages/core/src/navigators/SettingStack.tsx`)
   - Implements `handleRestoreSuccess` callback
   - Calls `navigation.reset()` to PIN entry

3. **PINEnter** (`packages/core/src/screens/PINEnter.tsx`)
   - Clears flag after successful authentication
   - Handles both PIN and biometric unlock

## Security Considerations

- Requires re-authentication after restore (PIN entry)
- Flag only tracks navigation state (no credentials)
- Consistent with auto-lock pattern
- Forces fresh session load with restored wallet

## Testing

See `MANUAL_TEST_RESTORE.md` for testing guide.

## Related Files

- Implementation: `src/screens/RestoreWalletScreen.tsx`
- Navigation: `../../core/src/navigators/SettingStack.tsx`
- Flag Clearing: `../../core/src/screens/PINEnter.tsx`
- Tests: `src/__tests__/RestoreWalletScreen.test.tsx`
- Manual Tests: `MANUAL_TEST_RESTORE.md`
