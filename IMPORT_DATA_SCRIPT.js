// ================================================
// IMPORT DATA TO PRODUCTION
// ================================================
// INSTRUCTIONS:
// 1. Visit https://odcrm.vercel.app
// 2. Press F12 to open console
// 3. FIRST: Paste the exported JSON data below (replace the {} placeholder)
// 4. THEN: Copy this entire file and paste into console
// 5. Press Enter
// ================================================

// PASTE YOUR EXPORTED DATA HERE (between the curly braces):
const importedData = {
  // Replace this entire object with the contents from your exported JSON file
  // It should look like:
  // {
  //   "accounts": "[...]",
  //   "contacts": "[...]",
  //   "leads": "[...]",
  //   ...
  // }
};

// ================================================
// DO NOT MODIFY BELOW THIS LINE
// ================================================

console.log('📥 Importing ODCRM data to production...');

if (!importedData || Object.keys(importedData).length === 0) {
  console.error('❌ ERROR: No data to import!');
  console.error('');
  console.error('INSTRUCTIONS:');
  console.error('1. Open the exported JSON file in a text editor');
  console.error('2. Copy EVERYTHING from the file');
  console.error('3. Replace the "const importedData = {}" line above with:');
  console.error('   const importedData = <paste-your-data-here>');
  console.error('4. Then run this script again');
  throw new Error('No data provided');
}

let imported = 0;
let skipped = 0;

for (const [key, value] of Object.entries(importedData)) {
  if (value && value !== 'null') {
    try {
      localStorage.setItem(key, value);
      imported++;
      console.log(`✅ Imported: ${key}`);
    } catch (error) {
      console.warn(`⚠️  Skipped ${key}:`, error.message);
      skipped++;
    }
  } else {
    skipped++;
  }
}

console.log('');
console.log('✅ IMPORT COMPLETE!');
console.log(`   Imported: ${imported} items`);
console.log(`   Skipped: ${skipped} items`);

// Verify
const accountsCount = localStorage.getItem('odcrm_accounts') 
  ? JSON.parse(localStorage.getItem('odcrm_accounts')).length 
  : 0;
const leadsCount = localStorage.getItem('odcrm_leads') 
  ? JSON.parse(localStorage.getItem('odcrm_leads')).length 
  : 0;

console.log('');
console.log('📊 Verification:');
console.log(`   Accounts: ${accountsCount}`);
console.log(`   Leads: ${leadsCount}`);
console.log('');
console.log('🔄 Reloading page to apply changes...');

setTimeout(() => {
  location.reload();
}, 1000);
