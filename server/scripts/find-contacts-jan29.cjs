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
    console.log('🔍 Looking for contacts data in ALL tables...\n');
    
    // Check all tables with "contact" in the name
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND LOWER(table_name) LIKE '%contact%'
      ORDER BY table_name
    `;
    
    console.log('📋 Tables with "contact" in name:');
    for (const table of tables) {
      const countResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ${prisma.$queryRawUnsafe(`"${table.table_name}"`)}`;
      const count = Number(countResult[0]?.count || 0);
      console.log(`  ${table.table_name}: ${count} rows`);
      
      if (count > 0 && count < 20) {
        // Show sample data for small tables
        const sample = await prisma.$queryRawUnsafe(`SELECT * FROM "${table.table_name}" LIMIT 3`);
        console.log('    Sample data:', JSON.stringify(sample[0], null, 2));
      }
    }
    
    // Also check the contacts table (not customer_contacts)
    console.log('\n📋 Checking "contacts" table:');
    const contactsCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM contacts`;
    console.log('  contacts:', Number(contactsCount[0].count), 'rows');
    
    if (Number(contactsCount[0].count) > 0) {
      const sampleContacts = await prisma.$queryRaw`SELECT * FROM contacts LIMIT 5`;
      console.log('\n  Sample from contacts table:');
      sampleContacts.forEach((c, i) => {
        console.log(`\n  Contact ${i+1}:`, JSON.stringify(c, null, 2));
      });
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
