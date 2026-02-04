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
    console.log('🔍 Checking RESTORED database...\n');
    
    const count = await prisma.customer.count();
    console.log('Total customers in RESTORED DB:', count);
    
    if (count > 0) {
      const customers = await prisma.customer.findMany({
        take: 15,
        select: {
          id: true,
          name: true,
          monthlyIntakeGBP: true,
          defcon: true,
          createdAt: true
        },
        orderBy: { name: 'asc' }
      });
      
      console.log('\n📋 Customers with data:');
      customers.forEach(c => {
        const hasData = c.monthlyIntakeGBP || c.defcon;
        if (hasData) {
          console.log(`  ${c.name}:`);
          console.log(`    Revenue: £${c.monthlyIntakeGBP || 0}`);
          console.log(`    DEFCON: ${c.defcon || 'none'}`);
          console.log(`    Created: ${c.createdAt}`);
        }
      });
    }
    
    const contacts = await prisma.customerContact.count();
    const leads = await prisma.lead.count();
    console.log('\n📊 Summary:');
    console.log('  Customers:', count);
    console.log('  Contacts:', contacts);
    console.log('  Leads:', leads);
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
