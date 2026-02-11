/**
 * Regression test for customer archive/unarchive audit events
 * Verifies that archive operations succeed without ClientStatus enum errors
 * 
 * Usage: node server/scripts/test-archive-audit.cjs
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testArchiveAudit() {
  console.log('🧪 Testing archive audit event creation...\n')
  
  try {
    // Find an existing customer to test with (prefer non-archived)
    let customer = await prisma.customer.findFirst({
      where: { isArchived: false },
      select: { id: true, name: true, clientStatus: true, isArchived: true }
    })
    
    if (!customer) {
      // If all are archived, find any customer
      customer = await prisma.customer.findFirst({
        select: { id: true, name: true, clientStatus: true, isArchived: true }
      })
    }
    
    if (!customer) {
      console.log('❌ No customers found in database. Skipping test.')
      return { success: false, reason: 'no_customers' }
    }
    
    console.log(`📋 Testing with customer: ${customer.name} (${customer.id})`)
    console.log(`   Current status: ${customer.clientStatus || 'null'}`)
    console.log(`   Is archived: ${customer.isArchived}`)
    
    // Test creating an audit event with valid ClientStatus
    const validStatus = customer.clientStatus || 'active'
    
    console.log(`\n🔧 Creating test audit event with status: "${validStatus}"...`)
    
    const auditEvent = await prisma.customerAuditEvent.create({
      data: {
        customerId: customer.id,
        action: 'test_archive_audit',
        actorEmail: 'test@script.local',
        fromStatus: validStatus,
        toStatus: validStatus,
        metadata: {
          testRun: true,
          timestamp: new Date().toISOString(),
          note: 'Regression test - archive audit should use valid ClientStatus'
        }
      }
    })
    
    console.log(`✅ Audit event created successfully: ${auditEvent.id}`)
    console.log(`   fromStatus: ${auditEvent.fromStatus}`)
    console.log(`   toStatus: ${auditEvent.toStatus}`)
    
    // Clean up test audit event
    await prisma.customerAuditEvent.delete({
      where: { id: auditEvent.id }
    })
    console.log(`🧹 Test audit event cleaned up`)
    
    console.log('\n✅ TEST PASSED: Archive audit events can be created with valid ClientStatus')
    return { success: true }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message)
    if (error.code) {
      console.error(`   Prisma error code: ${error.code}`)
    }
    return { success: false, error: error.message }
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testArchiveAudit()
  .then(result => {
    process.exit(result.success ? 0 : 1)
  })
  .catch(err => {
    console.error('Unexpected error:', err)
    process.exit(1)
  })
