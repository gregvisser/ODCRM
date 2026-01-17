// ================================================
// EXPORT DATA FROM LOCALHOST
// ================================================
// INSTRUCTIONS:
// 1. Visit http://localhost:5173
// 2. Press F12 to open console
// 3. Copy this ENTIRE file
// 4. Paste into console and press Enter
// 5. A file will download automatically
// ================================================

console.log('📦 Exporting ODCRM data from localhost...');

const exportData = {
  accounts: localStorage.getItem('odcrm_accounts'),
  contacts: localStorage.getItem('odcrm_contacts'),
  leads: localStorage.getItem('odcrm_leads'),
  accountsLastUpdated: localStorage.getItem('odcrm_accounts_last_updated'),
  leadsLastRefresh: localStorage.getItem('odcrm_leads_last_refresh'),
  sectors: localStorage.getItem('odcrm_sectors'),
  emailTemplates: localStorage.getItem('odcrm_email_templates'),
  currentCustomerId: localStorage.getItem('currentCustomerId')
};

// Count items
const accountsCount = exportData.accounts ? JSON.parse(exportData.accounts).length : 0;
const leadsCount = exportData.leads ? JSON.parse(exportData.leads).length : 0;
const contactsCount = exportData.contacts ? JSON.parse(exportData.contacts).length : 0;

console.log('✅ Found data:');
console.log(`   Accounts: ${accountsCount}`);
console.log(`   Leads: ${leadsCount}`);
console.log(`   Contacts: ${contactsCount}`);

// Create download
const json = JSON.stringify(exportData, null, 2);
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'odcrm-data-backup-' + new Date().toISOString().split('T')[0] + '.json';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);

console.log('✅ Download started!');
console.log('📁 File: odcrm-data-backup-' + new Date().toISOString().split('T')[0] + '.json');
console.log('');
console.log('⏭️  NEXT STEP:');
console.log('1. Save the downloaded file');
console.log('2. Open the file in a text editor');
console.log('3. Copy ALL the contents');
console.log('4. Use IMPORT_DATA_SCRIPT.js at https://odcrm.vercel.app');
