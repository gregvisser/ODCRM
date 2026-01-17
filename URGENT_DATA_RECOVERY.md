# URGENT: Restore Your 73 Leads and All Data

## THE ISSUE (Critical Understanding)

Your data is **NOT lost** - it's in localStorage at localhost:5173.

Production (odcrm.vercel.app) is a different domain = different localStorage = empty data.

**This is normal** - localStorage doesn't transfer between domains.

---

## THE FIX (10 Minutes)

### PART 1: Export from Localhost (5 min)

1. **Local server is running** at: http://localhost:5173

2. **Visit**: http://localhost:5173

3. **Look for Export button**:
   - Bottom of left sidebar
   - OR: Scroll to bottom of any page
   - Button says: **"Export ODCRM Data"**

4. **Click "Export ODCRM Data"**
   - Downloads: `odcrm-snapshot-YYYY-MM-DD.json`
   - Contains ALL your data (73 leads, accounts, Google Sheets links)

5. **Save the file** somewhere safe

---

### PART 2: Import to Production (2 min)

1. **Visit**: https://odcrm.vercel.app

2. **Look for Import button**:
   - Same location as Export
   - Button says: **"Import ODCRM Data"**

3. **Click "Import ODCRM Data"**

4. **Select the JSON file** you just exported

5. **Click OK** when prompted to replace data

6. **Page refreshes** - your data is restored!

---

### PART 3: Fix OAuth (3 min)

The OAuth localhost issue will be fixed once Vercel deploys commit 0bba4c8.

**Check Vercel Deployments**:
- Latest should be commit **0bba4c8** or **f4ace81**
- Status should be "Ready"

**If not Ready yet**: Wait for deployment to complete

**If Ready**: 
1. Hard refresh odcrm.vercel.app (Ctrl+Shift+R)
2. Try OAuth again - should work!

---

## WHERE TO FIND EXPORT/IMPORT BUTTONS

The DataPortability component shows at the bottom of pages.

**If you can't find it**:
1. Go to http://localhost:5173
2. Press F12 (console)
3. Run this to export:
   ```javascript
   const data = {
     accounts: localStorage.getItem('odcrm_accounts'),
     contacts: localStorage.getItem('odcrm_contacts'),
     leads: localStorage.getItem('odcrm_leads'),
     accountsLastUpdated: localStorage.getItem('odcrm_accounts_last_updated'),
     leadsLastRefresh: localStorage.getItem('odcrm_leads_last_refresh'),
     sectors: localStorage.getItem('odcrm_sectors')
   };
   
   const json = JSON.stringify(data, null, 2);
   const blob = new Blob([json], { type: 'application/json' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = 'odcrm-backup.json';
   a.click();
   console.log('✅ Downloaded backup!');
   ```

Then at https://odcrm.vercel.app, run:
```javascript
// First, upload the JSON file content, then:
const importedData = /* paste the JSON content here */;

for (const [key, value] of Object.entries(importedData)) {
  if (value) localStorage.setItem(key, value);
}

console.log('✅ Data imported!');
location.reload();
```

---

## SUMMARY

1. ✅ Local server running at http://localhost:5173
2. ⏳ Export data from localhost
3. ⏳ Import data to odcrm.vercel.app
4. ⏳ Wait for Vercel deployment (0bba4c8)
5. ⏳ Test OAuth

**Your data is safe** - just needs to be transferred between domains!

---

**Next**: Visit http://localhost:5173 and export your data!
