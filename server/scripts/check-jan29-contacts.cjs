const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres-jan29.postgres.database.azure.com/postgres?sslmode=require'
    }
  }
});

(async () => {
  try {
    console.log('🔍 Checking JAN 29 database for contacts...\n');
    
    const contactsResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM customer_contacts`;
    const contactCount = Number(contactsResult[0].count);
    
    console.log('📊 Contacts found:', contactCount);
    
    if (contactCount > 0) {
      // Get sample contacts
      const sampleContacts = await prisma.$queryRaw`
        SELECT c.name, cc.email, cc.phone, cc.title, cc."firstName", cc."lastName"
        FROM customer_contacts cc
        JOIN customers c ON c.id = cc."customerId"
        LIMIT 10
      `;
      
      console.log('\n📋 Sample contacts:');
      sampleContacts.forEach(c => {
        console.log(`  ${c.firstName} ${c.lastName} (${c.name})`);
        console.log(`    Email: ${c.email || 'none'}`);
        console.log(`    Phone: ${c.phone || 'none'}`);
        console.log(`    Title: ${c.title || 'none'}`);
      });
      
      console.log('\n✅ ✅ ✅ JAN 29 HAS CONTACTS! ✅ ✅ ✅');
      console.log(`Found ${contactCount} contacts to copy!`);
    } else {
      console.log('❌ No contacts found in Jan 29 backup');
    }
    
    await prisma.$disconnect();
    process.exit(contactCount > 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
