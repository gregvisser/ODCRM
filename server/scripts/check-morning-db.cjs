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
    console.log('🔍 Checking MORNING RESTORE (09:00 AM UTC)...\n');
    
    const totalCustomers = await prisma.customer.count();
    const totalContacts = await prisma.customerContact.count();
    const totalLeads = await prisma.lead.count();
    
    console.log('📊 DATABASE TOTALS:');
    console.log('  Customers:', totalCustomers);
    console.log('  Contacts:', totalContacts);
    console.log('  Leads:', totalLeads);
    console.log('');
    
    // Check for duplicates
    const customers = await prisma.customer.groupBy({
      by: ['name'],
      _count: { name: true }
    });
    
    const dupes = customers.filter(c => c._count.name > 1);
    console.log('  Unique customer names:', customers.length);
    console.log('  Duplicates:', dupes.length);
    
    if (dupes.length > 0) {
      console.log('\n❌ Found duplicates:');
      dupes.forEach(d => {
        console.log(`    ${d.name}: ${d._count.name} copies`);
      });
    } else {
      console.log('  ✅ No duplicates!');
    }
    
    // Show sample data
    const sampleCustomers = await prisma.customer.findMany({
      take: 5,
      select: {
        name: true,
        monthlyIntakeGBP: true,
        defcon: true,
        leadsReportingUrl: true
      },
      orderBy: { name: 'asc' }
    });
    
    console.log('\n📋 Sample customers:');
    sampleCustomers.forEach(c => {
      console.log(`  ${c.name}:`);
      console.log(`    Revenue: £${c.monthlyIntakeGBP || 0}`);
      console.log(`    DEFCON: ${c.defcon || 'none'}`);
      console.log(`    Google Sheets: ${c.leadsReportingUrl ? 'YES' : 'NO'}`);
    });
    
    await prisma.$disconnect();
    
    if (totalContacts > 0 && totalLeads > 0 && dupes.length === 0) {
      console.log('\n✅ This database looks GOOD!');
      process.exit(0);
    } else {
      console.log('\n⚠️  This database may have issues');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
