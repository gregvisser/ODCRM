const { PrismaClient } = require('./server/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function checkTables() {
  try {
    // Check if tables exist by trying to query them
    let leadRecordsCount = 'Table does not exist';
    let leadSyncStatesCount = 'Table does not exist';

    try {
      leadRecordsCount = await prisma.leadRecord.count();
    } catch (e) {
      // Table doesn't exist
    }

    try {
      leadSyncStatesCount = await prisma.leadSyncState.count();
    } catch (e) {
      // Table doesn't exist
    }

    console.log('lead_records table:', leadRecordsCount);
    console.log('lead_sync_states table:', leadSyncStatesCount);

    // Check all tables in the database
    const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    console.log('All tables in database:', tables.map(t => t.tablename));

    await prisma.$disconnect();
  } catch (err) {
    console.error('Database check error:', err.message);
    await prisma.$disconnect();
  }
}

checkTables();