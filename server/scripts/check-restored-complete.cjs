const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres-restored.postgres.database.azure.com/postgres?sslmode=require'
    }
  }
});

(async () => {
  try {
    console.log('🔍 Checking RESTORED database (odcrm-postgres-restored)...\n');
    
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        monthlyIntakeGBP: true,
        defcon: true,
        leadsReportingUrl: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });
    
    console.log('📊 CUSTOMERS (Total:', customers.length, ')');
    console.log('='.repeat(80));
    
    customers.slice(0, 5).forEach(c => {
      console.log(`\n${c.name}:`);
      console.log(`  Revenue: £${c.monthlyIntakeGBP || 0}`);
      console.log(`  DEFCON: ${c.defcon || 'none'}`);
      console.log(`  Google Sheets: ${c.leadsReportingUrl || 'none'}`);
    });
    
    const totalContacts = await prisma.customerContact.count();
    const totalLeads = await prisma.lead.count();
    
    console.log('\n' + '='.repeat(80));
    console.log('📈 CRITICAL TOTALS:');
    console.log('  Customers:', customers.length);
    console.log('  Contacts:', totalContacts);
    console.log('  Leads:', totalLeads);
    
    const withGoogleSheets = customers.filter(c => c.leadsReportingUrl);
    console.log(`  With Google Sheets URLs: ${withGoogleSheets.length}`);
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
