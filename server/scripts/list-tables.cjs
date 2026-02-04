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
    console.log('🔍 Listing tables in MORNING RESTORE...\n');
    
    const result = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log('Tables found:', result.length);
    result.forEach(r => {
      console.log(`  - ${r.table_name}`);
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('ERROR:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
