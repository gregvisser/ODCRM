# Data Transfer - Simplified Instructions

## Your Data is Safe!

It's in localStorage at localhost. We just need to copy it to production.

---

## SIMPLE METHOD (5 Minutes)

### Step 1: Export (at localhost)

1. **Visit**: http://localhost:5173 (should be open now)
2. **Press F12** (open console)
3. **Copy the entire file**: `EXPORT_DATA_SCRIPT.js`
4. **Paste into console** and press Enter
5. **File downloads automatically**

### Step 2: Prepare Import Script

1. **Open the downloaded JSON file** in Notepad
2. **Copy ALL the contents** (Ctrl+A, Ctrl+C)
3. **Open file**: `IMPORT_DATA_SCRIPT.js`
4. **Find the line**: `const importedData = {`
5. **Replace** `{}` with the copied JSON data
6. **Save** the file

### Step 3: Import (at production)

1. **Visit**: https://odcrm.vercel.app
2. **Press F12** (open console)
3. **Copy the modified** `IMPORT_DATA_SCRIPT.js` file
4. **Paste into console** and press Enter
5. **Page reloads** - data is restored!

---

## Even Simpler: Manual Copy/Paste

### At http://localhost:5173 console:

```javascript
copy(JSON.stringify({
  accounts: localStorage.getItem('odcrm_accounts'),
  contacts: localStorage.getItem('odcrm_contacts'),
  leads: localStorage.getItem('odcrm_leads'),
  accountsLastUpdated: localStorage.getItem('odcrm_accounts_last_updated'),
  leadsLastRefresh: localStorage.getItem('odcrm_leads_last_refresh')
}))
```

This copies data to clipboard.

### At https://odcrm.vercel.app console:

```javascript
const data = /* paste clipboard here */;
for (const [key, value] of Object.entries(data)) {
  if (value) localStorage.setItem(key, value);
}
location.reload();
```

---

## FILES TO USE

- **EXPORT_DATA_SCRIPT.js** - Run at localhost
- **IMPORT_DATA_SCRIPT.js** - Edit and run at production

**Both files are in your project root!**

---

**Start with**: Visit http://localhost:5173 and use EXPORT_DATA_SCRIPT.js
