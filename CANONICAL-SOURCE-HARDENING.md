# Canonical Source Hardening - AccountsTab

**Date:** 2026-02-10  
**Status:** ✅ COMPLETE  
**Commits:** 2f6f7d3 (prop-based flow), [this commit] (remove legacy fallback)

---

## Problem Statement

After fixing "customers is not defined" crash by adding local state in AccountsTab, we introduced risk of duplicated data sources:
- Prop-based flow: `useCustomersFromDatabase` hook → AccountsTabDatabase wrapper → AccountsTab prop
- Legacy fallback: Local `useEffect` fetching `/api/customers` → local state

**Risk:** Two sources of truth can drift, causing:
- Stale data displayed in UI
- Extra network requests
- Inconsistent state between components

---

## Solution: ONE Canonical Source

**Principle:** AccountsTabDatabase wrapper is the ONLY entry point for AccountsTab in the app.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Database (Azure PostgreSQL) - SINGLE SOURCE OF TRUTH        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
                ┌──────────────────────┐
                │ /api/customers       │
                └──────────┬───────────┘
                          │
                          ▼
          ┌────────────────────────────────┐
          │ useCustomersFromDatabase hook  │
          │ (canonical data fetcher)       │
          └────────────┬───────────────────┘
                          │
                          ▼
            ┌──────────────────────────────┐
            │ AccountsTabDatabase wrapper  │
            │ - Converts to Account format │
            │ - Handles loading/error      │
            │ - Passes as props            │
            └────────────┬─────────────────┘
                          │
                          ▼
                  ┌───────────────────┐
                  │ AccountsTab       │
                  │ (presentation)    │
                  │ - Requires props  │
                  │ - NO local fetch  │
                  └───────────────────┘
```

---

## Changes Made

### 1. Made Props Required

**Before:**
```typescript
type AccountsTabProps = {
  dbAccounts?: Account[]      // Optional
  dbCustomers?: CustomerApi[]  // Optional
}
```

**After:**
```typescript
type AccountsTabProps = {
  dbAccounts: Account[]        // REQUIRED
  dbCustomers: CustomerApi[]   // REQUIRED
}
```

**Rationale:** Force all usage to go through AccountsTabDatabase wrapper.

---

### 2. Removed Local State Fallback

**Before:**
```typescript
const [customersLocal, setCustomersLocal] = useState<CustomerApi[]>([])
const customers = dbCustomers ?? customersLocal
```

**After:**
```typescript
const customers = Array.isArray(dbCustomers) ? dbCustomers : (() => {
  console.error('[AccountsTab] dbCustomers is not an array. Use AccountsTabDatabase wrapper.')
  return []
})()
```

**Rationale:** Defensive guard only. Log error if prop is invalid, but do NOT fetch locally.

---

### 3. Removed Legacy Fetch useEffect

**Removed (68 lines):**
```typescript
useEffect(() => {
  if (hasSyncedCustomersRef.current) return
  const syncFromCustomers = async () => {
    // Fetch /api/customers
    const { data: rawData, error } = await api.get('/api/customers')
    // Normalize and set local state
    setCustomersLocal(data)
    // Build accounts and sync to localStorage
    // ...
  }
  void syncFromCustomers()
}, [toast, accountsData.length])
```

**Replaced with:**
```typescript
// REMOVED: Legacy local fetch useEffect
// AccountsTabDatabase wrapper handles ALL data loading via useCustomersFromDatabase hook
// This component ONLY receives data via props (dbAccounts, dbCustomers)
```

**Rationale:** Eliminates duplicated fetch. Wrapper handles ALL loading.

---

### 4. Simplified accountsData Initialization

**Before:**
```typescript
const [accountsData, setAccountsData] = useState<Account[]>(() => {
  if (dbAccounts && dbAccounts.length > 0) return dbAccounts
  // Fallback to localStorage
  const loaded = loadAccountsFromStorage()
  return loaded.filter(acc => !deletedAccountsSet.has(acc.name))
})
```

**After:**
```typescript
const [accountsData, setAccountsData] = useState<Account[]>(() => {
  if (!Array.isArray(dbAccounts)) {
    console.error('[AccountsTab] dbAccounts is not an array. Use AccountsTabDatabase wrapper.')
    return []
  }
  return dbAccounts
})
```

**Rationale:** No localStorage fallback. Prop is the only source.

---

### 5. Hardened Prop Sync useEffect

**Before:**
```typescript
useEffect(() => {
  if (dbAccounts && dbAccounts.length > 0) {
    setAccountsData(dbAccounts)
  }
}, [dbAccounts])
```

**After:**
```typescript
useEffect(() => {
  if (!Array.isArray(dbAccounts)) {
    console.error('[AccountsTab] dbAccounts prop is not an array')
    return
  }
  setAccountsData(dbAccounts)
}, [dbAccounts])
```

**Rationale:** Add defensive check with error logging.

---

## Usage Verification

### Current Usage in App

**✅ CustomersHomePage.tsx:**
```typescript
import AccountsTabDatabase from '../../components/AccountsTabDatabase'
// ...
<AccountsTabDatabase focusAccountName={focusAccountName} />
```

**✅ AccountsTabDatabase.tsx (wrapper):**
```typescript
const { customers, loading, error } = useCustomersFromDatabase()
const dbAccounts = databaseCustomersToAccounts(customers)
// ...
<AccountsTab 
  dbAccounts={dbAccounts}
  dbCustomers={customers}
  dataSource="DB"
