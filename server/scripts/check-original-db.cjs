const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🔍 Checking ORIGINAL database (odcrm-postgres)...\n');
    
    const total = await prisma.customer.count();
    console.log('Total customers:', total);
    
    // Group by name to find duplicates
    const customers = await prisma.customer.groupBy({
      by: ['name'],
      _count: { name: true }
    });
    
    const unique = customers.length;
    const dupes = customers.filter(c => c._count.name > 1);
    
    console.log('Unique names:', unique);
    console.log('Duplicates:', dupes.length);
    console.log('');
    
    if (dupes.length > 0) {
      console.log('❌ Duplicate customer names:');
      dupes.forEach(d => {
        console.log(`  ${d.name}: ${d._count.name} copies`);
      });
      console.log('');
    }
    
    // Show customers with actual business data
    const allCustomers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        monthlyIntakeGBP: true,
        defcon: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });
    
    const withData = allCustomers.filter(c => c.monthlyIntakeGBP || c.defcon);
    console.log('📋 Customers with revenue/defcon data:', withData.length);
    withData.forEach(c => {
      console.log(`  ${c.name}: £${c.monthlyIntakeGBP || 0}, DEFCON ${c.defcon || 'none'}`);
    });
    
    const contacts = await prisma.customerContact.count();
    const leads = await prisma.lead.count();
    console.log('\n📊 Summary:');
    console.log('  Total customers:', total);
    console.log('  Unique names:', unique);
    console.log('  With business data:', withData.length);
    console.log('  Contacts:', contacts);
    console.log('  Leads:', leads);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('ERROR:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
