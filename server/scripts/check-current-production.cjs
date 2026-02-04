const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require'
    }
  }
});

(async () => {
  try {
    console.log('🔍 CHECKING CURRENT PRODUCTION DATABASE (odcrm-postgres)...\n');
    
    const totalCustomers = await prisma.$queryRaw`SELECT COUNT(*) as count FROM customers`;
    const totalContacts = await prisma.$queryRaw`SELECT COUNT(*) as count FROM customer_contacts`;
    const totalLeads = await prisma.$queryRaw`SELECT COUNT(*) as count FROM lead_records`;
    
    const customers = Number(totalCustomers[0].count);
    const contacts = Number(totalContacts[0].count);
    const leads = Number(totalLeads[0].count);
    
    console.log('📊 CURRENT PRODUCTION TOTALS:');
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
    
    console.log('  Duplicates:', dupeResult.length);
    
    if (dupeResult.length > 0) {
      console.log('\n❌ DUPLICATE CUSTOMERS:');
      dupeResult.slice(0, 20).forEach(d => {
        console.log(`    ${d.name}: ${Number(d.count)} copies`);
      });
    }
    
    // Show some contacts
    if (contacts > 0) {
      const sampleContacts = await prisma.$queryRaw`
        SELECT c.name, cc.email, cc.phone, cc."firstName", cc."lastName"
        FROM customer_contacts cc
        JOIN customers c ON c.id = cc."customerId"
        LIMIT 10
      `;
      
      console.log('\n📋 Sample contacts:');
      sampleContacts.forEach(c => {
        console.log(`  ${c.firstName} ${c.lastName} (${c.name}) - ${c.email || 'no email'}`);
      });
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
