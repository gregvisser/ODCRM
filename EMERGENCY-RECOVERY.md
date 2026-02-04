# 🚨 EMERGENCY: Recover Google Sheets URLs

## Step 1: Save Your Current Data (DO THIS FIRST!)

1. Open the production site: https://odcrm.bidlow.co.uk
2. Press **F12** to open Developer Tools
3. Click the **Console** tab
4. **Copy and paste this entire script** and press Enter:

```javascript
// EMERGENCY BACKUP - Save all data before it's lost
const backup = {
  timestamp: new Date().toISOString(),
  accounts: localStorage.getItem('odcrm:accounts'),
  leads: localStorage.getItem('odcrm:leads'),
  contacts: localStorage.getItem('odcrm:contacts'),
  allKeys: {}
};

// Backup ALL localStorage keys
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  backup.allKeys[key] = localStorage.getItem(key);
}

// Download backup file
const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `odcrm-emergency-backup-${Date.now()}.json`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);

console.log('✅ Backup file downloaded!');
console.log('📊 Backup contains:');
console.log('  - Accounts:', backup.accounts ? JSON.parse(backup.accounts).length : 0);
console.log('  - All localStorage keys:', Object.keys(backup.allKeys).length);
```

5. **A file will download** - SAVE THIS FILE! It contains all your Google Sheets URLs

## Step 2: Extract URLs from Backup

After you've downloaded the backup, send me the file or run this script to extract just the URLs:

```javascript
// Parse accounts from backup
const accountsJson = localStorage.getItem('odcrm:accounts');
if (accountsJson) {
  const accounts = JSON.parse(accountsJson);
  const accountsWithUrls = accounts.filter(a => a.clientLeadsSheetUrl);
  
  console.log('\n📋 ACCOUNTS WITH GOOGLE SHEETS URLS:\n');
  accountsWithUrls.forEach(a => {
    console.log(`${a.name}: ${a.clientLeadsSheetUrl}`);
  });
  
  console.log(`\nTotal: ${accountsWithUrls.length} accounts with URLs`);
} else {
  console.log('❌ No accounts found in localStorage');
}
```

## Step 3: What to Send Me

After running the scripts above, send me:
1. The downloaded backup JSON file (or just the accounts section)
2. The console output showing which accounts have URLs

Then I can restore them to the database!
