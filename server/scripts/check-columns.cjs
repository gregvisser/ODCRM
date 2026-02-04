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
    console.log('🔍 Checking columns in customers table...\n');
    
    const columnsResult = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customers'
      ORDER BY ordinal_position
    `;
    
    console.log('Columns in customers table:');
    columnsResult.forEach(c => {
      console.log(`  - ${c.column_name}`);
    });
    
    // Show sample data
    const sampleResult = await prisma.$queryRaw`
      SELECT *
      FROM customers
      LIMIT 3
    `;
    
    console.log('\n📋 Sample customer data:');
    sampleResult.forEach((c, i) => {
      console.log(`\nCustomer ${i+1}:`, JSON.stringify(c, null, 2));
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('ERROR:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
