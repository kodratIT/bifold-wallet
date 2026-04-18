# Restore Success Navigation Flow Design

**Date:** 2026-01-29
**Author:** AI Assistant (Factory)
**Status:** Design Complete - Ready for Implementation

## Overview

This design documents the navigation flow after successful wallet restore. When a user successfully restores their wallet and clicks "OK" on the success modal, the app should navigate to the PIN entry screen with a fresh session, ensuring all UI components display the restored wallet data.

## Problem Statement

After wallet restore succeeds:
1. Wallet data is updated (from backup)
2. UI components still hold references to old data
3. Android Activity lifecycle issues prevent automatic data refresh
4. User needs to re-authenticate with PIN to access restored wallet

## Solution

Use AsyncStorage flag to trigger navigation reset to PIN entry screen after restore success. The flag ensures the user must re-enter their PIN, which:
- Forces fresh data load from restored wallet
- Clears any cached state from pre-restore session
- Maintains security by requiring re-authentication

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. RESTORE SUCCESS                                      │
├─────────────────────────────────────────────────────────┤
│ • User clicks "OK" on success modal                     │
│ • Set AsyncStorage: "post_restore" = "true"            │
│ • Call onRestoreSuccess() callback                     │
│ • Parent component navigates to PIN Entry               │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. NAVIGATION RESET                                     │
├─────────────────────────────────────────────────────────┤
│ • Clear entire navigation stack                         │
│ • Navigate to PINEnter screen (root, only screen)       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. USER ENTERS PIN                                     │
├─────────────────────────────────────────────────────────┤
│ • User enters PIN (or uses biometric)                   │
│ • Wallet unlocks with RESTORED data                     │
│ • Check "post_restore" flag                            │
│ • If true: Clear flag ("post_restore" removed)          │
│ • Set authenticated = true                              │
│ • User enters app with fresh wallet data                │
└─────────────────────────────────────────────────────────┘
```

### Storage Schema

**AsyncStorage Key-Value:**
```typescript
{
  "post_restore": "true" | "false" | null  // String representation
}
```

## Implementation Details

### 1. RestoreWalletScreen (packages/backup/src/screens/RestoreWalletScreen.tsx)

**Changes:**
- Import AsyncStorage
- Set flag before calling onRestoreSuccess callback
- Update success modal button handler

**Code:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'

// Inside handleRestore, success modal:
Alert.alert(
  'Success',
  'Wallet restored successfully! The app will now refresh.',
  [{
    text: 'OK',
    onPress: async () => {
      try {
        await AsyncStorage.setItem('post_restore', 'true')
        onRestoreSuccess?.()
      } catch (error) {
        console.error('[Restore] Failed to set post_restore flag:', error)
        onRestoreSuccess?.()
      }
    }
  }]
)
```

### 2. Parent Component (Where RestoreWalletScreen is Used)

**Changes:**
- Implement navigation.reset() in onRestoreSuccess callback
- Navigate to PIN entry with cleared stack

**Code:**
```typescript
const handleRestoreSuccess = async () => {
  // Flag already set in RestoreWalletScreen
  navigation.reset({
    index: 0,
    routes: [{ name: 'PINEnter' }],
  })
}

<RestoreWalletScreen
  mediatorUrl={mediatorUrl}
  onRestoreSuccess={handleRestoreSuccess}
/>
```

### 3. PINEnter Screen (packages/core/src/screens/PINEnter.tsx)

**Changes:**
- Import AsyncStorage
- Add clearPostRestoreFlag() function
- Call flag clearing after successful authentication (PIN and biometric)

**Code:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'

const clearPostRestoreFlag = async () => {
  try {
    const flag = await AsyncStorage.getItem('post_restore')
    if (flag === 'true') {
      await AsyncStorage.removeItem('post_restore')
      console.log('[PINEnter] Cleared post_restore flag after successful unlock')
    }
  } catch (error) {
    console.error('[PINEnter] Failed to clear post_restore flag:', error)
  }
}

