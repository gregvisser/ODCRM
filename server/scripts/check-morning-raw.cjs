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
    console.log('🔍 Checking MORNING RESTORE with raw SQL...\n');
    
    // Use raw SQL queries
    const customerResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Customer"`;
    const contactResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "CustomerContact"`;
    const leadResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Lead"`;
    
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
      FROM "Customer" 
      GROUP BY name 
      HAVING COUNT(*) > 1
    `;
    
    console.log('  Duplicates:', dupeResult.length);
    
    if (dupeResult.length > 0) {
      console.log('\n❌ Found duplicates:');
      dupeResult.forEach(d => {
        console.log(`    ${d.name}: ${d.count} copies`);
      });
    } else {
      console.log('  ✅ No duplicates!');
    }
    
    // Show sample data
    const sampleResult = await prisma.$queryRaw`
      SELECT name, "monthlyIntakeGBP", defcon, "leadsReportingUrl"
      FROM "Customer"
      ORDER BY name
      LIMIT 5
    `;
    
    console.log('\n📋 Sample customers:');
    sampleResult.forEach(c => {
      console.log(`  ${c.name}:`);
      console.log(`    Revenue: £${c.monthlyIntakeGBP || 0}`);
      console.log(`    DEFCON: ${c.defcon || 'none'}`);
      console.log(`    Google Sheets: ${c.leadsReportingUrl ? 'YES' : 'NO'}`);
    });
    
    await prisma.$disconnect();
    
    console.log('\n='.repeat(80));
    if (totalContacts > 0 && totalLeads > 0 && dupeResult.length === 0) {
      console.log('✅ ✅ ✅ THIS DATABASE LOOKS GOOD! ✅ ✅ ✅');
      console.log('Has contacts, has leads, no duplicates!');
    } else if (dupeResult.length === 0 && totalCustomers === 14) {
      console.log('⚠️  Database has 14 customers, no duplicates, but missing contacts/leads');
    } else {
      console.log('❌ This database has issues (duplicates or wrong customer count)');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
