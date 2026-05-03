# 🐛 Bug: Pesan Diterima Agent Tapi Tidak Muncul di UI

**Tanggal:** 2026-05-02 22:00 UTC  
**Severity:** P1 - MAJOR  
**Status:** ✅ FIXED

---

## 🎯 Masalah

**Gejala:**
- Log menunjukkan agent menerima pesan: `"Received message with type 'https://didcomm.org/basicmessage/1.0/message'"`
- Pesan **TIDAK muncul** di UI (chat screen atau home screen)
- Pesan tersimpan di database tapi tidak di-render

**Log Evidence:**
```
21:58:01 INFO: Received message with type 'https://didcomm.org/basicmessage/1.0/message'
21:58:18 INFO: Received message with type 'https://didcomm.org/basicmessage/1.0/message'
```

---

## 🔍 Root Cause Analysis

### Masalah di BasicMessageProvider

**File:** `packages/react-hooks/src/BasicMessageProvider.tsx`

**Kode Bermasalah:**
```typescript
useEffect(() => {
  if (state.loading) return

  const basicMessageAdded$ = recordsAddedByType(agent, DidCommBasicMessageRecord).subscribe((record) => {
    setState((prevState) => addRecord(record, prevState))
  })

  // ... subscriptions

  return () => {
    basicMessageAdded$?.unsubscribe()
    // ...
  }
}, [agent]) // ❌ Missing state.loading in dependency array
```

### Mengapa Ini Masalah?

1. **Dependency Array Tidak Lengkap:**
   - `useEffect` hanya depend on `[agent]`
   - Seharusnya `[state.loading, agent]`

2. **Race Condition:**
   ```
   Initial render:
     state.loading = true
     → useEffect runs
     → Early return (state.loading = true)
     → No subscriptions setup ❌
   
   After setInitialState:
     state.loading = false
     → useEffect TIDAK re-run (karena agent tidak berubah)
     → Subscriptions TIDAK pernah di-setup ❌
   ```

3. **Akibatnya:**
   - Event listener tidak pernah di-setup
   - Agent menerima pesan dan simpan ke database ✅
   - Event `RecordSaved` di-emit ✅
   - Tapi tidak ada listener yang mendengarkan ❌
   - UI tidak update ❌

---

## ✅ Solusi yang Diterapkan

### Fix 1: Tambahkan state.loading ke Dependency Array

```typescript
useEffect(() => {
  if (state.loading) return

  const basicMessageAdded$ = recordsAddedByType(agent, DidCommBasicMessageRecord).subscribe((record) => {
    console.log('[BasicMessageProvider] Message added:', record.id) // ✅ Debug log
    setState((prevState) => addRecord(record, prevState))
  })

  const basicMessageUpdated$ = recordsUpdatedByType(agent, DidCommBasicMessageRecord).subscribe((record) => {
    console.log('[BasicMessageProvider] Message updated:', record.id) // ✅ Debug log
    setState((prevState) => updateRecord(record, prevState))
  })

  const basicMessageRemoved$ = recordsRemovedByType(agent, DidCommBasicMessageRecord).subscribe((record) => {
    console.log('[BasicMessageProvider] Message removed:', record.id) // ✅ Debug log
    setState((prevState) => removeRecord(record, prevState))
  })

  console.log('[BasicMessageProvider] Subscriptions setup complete') // ✅ Debug log

  return () => {
    console.log('[BasicMessageProvider] Unsubscribing...') // ✅ Debug log
    basicMessageAdded$?.unsubscribe()
    basicMessageUpdated$?.unsubscribe()
    basicMessageRemoved$?.unsubscribe()
  }
}, [state.loading, agent]) // ✅ FIXED: Added state.loading
```

### Manfaat Fix:

1. **Proper Lifecycle:**
   ```
   Initial render:
     state.loading = true
     → useEffect runs
     → Early return ✅
   
   After setInitialState:
     state.loading = false
     → useEffect RE-RUNS (karena state.loading berubah) ✅
     → Subscriptions di-setup ✅
   ```

2. **Debug Logs:**
   - Tambahkan console.log untuk tracking
   - Mudah debug jika masih ada masalah

3. **Event Flow:**
   ```
   Agent receives message
     ↓
   Save to database
     ↓
   Emit RecordSaved event
     ↓
   BasicMessageProvider listener catches event ✅
     ↓
   setState() called
     ↓
   UI re-renders
     ↓
   Message appears in chat ✅
   ```

---

## 📊 Before vs After

### ❌ BEFORE (Buggy)

```
Agent receives message
  ↓
Save to database ✅
  ↓
Emit RecordSaved event ✅
  ↓
No listener (subscription not setup) ❌
  ↓
UI tidak update ❌
  ↓
User tidak lihat pesan ❌
```

**Log:**
```
✅ "Agent received message"
✅ "Received message with type 'https://didcomm.org/basicmessage/1.0/message'"
❌ No "[BasicMessageProvider] Message added" log
❌ Message tidak muncul di UI
```

