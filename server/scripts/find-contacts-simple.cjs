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
    console.log('🔍 Checking contacts tables...\n');
    
    // Check customer_contacts
    const customerContactsCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM customer_contacts`;
    console.log('customer_contacts:', Number(customerContactsCount[0].count), 'rows');
    
    // Check contacts
    const contactsCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM contacts`;
    console.log('contacts:', Number(contactsCount[0].count), 'rows');
    
    // Check contact_list_members
    const contactListMembersCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM contact_list_members`;
    console.log('contact_list_members:', Number(contactListMembersCount[0].count), 'rows');
    
    // If contacts table has data, show some
    const contactsTotal = Number(contactsCount[0].count);
    if (contactsTotal > 0) {
      console.log('\n📋 Sample from "contacts" table:');
      const sample = await prisma.$queryRaw`SELECT * FROM contacts LIMIT 5`;
      sample.forEach((c, i) => {
        console.log(`\nContact ${i+1}:`);
        console.log(`  ID: ${c.id}`);
        console.log(`  Name: ${c.firstName || ''} ${c.lastName || ''}`);
        console.log(`  Email: ${c.email || 'none'}`);
        console.log(`  Phone: ${c.phone || 'none'}`);
        console.log(`  Title: ${c.title || 'none'}`);
      });
      
      console.log(`\n✅ Found ${contactsTotal} contacts in "contacts" table!`);
    } else {
      console.log('\n❌ No contacts found in any table');
    }
    
    await prisma.$disconnect();
    process.exit(contactsTotal > 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
