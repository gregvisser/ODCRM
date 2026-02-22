# ODCRM Architecture - Database-First Approach

## 🎯 Core Principle

**The database is the SINGLE SOURCE OF TRUTH for all customer data.**

No more localStorage for critical data. No more stale data issues. No more sync problems.

---

## 📊 Data Flow

### ✅ CORRECT Architecture (Database-First)

```
┌─────────────────────┐
│   React Component   │
│  (AccountsTab/etc)  │
└──────────┬──────────┘
           │
           ├─ Read:  GET /api/customers
           ├─ Create: POST /api/customers
           ├─ Update: PUT /api/customers/:id
           └─ Delete: DELETE /api/customers/:id
           │
┌──────────▼──────────┐
│   Express API       │
│  (server/routes/)   │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Prisma ORM        │
│   (schema.prisma)   │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Azure PostgreSQL   │
│  (Cloud Database)   │
└─────────────────────┘
```

### ❌ OLD Architecture (localStorage-First) - DEPRECATED

```
┌─────────────────────┐
│   React Component   │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   localStorage      │  ← PROBLEM: Not reliable, per-browser, can be cleared
│  (Browser Storage)  │
└─────────────────────┘
           │
      (maybe syncs?)
           │
┌──────────▼──────────┐
│  Azure PostgreSQL   │  ← Source of truth is unclear
└─────────────────────┘
```

---

## 🌐 Production Hosting Architecture

```
Browser
  │
  ├── Static assets (HTML/JS/CSS)
  │     └── Azure Static Web Apps (odcrm.bidlow.co.uk)
  │
  └── API calls (/api/*)
        └── Azure App Service (odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net)
              └── Node/Express backend (server/)
```

**Key fact:** The frontend calls the backend **directly** via `VITE_API_URL`, which is baked into the
production build as the App Service URL. Azure Static Web Apps does **not** proxy `/api/*` requests —
SWA only serves static files. The `staticwebapp.config.json` has no `/api/*` backend routes; it only
configures static-asset caching and the SPA navigation fallback.

---

## 🔧 Implementation

### 1. Custom Hook: `useCustomersFromDatabase`

**Location:** `src/hooks/useCustomersFromDatabase.ts`

**Purpose:** Single hook to manage all customer database operations

**Usage:**
```typescript
import { useCustomersFromDatabase } from '../hooks/useCustomersFromDatabase'

function MyComponent() {
  const { 
    customers,      // Array of customers from database
    loading,        // Loading state
    error,          // Error message if any
    refetch,        // Manually refresh
    createCustomer, // Create new customer
    updateCustomer, // Update existing customer
    deleteCustomer  // Delete customer
  } = useCustomersFromDatabase()

  // customers is ALWAYS fresh from database
  // No need to manage localStorage
  // No need to worry about stale data
}
```

### 2. Mapper: `customerAccountMapper`

**Location:** `src/utils/customerAccountMapper.ts`

**Purpose:** Convert between database format and UI format

**Why?** Different components may use different data structures, but they all talk to the same database.

**Usage:**
```typescript
import { databaseCustomerToAccount, accountToDatabaseCustomer } from '../utils/customerAccountMapper'

// Convert database customer to UI account format
const account = databaseCustomerToAccount(databaseCustomer)

// Convert UI account back to database format for updates
const dbData = accountToDatabaseCustomer(account)
await updateCustomer(account._databaseId!, dbData)
```

---

## 📝 Migration Guide

### For New Components

✅ **DO:**
```typescript
// Use the database hook
import { useCustomersFromDatabase } from '../hooks/useCustomersFromDatabase'

function NewComponent() {
  const { customers, loading } = useCustomersFromDatabase()
  
  if (loading) return <Spinner />
  
  return (
    <div>
      {customers.map(customer => (
        <div key={customer.id}>{customer.name}</div>
      ))}
    </div>
  )
}
```

❌ **DON'T:**
```typescript
// Don't use localStorage for customer data
import { getJson, setJson } from '../platform/storage'

function OldComponent() {
  const [customers, setCustomers] = useState(() => {
    return getJson('odcrm_customers') || [] // ❌ NO!
  })
  
  // This creates stale data problems
}
```

### For Existing Components (Refactoring)

**Step 1:** Import the database hook
```typescript
import { useCustomersFromDatabase } from '../hooks/useCustomersFromDatabase'
```

**Step 2:** Replace localStorage loading with hook
```typescript
// OLD:
const [accounts, setAccounts] = useState(() => loadAccountsFromStorage())

// NEW:
const { customers, loading, updateCustomer } = useCustomersFromDatabase()
const accounts = databaseCustomersToAccounts(customers)
```

**Step 3:** Replace localStorage saves with API calls
```typescript
// OLD:
function saveAccount(account: Account) {
  const allAccounts = [...accounts, account]
  setJson('odcrm_accounts', allAccounts)
}

// NEW:
async function saveAccount(account: Account) {
  const dbData = accountToDatabaseCustomer(account)
  if (account._databaseId) {
    await updateCustomer(account._databaseId, dbData)
  } else {
    await createCustomer(dbData)
  }
  // Hook automatically refetches - UI updates automatically
}
```

---

## 🚫 What NOT to Store in localStorage

### ❌ Critical Data (Use Database)
- Customer/Account records
- Contacts
- Campaigns
- Sequences
- Leads/reporting data
- Any business-critical information

### ✅ Acceptable for localStorage
- UI preferences (theme, layout)
- Draft forms (before submission)
- Temporary filters/search state
- User settings (per-browser)
- Feature flags (per-session)

---

## 🔍 Debugging Data Issues

### Problem: "I don't see my data in production"

**Check:**
1. ✅ Is it in the database? Use Prisma Studio: `cd server && npm run prisma:studio`
2. ✅ Does the API return it? Check: `GET https://odcrm.bidlow.co.uk/api/customers`
3. ✅ Is the frontend code deployed? Check GitHub Actions
4. ✅ Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### Problem: "Data is different between localhost and production"

**This should NOT happen anymore with database-first architecture.**

If it does:
1. Both should use same Azure PostgreSQL database
2. Check `DATABASE_URL` in both environments
3. Verify no localStorage fallbacks in code

---

## 📈 Benefits of This Architecture

1. **✅ No Stale Data** - Always fresh from database
2. **✅ Multi-Device** - Same data everywhere
3. **✅ Team Collaboration** - Everyone sees same data
4. **✅ Backup/Recovery** - Azure handles backups
5. **✅ Audit Trail** - Database tracks all changes
6. **✅ Scalable** - Add more users/devices easily
7. **✅ No Browser Issues** - Not affected by cache clearing
8. **✅ Real-time Updates** - Changes reflect immediately

---

## 🎯 Rules for All Developers

1. **NEVER** use localStorage for customer/business data
2. **ALWAYS** use the database as source of truth
3. **ALWAYS** use `useCustomersFromDatabase` hook for customer data
4. **NEVER** mix localStorage and database for same data
5. **ALWAYS** test changes in both localhost AND production
6. **ALWAYS** verify data in Prisma Studio after changes

---

## 📞 Need Help?

- Database issues: Check `server/prisma/schema.prisma`
- API issues: Check `server/src/routes/customers.ts`
- Frontend issues: Check `src/hooks/useCustomersFromDatabase.ts`
- Architecture questions: Read this file!

---

**Remember: Database first, always. No shortcuts. No quick fixes. Do it right.**
