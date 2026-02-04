const { PrismaClient } = require('@prisma/client');

// Check ORIGINAL production database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require'
    }
  }
});

(async () => {
  try {
    console.log('🔍 Checking ORIGINAL PRODUCTION database...\n');
    
    const customersResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM customers`;
    const contactsResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM customer_contacts`;
    const leadsResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM lead_records`;
    
    const customers = Number(customersResult[0].count);
    const contacts = Number(contactsResult[0].count);
    const leads = Number(leadsResult[0].count);
    
    console.log('📊 CURRENT PRODUCTION DATABASE:');
    console.log('  Customers:', customers);
    console.log('  Contacts:', contacts);
    console.log('  Leads:', leads);
    
    if (contacts > 0) {
      console.log('\n✅ CONTACTS ARE HERE!');
      const sample = await prisma.$queryRaw`
        SELECT c.name as customer, cc.email, cc.phone, cc."firstName", cc."lastName"
        FROM customer_contacts cc
        JOIN customers c ON c.id = cc."customerId"
        LIMIT 5
      `;
      console.log('\nSample contacts:');
      sample.forEach(c => {
        console.log(`  ${c.firstName} ${c.lastName} (${c.customer}) - ${c.email}`);
      });
    } else {
      console.log('\n❌ NO CONTACTS - Something is wrong!');
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
