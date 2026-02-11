#!/usr/bin/env node
/**
 * verify-columns.cjs
 * 
 * Verifies that required agreement columns exist in the database after migrations.
 * Used by GitHub Actions to fail deployment if schema is missing critical columns.
 * 
 * Exit codes:
 *   0 - All required columns exist
 *   1 - Required columns missing or verification failed
 */

const { PrismaClient, Prisma } = require('@prisma/client');

const REQUIRED_COLUMNS = [
  'agreementBlobName',
  'agreementContainerName',
  'agreementFileUrl'
];

async function verifyColumns() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Verifying agreement columns exist in database...');
    
    // Query information_schema for customers table columns (using Prisma.sql for safety)
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'customers'
        AND column_name IN (${Prisma.join(REQUIRED_COLUMNS)})
      ORDER BY column_name ASC
    `;
    
    console.log(`\nColumns found: ${result.length}`);
    console.table(result);
    
    // Check each required column
    const foundColumns = result.map(row => row.column_name);
    const missingColumns = REQUIRED_COLUMNS.filter(col => !foundColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.error('\n❌ ERROR: Required columns missing from customers table:');
      missingColumns.forEach(col => console.error(`   - ${col}`));
      console.error('\nMigrations may have failed to apply properly.');
      console.error('Check migration logs and run: npx prisma migrate status');
      process.exit(1);
    }
    
    console.log('\n✅ SUCCESS: All required agreement columns exist in customers table');
    console.log('   - agreementBlobName');
    console.log('   - agreementContainerName');
    console.log('   - agreementFileUrl');
    
  } catch (error) {
    console.error('\n❌ ERROR: Failed to verify columns');
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyColumns();
