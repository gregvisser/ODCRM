// ================================================
// RUN THIS AT http://localhost:5173
// ================================================
// 1. Visit http://localhost:5173
// 2. Press F12 (Console)
// 3. Copy this ENTIRE file
// 4. Paste and press Enter
// 5. Copy the output and send to me
// ================================================

console.log('📦 Exporting data...\n');

const data = {
  accounts: localStorage.getItem('odcrm_accounts'),
  contacts: localStorage.getItem('odcrm_contacts'),
  leads: localStorage.getItem('odcrm_leads'),
  accountsLastUpdated: localStorage.getItem('odcrm_accounts_last_updated'),
  leadsLastRefresh: localStorage.getItem('odcrm_leads_last_refresh'),
  sectors: localStorage.getItem('odcrm_sectors'),
  emailTemplates: localStorage.getItem('odcrm_email_templates'),
  currentCustomerId: localStorage.getItem('currentCustomerId'),
  deletedAccounts: localStorage.getItem('odcrm_deleted_accounts'),
  deletedContacts: localStorage.getItem('odcrm_deleted_contacts')
};

// Show summary
const accountsCount = data.accounts ? JSON.parse(data.accounts).length : 0;
const leadsCount = data.leads ? JSON.parse(data.leads).length : 0;
const contactsCount = data.contacts ? JSON.parse(data.contacts).length : 0;

console.log('✅ Data Summary:');
console.log(`   Accounts: ${accountsCount}`);
console.log(`   Leads: ${leadsCount}`);
console.log(`   Contacts: ${contactsCount}`);
console.log('\n📋 COPY THE OUTPUT BELOW AND SEND TO ME:\n');
console.log('========== START COPYING HERE ==========');
console.log(JSON.stringify(data, null, 2));
console.log('========== STOP COPYING HERE ==========');
console.log('\nAfter copying, send me the JSON data and I\'ll create the import script!');
