#!/usr/bin/env node
/**
 * verify-columns.cjs
 * 
 * Verifies that required agreement columns exist in the database after migrations.
 * Used by GitHub Actions to fail deployment if schema is missing critical columns.
 * 
 * Checks BOTH "customers" (plural) and "customer" (singular) tables for backwards compatibility.
 * Passes if ALL required columns exist on EITHER table.
 * 
 * Exit codes:
 *   0 - All required columns exist on at least one table
 *   1 - Required columns missing from both tables or verification failed
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
    console.log('Checking both "customers" (preferred) and "customer" (legacy) tables\n');
    
    // Query both tables in a single query for efficiency
    const result = await prisma.$queryRaw`
      SELECT 
        table_name,
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('customers', 'customer')
        AND column_name IN (${Prisma.join(REQUIRED_COLUMNS)})
      ORDER BY table_name ASC, column_name ASC
    `;
    
    console.log(`Total columns found across both tables: ${result.length}`);
    console.table(result);
    
    // Group results by table
    const customersPluralColumns = result
      .filter(row => row.table_name === 'customers')
      .map(row => row.column_name);
    
    const customerSingularColumns = result
      .filter(row => row.table_name === 'customer')
      .map(row => row.column_name);
    
    // Check which columns are missing from each table
    const missingFromPlural = REQUIRED_COLUMNS.filter(col => !customersPluralColumns.includes(col));
    const missingFromSingular = REQUIRED_COLUMNS.filter(col => !customerSingularColumns.includes(col));
    
    console.log('\n📊 Analysis:');
    console.log(`"customers" table: ${customersPluralColumns.length}/${REQUIRED_COLUMNS.length} columns present`);
    if (missingFromPlural.length > 0) {
      console.log(`  Missing: ${missingFromPlural.join(', ')}`);
    } else {
      console.log('  ✅ All required columns present');
    }
    
    console.log(`"customer" table: ${customerSingularColumns.length}/${REQUIRED_COLUMNS.length} columns present`);
    if (customerSingularColumns.length === 0) {
      console.log('  ⚠️  Table does not exist or has no agreement columns (expected for new environments)');
    } else if (missingFromSingular.length > 0) {
      console.log(`  Missing: ${missingFromSingular.join(', ')}`);
    } else {
      console.log('  ✅ All required columns present');
    }
    
    // PASS if either table has all required columns
    const pluralComplete = missingFromPlural.length === 0 && customersPluralColumns.length > 0;
    const singularComplete = missingFromSingular.length === 0 && customerSingularColumns.length > 0;
    
    if (!pluralComplete && !singularComplete) {
      console.error('\n❌ VERIFICATION FAILED: Required columns missing from BOTH tables');
      console.error('\nNeither "customers" nor "customer" table has all required columns.');
      console.error('Migrations may have failed to apply properly.');
      console.error('\nRun: npx prisma migrate status');
      console.error('Or check migration logs above.');
      process.exit(1);
    }
    
    console.log('\n✅ VERIFICATION PASSED: All required agreement columns exist');
    if (pluralComplete) {
      console.log('   Table: "customers" (preferred)');
    }
    if (singularComplete) {
      console.log('   Table: "customer" (legacy)');
    }
    console.log('\n   Required columns:');
    REQUIRED_COLUMNS.forEach(col => console.log(`   - ${col}`));
    
  } catch (error) {
    console.error('\n❌ ERROR: Failed to verify columns');
    console.error('Error:', error.message);
    console.error('\nThis may indicate a database connection issue or permissions problem.');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyColumns();
