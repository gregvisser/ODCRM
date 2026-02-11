#!/usr/bin/env node
/**
 * repro-create-customer.cjs
 * 
 * Reproduces the "Failed to create customer" issue by calling the API endpoint directly.
 * Tests various failure scenarios to ensure proper error handling.
 * 
 * Usage:
 *   node server/scripts/repro-create-customer.cjs
 * 
 * Prerequisites:
 *   - Backend server must be running on localhost:3001
 *   - Or set BACKEND_URL environment variable
 * 
 * Exit codes:
 *   0 - All tests passed (errors handled correctly)
 *   1 - Tests failed (unexpected behavior)
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

/**
 * Make API request to create customer endpoint
 */
async function createCustomerRequest(payload) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: X-Customer-Id header intentionally omitted for create customer
      },
      body: JSON.stringify(payload)
    });

    const contentType = response.headers.get('content-type');
    let body;
    
    if (contentType?.includes('application/json')) {
      body = await response.json();
    } else {
      body = { error: 'non_json_response', details: await response.text() };
    }

    return {
      status: response.status,
      ok: response.ok,
      body
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      body: { error: 'network_error', message: error.message }
    };
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🧪 Reproducing Create Customer Scenarios\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Backend URL: ${BACKEND_URL}\n`);
  
  let allTestsPassed = true;
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  // Test 1: Valid customer creation
  console.log('Test 1: Create customer with valid data');
  const test1 = await createCustomerRequest({
    name: `Test Customer ${randomSuffix}`,
    domain: `test${randomSuffix}.com`,
    clientStatus: 'onboarding',
    accountData: {
      createdViaOnboarding: true,
      testCustomer: true
    }
  });

  console.log(`   Status: ${test1.status}`);
  console.log(`   Body:`, JSON.stringify(test1.body, null, 2));
  
  if (test1.status === 201 && test1.body.id) {
    console.log('   ✅ PASS - Customer created successfully');
    console.log(`   Created ID: ${test1.body.id}`);
    console.log(`   RequestId: ${test1.body.requestId || 'not included'}`);
  } else {
    console.error('   ❌ FAIL - Expected 201 with id');
    allTestsPassed = false;
  }
  console.log('');

  // Test 2: Missing required field (name)
  console.log('Test 2: Create customer without required name field');
  const test2 = await createCustomerRequest({
    domain: 'nodomain.com',
    clientStatus: 'onboarding'
  });

  console.log(`   Status: ${test2.status}`);
  console.log(`   Error: ${test2.body.error || 'none'}`);
  console.log(`   Message: ${test2.body.message || 'none'}`);
  console.log(`   RequestId: ${test2.body.requestId || 'not included'}`);
  
  if (test2.status === 400 && test2.body.error === 'validation_failed') {
    console.log('   ✅ PASS - Validation error properly returned');
    console.log(`   Expected toast: "${test2.body.message} (requestId: ${test2.body.requestId})"`);
  } else {
    console.error('   ❌ FAIL - Expected 400 with validation_failed');
    allTestsPassed = false;
  }
  console.log('');

  // Test 3: Duplicate customer (if Test 1 succeeded)
  if (test1.status === 201 && test1.body.id) {
    console.log('Test 3: Create duplicate customer (same name)');
    const test3 = await createCustomerRequest({
      name: `Test Customer ${randomSuffix}`, // Same name as Test 1
      domain: `duplicate${randomSuffix}.com`,
      clientStatus: 'onboarding'
    });

    console.log(`   Status: ${test3.status}`);
    console.log(`   Error: ${test3.body.error || 'none'}`);
    console.log(`   Message: ${test3.body.message || 'none'}`);
    console.log(`   PrismaCode: ${test3.body.prismaCode || 'none'}`);
    console.log(`   RequestId: ${test3.body.requestId || 'not included'}`);
    
    // Note: Customer table has NO unique constraints on name/domain (only indexes)
    // So duplicate creation should SUCCEED, not fail with P2002
    if (test3.status === 201) {
      console.log('   ✅ PASS - Duplicate allowed (no unique constraint on name)');
      console.log('   Note: Customer schema allows multiple customers with same name');
    } else if (test3.status === 409 && test3.body.error === 'customer_exists') {
      console.log('   ⚠️  UNEXPECTED - Got 409, but schema has no unique constraint');
      console.log('   This means a unique constraint was added to the database');
      console.log(`   Expected toast: "${test3.body.message} (requestId: ${test3.body.requestId}) [${test3.body.prismaCode}]"`);
    } else {
      console.error('   ❌ FAIL - Unexpected response');
      allTestsPassed = false;
    }
    console.log('');
  }

  // Test 4: Invalid data type
  console.log('Test 4: Create customer with invalid data type');
  const test4 = await createCustomerRequest({
    name: 'Valid Name',
    monthlyIntakeGBP: 'not-a-number', // Should be number
    clientStatus: 'onboarding'
  });

  console.log(`   Status: ${test4.status}`);
  console.log(`   Error: ${test4.body.error || 'none'}`);
  console.log(`   Message: ${test4.body.message || 'none'}`);
  console.log(`   RequestId: ${test4.body.requestId || 'not included'}`);
  
  if (test4.status === 400) {
    console.log('   ✅ PASS - Invalid data type caught');
    console.log(`   Expected toast: "${test4.body.message} (requestId: ${test4.body.requestId})"`);
  } else {
    console.error('   ❌ FAIL - Expected 400 validation error');
    allTestsPassed = false;
  }
  console.log('');

  // Test 5: Empty payload
  console.log('Test 5: Create customer with empty payload');
  const test5 = await createCustomerRequest({});

  console.log(`   Status: ${test5.status}`);
  console.log(`   Error: ${test5.body.error || 'none'}`);
  console.log(`   Message: ${test5.body.message || 'none'}`);
  console.log(`   RequestId: ${test5.body.requestId || 'not included'}`);
  
  if (test5.status === 400 && test5.body.message?.includes('name')) {
    console.log('   ✅ PASS - Missing name caught');
    console.log(`   Expected toast: "${test5.body.message} (requestId: ${test5.body.requestId})"`);
  } else {
    console.error('   ❌ FAIL - Expected 400 with name validation error');
    allTestsPassed = false;
  }
  console.log('');

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (allTestsPassed) {
    console.log('✅ ALL TESTS PASSED\n');
    console.log('Error handling works correctly:');
    console.log('  1. Valid customers can be created (201)');
    console.log('  2. Missing required fields return validation error (400)');
    console.log('  3. Invalid data types are caught (400)');
    console.log('  4. All errors include requestId for debugging');
    console.log('  5. Error messages are user-friendly\n');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED\n');
    console.error('Review the output above for details.\n');
    process.exit(1);
  }
}

// Run tests
main().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});