// After successful PIN unlock:
const unlockWalletWithPIN = async (PIN: string) => {
  const result = await checkWalletPIN(PIN)
  if (result) {
    // ... existing code (reset attempts, lockout, etc.)
    await clearPostRestoreFlag() // ← Clear flag here
    setAuthenticated(true)
  }
}

// After successful biometric unlock:
const loadWalletCredentials = useCallback(async () => {
  const walletSecret = await getWalletSecret()
  if (walletSecret) {
    // ... existing code (reset lockout, etc.)
    await clearPostRestoreFlag() // ← Clear flag here too
    setAuthenticated(true)
  }
}, [getWalletSecret, dispatch, setAuthenticated])
```

## Edge Cases

| Scenario | Behavior | Notes |
|----------|----------|-------|
| App crashes after restore | Flag persists, user goes to PIN entry on next launch | ✓ Safe |
| Multiple restore attempts | Flag gets set to "true" again (no change) | ✓ Safe |
| User doesn't complete PIN entry | Flag stays true until successful authentication | ✓ Safe |
| AsyncStorage read error | Defaults to false, doesn't block flow | ✓ Safe |
| AsyncStorage write error | Logs error, continues with navigation | ✓ Safe |

## Security Considerations

### Why This Approach is Secure

1. **Re-authentication Required**: User must enter PIN after restore
2. **No Persistent Credentials**: Flag only tracks navigation state, not credentials
3. **Fresh Session**: Forces complete session refresh with restored wallet
4. **Consistent with AutoLock**: Follows same pattern as existing auto-lock feature

### Comparison with Alternatives

| Approach | Security | UX | Complexity |
|----------|----------|-----|------------|
| **AsyncStorage Flag (chosen)** | High - Requires PIN re-entry | Good - Simple navigation reset | Low |
| App restart via exitApp | High - Requires PIN re-entry | Poor - User must manually reopen app | Medium |
| No flag, direct navigation | Medium - No re-auth required | Good - Seamless | Low |
| Biometric for restore | Very High - Two-factor auth | Medium - Extra step | Medium |

## Testing Requirements

### Unit Tests

1. **RestoreWalletScreen**
   - Verify flag is set when "OK" is clicked
   - Verify onRestoreSuccess is called after flag is set
   - Verify error handling if AsyncStorage fails

2. **PINEnter**
   - Verify flag is cleared after successful PIN entry
   - Verify flag is cleared after successful biometric unlock
   - Verify graceful handling if AsyncStorage fails

### Integration Tests

1. **End-to-end flow**
   - Complete restore → verify flag set → verify navigation
   - PIN entry after restore → verify flag cleared → verify authentication
   - App restart after restore → verify flag persists → verify PIN entry

2. **Edge cases**
   - Multiple restore attempts
   - App crash during restore
   - AsyncStorage errors

### Manual Testing

1. **Happy path**
   - Restore wallet successfully → Click OK → Verify PIN entry screen → Enter PIN → Verify flag cleared

2. **Error scenarios**
   - Restore fails → Verify flag not set
   - AsyncStorage write fails → Verify app still navigates to PIN entry

## Migration Notes

No database migration required. This is purely client-side navigation logic.

## Dependencies

**Required:**
- `@react-native-async-storage/async-storage` (already in project)

**No new dependencies needed.**

## Future Considerations

### Potential Enhancements

1. **Add restore timestamp**: Track when restore occurred for analytics
2. **Restore history**: Store list of restore operations in AsyncStorage
3. **Biometric for restore**: Add optional biometric verification before navigation reset
4. **Telemetry**: Log restore success/failure rates for monitoring

### Known Limitations

1. **Flag persistence**: If user uninstalls/reinstalls app, flag is lost (expected behavior)
2. **Multiple devices**: Flag is device-specific, doesn't sync across devices
3. **Backup compatibility**: Assumes restore completes successfully before setting flag

## References

- Related design: `docs/plans/2026-01-12-backup-restore-design.md`
- Related implementation: `packages/backup/src/screens/RestoreWalletScreen.tsx`
- Related implementation: `packages/core/src/screens/PINEnter.tsx`
- Related implementation: `packages/core/src/contexts/activity.tsx` (AutoLock pattern)

## Changelog

- **2026-01-29**: Initial design created
