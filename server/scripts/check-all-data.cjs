const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🔍 COMPLETE DATABASE AUDIT\n');
    
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        monthlyIntakeGBP: true,
        defcon: true,
        leadsReportingUrl: true,
        createdAt: true,
        _count: {
          select: {
            contacts: true,
            leadRecords: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    console.log('📊 CUSTOMERS (Total:', customers.length, ')');
    console.log('='.repeat(80));
    
    customers.forEach(c => {
      console.log(`\n${c.name}:`);
      console.log(`  ID: ${c.id}`);
      console.log(`  Revenue: £${c.monthlyIntakeGBP || 0}`);
      console.log(`  DEFCON: ${c.defcon || 'none'}`);
      console.log(`  Google Sheets URL: ${c.leadsReportingUrl || 'none'}`);
      console.log(`  Contacts: ${c._count.contacts}`);
      console.log(`  Leads: ${c._count.leadRecords}`);
      console.log(`  Created: ${c.createdAt}`);
    });
    
    const totalContacts = await prisma.customerContact.count();
    const totalLeads = await prisma.lead.count();
    
    console.log('\n' + '='.repeat(80));
    console.log('📈 TOTALS:');
    console.log('  Customers:', customers.length);
    console.log('  Contacts:', totalContacts);
    console.log('  Leads:', totalLeads);
    
    const withRevenue = customers.filter(c => c.monthlyIntakeGBP > 0);
    const withDefcon = customers.filter(c => c.defcon);
    const withGoogleSheets = customers.filter(c => c.leadsReportingUrl);
    const withContacts = customers.filter(c => c._count.contacts > 0);
    const withLeads = customers.filter(c => c._count.leadRecords > 0);
    
    console.log('\n📋 DATA COMPLETENESS:');
    console.log(`  With Revenue: ${withRevenue.length}/${customers.length}`);
    console.log(`  With DEFCON: ${withDefcon.length}/${customers.length}`);
    console.log(`  With Google Sheets: ${withGoogleSheets.length}/${customers.length}`);
    console.log(`  With Contacts: ${withContacts.length}/${customers.length}`);
    console.log(`  With Leads: ${withLeads.length}/${customers.length}`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('ERROR:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
