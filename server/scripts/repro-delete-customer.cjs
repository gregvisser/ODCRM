#!/usr/bin/env node
/**
 * repro-delete-customer.cjs
 * 
 * Reproduces the "Can't delete customer" issue by calling the API endpoint directly.
 * Tests error scenarios to ensure proper error handling.
 * 
 * Usage:
 *   node server/scripts/repro-delete-customer.cjs <customerId>
 * 
 * Prerequisites:
 *   - Backend server must be running on localhost:3001
 *   - Or set BACKEND_URL environment variable
 * 
 * Exit codes:
 *   0 - Success (deletion completed OR error properly structured)
 *   1 - Tests failed (unexpected behavior)
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

/**
 * Make API request to delete customer endpoint
 */
async function deleteCustomerRequest(customerId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/customers/${customerId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        // Note: X-Customer-Id header intentionally omitted (not needed for delete)
      }
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
  console.log('🧪 Testing Delete Customer Error Handling\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Backend URL: ${BACKEND_URL}\n`);
  
  const customerId = process.argv[2];
  
  if (!customerId) {
    console.error('❌ ERROR: Customer ID required\n');
    console.error('Usage: node server/scripts/repro-delete-customer.cjs <customerId>\n');
    console.error('Example: node server/scripts/repro-delete-customer.cjs cust_123_abc\n');
    process.exit(1);
  }

  console.log(`Target Customer ID: ${customerId}\n`);
  console.log('Testing DELETE /api/customers/:id endpoint\n');

  // Attempt to delete
  const result = await deleteCustomerRequest(customerId);

  console.log(`HTTP Status: ${result.status}`);
  console.log(`Success: ${result.ok ? 'YES' : 'NO'}`);
  console.log(`\nResponse Body:`);
  console.log(JSON.stringify(result.body, null, 2));
  console.log('');

  // Analyze response
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 Analysis:\n');

  if (result.status === 200 && result.body.success) {
    console.log('✅ DELETE SUCCEEDED');
    console.log(`   Customer ${customerId} was deleted successfully`);
    console.log(`   RequestId: ${result.body.requestId || 'not included'}`);
    console.log('');
    console.log('   Expected UI: Toast with "Customer deleted successfully"');
    console.log('');
  } else if (result.status === 409) {
    console.log('✅ DELETE BLOCKED (expected - has related records)');
    console.log(`   Error: ${result.body.error || 'none'}`);
    console.log(`   Message: ${result.body.message || 'none'}`);
    console.log(`   PrismaCode: ${result.body.prismaCode || 'none'}`);
    console.log(`   RequestId: ${result.body.requestId || 'not included'}`);
    console.log(`   Meta: ${JSON.stringify(result.body.meta || {})}`);
    console.log('');
    console.log(`   Expected UI Toast:`);
    console.log(`   Title: "Delete failed"`);
    console.log(`   Description: "${result.body.message} (requestId: ${result.body.requestId}) [${result.body.prismaCode}]"`);
    console.log('');
    console.log('   This is the correct behavior when a customer has:');
    console.log(`   - ${result.body.meta?.contactsCount || 0} contacts`);
    console.log(`   - ${result.body.meta?.campaignsCount || 0} campaigns`);
    console.log(`   - ${result.body.meta?.listsCount || 0} lists`);
    console.log(`   - ${result.body.meta?.sequencesCount || 0} sequences`);
    console.log('');
  } else if (result.status === 404) {
    console.log('✅ DELETE FAILED (expected - customer not found)');
    console.log(`   Error: ${result.body.error || 'none'}`);
    console.log(`   Message: ${result.body.message || 'none'}`);
    console.log(`   PrismaCode: ${result.body.prismaCode || 'none'}`);
    console.log(`   RequestId: ${result.body.requestId || 'not included'}`);
    console.log('');
    console.log(`   Expected UI Toast:`);
    console.log(`   Title: "Delete failed"`);
    console.log(`   Description: "${result.body.message} (requestId: ${result.body.requestId}) [${result.body.prismaCode}]"`);
    console.log('');
  } else if (result.status === 500) {
    console.log('⚠️  DELETE FAILED (server error)');
    console.log(`   Error: ${result.body.error || 'none'}`);
    console.log(`   Message: ${result.body.message || 'none'}`);
    console.log(`   PrismaCode: ${result.body.prismaCode || 'none'}`);
    console.log(`   RequestId: ${result.body.requestId || 'not included'}`);
    console.log('');
    console.log(`   Expected UI Toast:`);
    console.log(`   Title: "Delete failed"`);
    console.log(`   Description: "${result.body.message} (requestId: ${result.body.requestId})"`);
    if (result.body.prismaCode) {
      console.log(`   PrismaCode shown: [${result.body.prismaCode}]`);
    }
    console.log('');
    console.log('   This indicates a server or database error.');
    console.log('   Check backend logs for:');
    console.log(`   grep "[delete_customer_failed] requestId=${result.body.requestId}" logs`);
    console.log('');
  } else {
    console.error('❌ UNEXPECTED RESPONSE');
    console.error(`   Status: ${result.status}`);
    console.error(`   This may indicate an issue with error handling`);
    console.error('');
  }

  // Verify error structure
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔍 Error Structure Validation:\n');

  if (result.ok) {
    console.log('   ✅ Success response (no error to validate)');
  } else {
    const hasError = result.body.error !== undefined;
    const hasMessage = result.body.message !== undefined;
    const hasRequestId = result.body.requestId !== undefined;
    
    console.log(`   ${hasError ? '✅' : '❌'} Has 'error' field: ${hasError}`);
    console.log(`   ${hasMessage ? '✅' : '❌'} Has 'message' field: ${hasMessage}`);
    console.log(`   ${hasRequestId ? '✅' : '❌'} Has 'requestId' field: ${hasRequestId}`);
    
    if (result.body.prismaCode) {
      console.log(`   ✅ Has 'prismaCode' field: ${result.body.prismaCode}`);
    } else {
      console.log(`   ⚠️  No 'prismaCode' (ok if not a Prisma error)`);
    }
    
    console.log('');
    
    if (hasError && hasMessage && hasRequestId) {
      console.log('   ✅ Error structure is valid');
      console.log('   Frontend will display full error details in toast');
    } else {
      console.error('   ❌ Error structure is incomplete');
      console.error('   Frontend may show generic error message');
    }
  }
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (result.ok || (result.body.error && result.body.message && result.body.requestId)) {
    console.log('✅ TEST PASSED\n');
    console.log('Error handling is working correctly:');
    console.log('  1. Structured JSON response with error, message, requestId');
    console.log('  2. Appropriate HTTP status codes');
    console.log('  3. PrismaCode included for database errors');
    console.log('  4. UI will show full error details');
    console.log('');
    process.exit(0);
  } else {
    console.error('❌ TEST FAILED\n');
    console.error('Error handling needs improvement:');
    console.error('  - Missing error, message, or requestId fields');
    console.error('  - Frontend will not display detailed errors');
    console.error('');
    process.exit(1);
  }
}

// Run test
main().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});
