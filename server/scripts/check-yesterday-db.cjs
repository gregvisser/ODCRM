const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres-yesterday.postgres.database.azure.com/postgres?sslmode=require'
    }
  }
});

(async () => {
  try {
    console.log('🔍 Checking YESTERDAY database...\n');
    
    const totalCustomers = await prisma.$queryRaw`SELECT COUNT(*) as count FROM customers`;
    const totalContacts = await prisma.$queryRaw`SELECT COUNT(*) as count FROM customer_contacts`;
    const totalLeads = await prisma.$queryRaw`SELECT COUNT(*) as count FROM lead_records`;
    
    const customers = Number(totalCustomers[0].count);
    const contacts = Number(totalContacts[0].count);
    const leads = Number(totalLeads[0].count);
    
    console.log('📊 DATABASE TOTALS:');
    console.log('  Customers:', customers);
    console.log('  Contacts:', contacts);
    console.log('  Leads:', leads);
    console.log('');
    
    // Check for duplicates
    const dupeResult = await prisma.$queryRaw`
      SELECT name, COUNT(*) as count 
      FROM customers 
      GROUP BY name 
      HAVING COUNT(*) > 1
    `;
    
    console.log('  Unique customer names:', customers - dupeResult.length);
    console.log('  Duplicates:', dupeResult.length);
    
    if (dupeResult.length > 0) {
      console.log('\n❌ Found duplicates:');
      dupeResult.slice(0, 10).forEach(d => {
        console.log(`    ${d.name}: ${Number(d.count)} copies`);
      });
      if (dupeResult.length > 10) {
        console.log(`    ... and ${dupeResult.length - 10} more`);
      }
    } else {
      console.log('  ✅ No duplicates!');
    }
    
    // Show sample with Google Sheets
    const sampleResult = await prisma.$queryRaw`
      SELECT name, "monthlyIntakeGBP", defcon, "leadsReportingUrl"
      FROM customers
      WHERE "leadsReportingUrl" IS NOT NULL
      ORDER BY name
      LIMIT 5
    `;
    
    console.log('\n📋 Sample customers WITH Google Sheets:');
    sampleResult.forEach(c => {
      console.log(`  ${c.name}: £${c.monthlyIntakeGBP || 0}, DEFCON ${c.defcon || 'none'}`);
    });
    
    await prisma.$disconnect();
    
    console.log('\n' + '='.repeat(80));
    if (contacts > 0 && leads > 0 && dupeResult.length === 0 && customers === 14) {
      console.log('✅ ✅ ✅ PERFECT DATABASE! ✅ ✅ ✅');
      console.log(`14 customers, ${contacts} contacts, ${leads} leads, NO duplicates!`);
    } else if (contacts > 0 && dupeResult.length === 0) {
      console.log('✅ GOOD DATABASE - Has contacts, no duplicates');
      console.log(`${customers} customers, ${contacts} contacts, ${leads} leads`);
    } else {
      console.log('⚠️ Database has issues:');
      if (dupeResult.length > 0) console.log(`  - ${dupeResult.length} duplicate names`);
      if (contacts === 0) console.log('  - No contacts');
      if (customers !== 14) console.log(`  - ${customers} customers (expected 14)`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