/>
```

**Result:** NO direct <AccountsTab> usage found in app. Only via wrapper. ✅

---

## Network Behavior

### Before Hardening

**Opening Customers tab:**
1. AccountsTabDatabase fetches `/api/customers` (hook)
2. AccountsTab also fetches `/api/customers` (useEffect fallback)
3. **Result:** 2 requests, duplicated data

### After Hardening

**Opening Customers tab:**
1. AccountsTabDatabase fetches `/api/customers` (hook)
2. AccountsTab receives data via props
3. **Result:** 1 request, single source ✅

---

## Error Handling

### If AccountsTab Used Directly (Without Wrapper)

**TypeScript Error:**
```
Type '{}' is missing the following properties from type 'AccountsTabProps': 
  dbAccounts, dbCustomers
```

**Runtime Behavior:**
- `dbAccounts` and `dbCustomers` will be `undefined`
- Defensive guards log errors to console
- Component renders with empty arrays (no crash)
- **But this should never happen** because TypeScript prevents it

---

## Testing Checklist

### Build
- ✅ TypeScript compiles without errors
- ✅ Vite build succeeds
- ✅ No missing dependencies

### Runtime (to verify in production)
- [ ] Open Customers tab → no error boundary
- [ ] Click on customer → details load
- [ ] Google Sheet label displays correctly
- [ ] Agreement file displays correctly
- [ ] **Network tab shows ONLY ONE `/api/customers` request**
- [ ] Console has NO "customers is not defined" error
- [ ] Console has NO "dbCustomers is not an array" error

---

## Files Changed

1. **src/components/AccountsTab.tsx** (-86 lines)
   - Made `dbAccounts` and `dbCustomers` props required
   - Removed `customersLocal` state
   - Removed legacy fetch useEffect (68 lines)
   - Simplified accountsData initialization (removed localStorage fallback)
   - Hardened prop sync useEffect with error checks

2. **CANONICAL-SOURCE-HARDENING.md** (this file, +283 lines)
   - Documentation of changes and architecture

---

## Migration Notes

### For Future Developers

**If you need to create a new component that displays customer/account data:**

❌ **DON'T:**
```typescript
function MyComponent() {
  const [customers, setCustomers] = useState([])
  useEffect(() => {
    api.get('/api/customers').then(data => setCustomers(data))
  }, [])
  // ...
}
```

✅ **DO:**
```typescript
function MyComponent() {
  const { customers, loading, error } = useCustomersFromDatabase()
  if (loading) return <Spinner />
  if (error) return <Alert>{error}</Alert>
  // ...
}
```

**OR** (if you need Account format):
```typescript
function MyComponent() {
  return <AccountsTabDatabase />
  // Wrapper handles everything
}
```

---

## Lessons Learned

1. **Props over state:** When a wrapper component manages data, pass it down as props. Don't duplicate fetching in child.

2. **Required over optional:** Making props required forces correct usage at compile time, preventing runtime bugs.

3. **One canonical source:** Never have multiple components independently fetching the same data. Use a hook/wrapper.

4. **Fail loudly:** Defensive guards that log errors are better than silent fallbacks that hide bugs.

5. **Remove, don't deprecate:** If legacy paths are risky, remove them entirely rather than leaving them as fallbacks.

---

## Verification Command

```bash
# After deployment, check Network tab
# Open DevTools → Network → Filter: "customers"
# Navigate to Customers tab → click on a customer
# EXPECTED: Only 1 request to /api/customers
# ACTUAL: [to be verified in production]
```

---

**Status:** Ready for deployment  
**Risk:** Low (TypeScript prevents misuse, defensive guards catch runtime issues)  
**Impact:** Eliminates duplicated data sources, improves performance