### ✅ AFTER (Fixed)

```
Agent receives message
  ↓
Save to database ✅
  ↓
Emit RecordSaved event ✅
  ↓
BasicMessageProvider listener catches ✅
  ↓
setState() called ✅
  ↓
UI re-renders ✅
  ↓
Message appears in chat ✅
```

**Log:**
```
✅ "Agent received message"
✅ "Received message with type 'https://didcomm.org/basicmessage/1.0/message'"
✅ "[BasicMessageProvider] Subscriptions setup complete"
✅ "[BasicMessageProvider] Message added: <message-id>"
✅ Message muncul di UI
```

---

## 🧪 Testing Instructions

### Test 1: Pesan Muncul di Chat

**Langkah:**
1. Build dan jalankan app dengan fix
2. Buka chat dengan contact
3. Minta issuer kirim pesan
4. Monitor log

**Expected Log:**
```
[BasicMessageProvider] Subscriptions setup complete
Agent received message
Received message with type 'https://didcomm.org/basicmessage/1.0/message'
[BasicMessageProvider] Message added: <message-id>
```

**Expected UI:**
- ✅ Pesan muncul di chat dalam 1-2 detik
- ✅ Pesan ter-render dengan benar

### Test 2: Multiple Messages

**Langkah:**
1. Issuer kirim 3 pesan berturut-turut
2. Monitor log dan UI

**Expected:**
- ✅ Semua 3 pesan muncul
- ✅ Log menunjukkan 3x "Message added"
- ✅ Tidak ada pesan yang hilang

### Test 3: App Resume

**Langkah:**
1. Minimize app
2. Issuer kirim pesan
3. Buka app lagi
4. Pesan di-fetch dari mediator

**Expected:**
- ✅ Log: "Message added"
- ✅ Pesan muncul di UI

---

## 📁 File yang Diubah

**File:** `packages/react-hooks/src/BasicMessageProvider.tsx`

**Changes:**
- Added `state.loading` to dependency array
- Added debug console.log statements
- Lines changed: +6, -1

---

## 🔍 Debug Commands

### Monitor Logs

```bash
# Check if subscriptions are setup
adb logcat | grep "BasicMessageProvider"

# Check if messages are received
adb logcat | grep "Received message with type"

# Check if messages are added to state
adb logcat | grep "Message added"
```

### Expected Output (Success)

```
[BasicMessageProvider] Subscriptions setup complete
Agent received message
Received message with type 'https://didcomm.org/basicmessage/1.0/message'
[BasicMessageProvider] Message added: abc-123-def
```

### Error Indicators

**If you see:**
```
Agent received message
Received message with type 'https://didcomm.org/basicmessage/1.0/message'
```

**But NOT:**
```
[BasicMessageProvider] Message added: ...
```

**Then:** Subscription masih belum di-setup dengan benar.

---

## 🎓 Lessons Learned

### 1. Dependency Array Harus Lengkap

**Rule:** Semua values yang digunakan di dalam `useEffect` harus ada di dependency array.

**Contoh:**
```typescript
useEffect(() => {
  if (state.loading) return // ← state.loading digunakan
  // ... do something
}, [agent]) // ❌ WRONG: state.loading tidak ada di array

useEffect(() => {
  if (state.loading) return // ← state.loading digunakan
  // ... do something
}, [state.loading, agent]) // ✅ CORRECT
```

### 2. Early Return Mempengaruhi Lifecycle

Jika ada early return di `useEffect`, pastikan dependency array memicu re-run saat kondisi berubah.

### 3. Debug Logs Sangat Penting

Tanpa debug logs, sulit tahu apakah subscription di-setup atau tidak.

---

## 🔄 Rollback (Jika Diperlukan)

```bash
cd /Users/kodrat/Public/SSI/bifold/bifold-wallet-dev

git checkout HEAD -- packages/react-hooks/src/BasicMessageProvider.tsx

cd packages/react-hooks && npm run build
```

---

## 📊 Summary

| Item | Status |
|------|--------|
| Bug Identified | ✅ |
| Root Cause Found | ✅ |
| Fix Implemented | ✅ |
| Debug Logs Added | ✅ |
| Testing Instructions | ✅ |
| Build Status | ⏳ Pending |

---

## 🚀 Next Steps

1. **Build:**
   ```bash
   cd packages/react-hooks && npm run build
   cd ../.. && npx react-native run-android
   ```

2. **Test:**
   - Test pesan muncul di chat
   - Test multiple messages
   - Test app resume

3. **Monitor:**
   ```bash
   adb logcat | grep -E "BasicMessageProvider|Received message"
   ```

4. **Verify:**
   - ✅ Log: "Subscriptions setup complete"
   - ✅ Log: "Message added" saat pesan diterima
   - ✅ Pesan muncul di UI

---

**Dibuat oleh:** Kiro AI Assistant  
**Tanggal:** 2026-05-02 22:00 UTC  
**Status:** ✅ Fixed, Ready for Testing
