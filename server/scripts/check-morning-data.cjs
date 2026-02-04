const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres-morning.postgres.database.azure.com/postgres?sslmode=require'
    }
  }
});

(async () => {
  try {
    console.log('🔍 Checking MORNING RESTORE DATA...\n');
    
    // Use correct lowercase table names
    const customerResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM customers`;
    const contactResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM customer_contacts`;
    const leadResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM lead_records`;
    
    const totalCustomers = Number(customerResult[0].count);
    const totalContacts = Number(contactResult[0].count);
    const totalLeads = Number(leadResult[0].count);
    
    console.log('📊 DATABASE TOTALS:');
    console.log('  Customers:', totalCustomers);
    console.log('  Contacts:', totalContacts);
    console.log('  Leads:', totalLeads);
    console.log('');
    
    // Check for duplicates
    const dupeResult = await prisma.$queryRaw`
      SELECT name, COUNT(*) as count 
      FROM customers 
      GROUP BY name 
      HAVING COUNT(*) > 1
    `;
    
    console.log('  Duplicates:', dupeResult.length);
    
    if (dupeResult.length > 0) {
      console.log('\n❌ Found duplicates:');
      dupeResult.forEach(d => {
        console.log(`    ${d.name}: ${Number(d.count)} copies`);
      });
    } else {
      console.log('  ✅ No duplicates!');
    }
    
    // Show sample data with Google Sheets URLs
    const sampleResult = await prisma.$queryRaw`
      SELECT name, monthly_intake_gbp, defcon, leads_reporting_url
      FROM customers
      WHERE leads_reporting_url IS NOT NULL
      ORDER BY name
      LIMIT 10
    `;
    
    console.log('\n📋 Customers WITH Google Sheets URLs:');
    if (sampleResult.length > 0) {
      sampleResult.forEach(c => {
        console.log(`  ${c.name}:`);
        console.log(`    Revenue: £${c.monthly_intake_gbp || 0}`);
        console.log(`    DEFCON: ${c.defcon || 'none'}`);
        console.log(`    Sheets: ${c.leads_reporting_url.substring(0, 60)}...`);
      });
    } else {
      console.log('  (None found)');
    }
    
    await prisma.$disconnect();
    
    console.log('\n' + '='.repeat(80));
    if (totalContacts > 0 && totalLeads > 0 && dupeResult.length === 0) {
      console.log('✅ ✅ ✅ THIS IS THE CORRECT DATABASE! ✅ ✅ ✅');
      console.log(`Has ${totalCustomers} customers, ${totalContacts} contacts, ${totalLeads} leads, NO duplicates!`);
      console.log('Ready to switch production to this database.');
    } else if (dupeResult.length === 0 && totalCustomers === 14) {
      console.log('⚠️  Database has 14 customers, no duplicates, but missing contacts/leads');
    } else {
      console.log('❌ This database has issues');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
