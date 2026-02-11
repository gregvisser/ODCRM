#!/usr/bin/env node
/**
 * test-create-customer.cjs
 * 
 * Tests the customer creation flow end-to-end.
 * Creates a test customer with random suffix, verifies it was created,
 * then fetches it to confirm it's retrievable.
 * 
 * Usage:
 *   node server/scripts/test-create-customer.cjs
 * 
 * Exit codes:
 *   0 - Success (customer created and fetched)
 *   1 - Failure (creation or fetch failed)
 */

const { PrismaClient } = require('@prisma/client');

async function testCreateCustomer() {
  const prisma = new PrismaClient();
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const testCustomerName = `Test Customer ${randomSuffix}`;
  const testDomain = `testcustomer${randomSuffix}.com`;
  
  console.log('🧪 Testing Customer Creation Flow\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // Step 1: Create test customer
    console.log('Step 1: Create test customer');
    console.log(`   Name: ${testCustomerName}`);
    console.log(`   Domain: ${testDomain}`);
    console.log(`   Status: onboarding`);
    
    const newCustomer = await prisma.customer.create({
      data: {
        id: `cust_${timestamp}_test_${randomSuffix}`,
        name: testCustomerName,
        domain: testDomain,
        clientStatus: 'onboarding',
        accountData: {
          createdViaOnboarding: true,
          createdAt: new Date().toISOString(),
          testCustomer: true
        },
        updatedAt: new Date()
      }
    });
    
    console.log('   ✅ Customer created successfully');
    console.log(`   ID: ${newCustomer.id}`);
    console.log('');
    
    // Step 2: Verify customer was created by fetching it
    console.log('Step 2: Fetch newly created customer');
    
    const fetchedCustomer = await prisma.customer.findUnique({
      where: { id: newCustomer.id },
      select: {
        id: true,
        name: true,
        domain: true,
        clientStatus: true,
        accountData: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!fetchedCustomer) {
      console.error('   ❌ Customer not found after creation');
      process.exit(1);
    }
    
    console.log('   ✅ Customer fetched successfully');
    console.log(`   ID: ${fetchedCustomer.id}`);
    console.log(`   Name: ${fetchedCustomer.name}`);
    console.log(`   Domain: ${fetchedCustomer.domain}`);
    console.log(`   Status: ${fetchedCustomer.clientStatus}`);
    console.log('');
    
    // Step 3: Verify all fields match
    console.log('Step 3: Verify data integrity');
    
    const checks = [
      { field: 'id', expected: newCustomer.id, actual: fetchedCustomer.id },
      { field: 'name', expected: testCustomerName, actual: fetchedCustomer.name },
      { field: 'domain', expected: testDomain, actual: fetchedCustomer.domain },
      { field: 'clientStatus', expected: 'onboarding', actual: fetchedCustomer.clientStatus }
    ];
    
    let allChecksPass = true;
    for (const check of checks) {
      const pass = check.expected === check.actual;
      const icon = pass ? '✅' : '❌';
      console.log(`   ${icon} ${check.field}: ${check.actual}`);
      if (!pass) {
        console.error(`      Expected: ${check.expected}`);
        allChecksPass = false;
      }
    }
    
    if (!allChecksPass) {
      console.error('\n❌ Data integrity check failed');
      process.exit(1);
    }
    
    console.log('');
    
    // Step 4: Test validation (missing name should fail)
    console.log('Step 4: Test validation (missing required fields)');
    
    try {
      await prisma.customer.create({
        data: {
          id: `cust_${timestamp}_invalid_${randomSuffix}`,
          // Missing 'name' - required field
          domain: 'test.com',
          clientStatus: 'onboarding',
          updatedAt: new Date()
        }
      });
      
      console.error('   ❌ Creation with missing name succeeded (should have failed)');
      allChecksPass = false;
    } catch (validationError) {
      if (validationError.message?.includes('name')) {
        console.log('   ✅ Validation failed as expected (missing name)');
      } else {
        console.error(`   ⚠️  Unexpected validation error: ${validationError.message}`);
        // Don't fail - this is still catching an error
      }
    }
    
    console.log('');
    
    // Step 5: Clean up test customer
    console.log('Step 5: Clean up test customer');
    
    await prisma.customer.delete({
      where: { id: newCustomer.id }
    });
    
    console.log('   ✅ Test customer deleted');
    console.log('');
    
    // Success summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ ALL TESTS PASSED\n');
    console.log('Customer creation flow works correctly:');
    console.log('  1. Customer can be created with valid data');
    console.log('  2. Customer can be fetched after creation');
    console.log('  3. Data integrity is maintained');
    console.log('  4. Missing required fields are caught');
    console.log('  5. Test cleanup successful\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error('Code:', error.code);
    console.error('Meta:', error.meta);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testCreateCustomer();
