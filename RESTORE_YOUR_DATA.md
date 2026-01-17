# RESTORE YOUR DATA - Critical Steps

## The Problem

Your 73 leads, accounts, and all data are in localStorage at `localhost:5173`.  
The production site `odcrm.vercel.app` has a different localStorage (empty).

**localStorage is domain-specific** - data doesn't transfer between domains.

---

## The Solution: Export & Import

Your app has a built-in **Data Portability** feature!

### STEP 1: Export Data from Localhost

1. **Run local development server**:
   ```bash
   npm run dev
   ```

2. **Visit**: http://localhost:5173

3. **Find the Export button**:
   - Look at the bottom of the sidebar
   - Or check the Customers/Marketing tabs
   - Should see: **"Export ODCRM Data"** button

4. **Click "Export ODCRM Data"**
   - Downloads a JSON file with all your data
   - Contains: Accounts, Contacts, Leads, Settings

5. **Save the file** (e.g., `odcrm-snapshot-YYYY-MM-DD.json`)

---

### STEP 2: Import Data to Production

1. **Visit**: https://odcrm.vercel.app

2. **Find the Import button**:
   - Same location as Export
   - Should see: **"Import ODCRM Data"** button

3. **Click "Import ODCRM Data"**

4. **Select the JSON file** you exported in Step 1

5. **Confirm the import**:
   - Click **OK** to replace
   - Page will refresh

6. **Verify**:
   - Your 73 leads should appear
   - Accounts should be restored
   - Google Sheets links preserved

---

## Alternative: Manual Export from Console

If you can't find the Export button:

### At localhost:5173 (in console - F12):

```javascript
// Export all data
const snapshot = {
  accounts: localStorage.getItem('odcrm_accounts'),
  contacts: localStorage.getItem('odcrm_contacts'),
  leads: localStorage.getItem('odcrm_leads'),
  accountsLastUpdated: localStorage.getItem('odcrm_accounts_last_updated'),
  leadsLastRefresh: localStorage.getItem('odcrm_leads_last_refresh')
};

// Download as JSON
const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'odcrm-backup-' + new Date().toISOString().split('T')[0] + '.json';
a.click();
```

### At odcrm.vercel.app (in console - F12):

**After downloading the file above**, manually set each key:

```javascript
// You'll need to copy the contents from the downloaded JSON file
// and set each localStorage item manually, or use the Import button
```

---

## Fastest Method: Use the Built-in UI

The **Export/Import** buttons are the easiest way. Look for them in the app!

---

## After Import

Your data will be restored:
- ✅ 73 leads
- ✅ Accounts with Google Sheets links
- ✅ All settings

---

**Next**: Export from localhost, import to production!
