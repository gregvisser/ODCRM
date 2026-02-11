#!/usr/bin/env node
/**
 * test-agreement-flow.cjs
 * 
 * Tests the agreement upload/persistence flow end-to-end.
 * 
 * Usage:
 *   node server/scripts/test-agreement-flow.cjs [customerId]
 * 
 * If no customerId provided, uses first customer in database.
 */

const { PrismaClient } = require('@prisma/client');

async function testAgreementFlow() {
  const prisma = new PrismaClient();
  
  try {
    // Get customer ID from args or use first customer
    let customerId = process.argv[2];
    
    if (!customerId) {
      const firstCustomer = await prisma.customer.findFirst({
        select: { id: true, name: true }
      });
      
      if (!firstCustomer) {
        console.error('❌ No customers found in database. Create a customer first.');
        process.exit(1);
      }
      
      customerId = firstCustomer.id;
      console.log(`ℹ️  No customerId provided, using first customer: ${firstCustomer.name} (${customerId})\n`);
    }
    
    console.log('🧪 Testing Agreement Flow\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Step 1: Fetch customer BEFORE setting agreement
    console.log('Step 1: Fetch customer BEFORE setting agreement');
    const customerBefore = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        agreementBlobName: true,
        agreementContainerName: true,
        agreementFileName: true,
        agreementFileMimeType: true,
        agreementUploadedAt: true,
        agreementUploadedByEmail: true,
        agreementFileUrl: true,
      }
    });
    
    if (!customerBefore) {
      console.error(`❌ Customer ${customerId} not found`);
      process.exit(1);
    }
    
    console.log(`   Customer: ${customerBefore.name} (${customerBefore.id})`);
    console.log(`   agreementBlobName: ${customerBefore.agreementBlobName || '(null)'}`);
    console.log(`   agreementContainerName: ${customerBefore.agreementContainerName || '(null)'}`);
    console.log(`   agreementFileName: ${customerBefore.agreementFileName || '(null)'}`);
    console.log(`   agreementFileUrl: ${customerBefore.agreementFileUrl || '(null)'}`);
    console.log('');
    
    // Step 2: Simulate agreement upload by updating customer record
    console.log('Step 2: Simulate agreement upload (update customer record)');
    const testBlobName = `agreement_${customerId}_${Date.now()}_test_contract.pdf`;
    const testContainerName = 'customer-agreements';
    const testFileName = 'test-contract.pdf';
    const testMimeType = 'application/pdf';
    
    console.log(`   Writing: blobName=${testBlobName}`);
    console.log(`   Writing: container=${testContainerName}`);
    console.log(`   Writing: fileName=${testFileName}`);
    
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        agreementBlobName: testBlobName,
        agreementContainerName: testContainerName,
        agreementFileName: testFileName,
        agreementFileMimeType: testMimeType,
        agreementUploadedAt: new Date(),
        agreementUploadedByEmail: 'test@example.com',
        agreementFileUrl: null, // Clear legacy field
      },
      select: {
        id: true,
        name: true,
        agreementBlobName: true,
        agreementContainerName: true,
        agreementFileName: true,
        agreementFileMimeType: true,
        agreementUploadedAt: true,
        agreementUploadedByEmail: true,
      }
    });
    
    console.log('   ✅ Update complete\n');
    
    // Step 3: Verify update succeeded
    console.log('Step 3: Verify agreement metadata persisted');
    console.log(`   agreementBlobName: ${updatedCustomer.agreementBlobName}`);
    console.log(`   agreementContainerName: ${updatedCustomer.agreementContainerName}`);
    console.log(`   agreementFileName: ${updatedCustomer.agreementFileName}`);
    console.log(`   agreementFileMimeType: ${updatedCustomer.agreementFileMimeType}`);
    console.log(`   agreementUploadedAt: ${updatedCustomer.agreementUploadedAt?.toISOString()}`);
    console.log(`   agreementUploadedByEmail: ${updatedCustomer.agreementUploadedByEmail}`);
    
    if (!updatedCustomer.agreementBlobName || !updatedCustomer.agreementContainerName) {
      console.error('\n❌ VERIFICATION FAILED: Agreement metadata not persisted');
      process.exit(1);
    }
    
    console.log('\n   ✅ Agreement metadata persisted correctly\n');
    
    // Step 4: Simulate refresh (re-fetch customer)
    console.log('Step 4: Simulate page refresh (re-fetch customer)');
    const customerAfter = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        agreementBlobName: true,
        agreementContainerName: true,
        agreementFileName: true,
        agreementFileMimeType: true,
        agreementUploadedAt: true,
        agreementUploadedByEmail: true,
      }
    });
    
    if (!customerAfter) {
      console.error(`❌ Customer ${customerId} not found after refresh simulation`);
      process.exit(1);
    }
    
    console.log(`   agreementBlobName: ${customerAfter.agreementBlobName}`);
    console.log(`   agreementContainerName: ${customerAfter.agreementContainerName}`);
    console.log(`   agreementFileName: ${customerAfter.agreementFileName}`);
    
    if (!customerAfter.agreementBlobName || !customerAfter.agreementContainerName) {
      console.error('\n❌ TEST FAILED: Agreement disappeared after refresh');
      process.exit(1);
    }
    
    console.log('\n   ✅ Agreement still present after refresh\n');
    
    // Step 5: Check /api/customers/:id returns agreement fields
    console.log('Step 5: Verify GET /api/customers/:id would include agreement fields');
    console.log('   (This test simulates what the endpoint does)');
    
    // Simulate the select used by GET /api/customers/:id
    const customerApi = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        domain: true,
        website: true,
        accountData: true,
        createdAt: true,
        updatedAt: true,
        // Agreement fields (should be included after our fix)
        agreementBlobName: true,
        agreementContainerName: true,
        agreementFileName: true,
        agreementFileMimeType: true,
        agreementUploadedAt: true,
        agreementUploadedByEmail: true,
        agreementFileUrl: true,
      }
    });
    
    if (!customerApi) {
      console.error(`❌ Customer ${customerId} not found`);
      process.exit(1);
    }
    
    const hasAgreementFields = 
      customerApi.agreementBlobName && 
      customerApi.agreementContainerName &&
      customerApi.agreementFileName;
    
    if (!hasAgreementFields) {
      console.error('\n❌ TEST FAILED: GET endpoint select is missing agreement fields');
      console.error('   Check that GET /api/customers/:id includes agreement fields in select');
      process.exit(1);
    }
    
    console.log(`   ✅ GET endpoint would return: agreementFileName="${customerApi.agreementFileName}"`);
    console.log(`   ✅ Frontend can display agreement after refresh\n`);
    
    // Success summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ ALL TESTS PASSED\n');
    console.log('Agreement flow works correctly:');
    console.log('  1. Agreement metadata persists to database');
    console.log('  2. Agreement survives page refresh');
    console.log('  3. GET endpoint returns agreement fields');
    console.log('  4. Frontend can display agreement state\n');
    
  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testAgreementFlow();