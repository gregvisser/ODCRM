// Test the sync directly by calling the worker function
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
process.env.DATABASE_URL = "postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require"
const prisma = new PrismaClient()

// Import the trigger function - need to check if it's exported
async function testSync() {
  try {
    console.log('🔄 TESTING SYNC DIRECTLY\n')
    
    const ocs = await prisma.customer.findFirst({ where: { name: { contains: 'OCS' } } })
    console.log('Customer:', ocs.name)
    console.log('Google Sheet URL:', ocs.leadsReportingUrl)
    console.log('\n📡 Calling production API with verbose logging...\n')
    
    const apiUrl = `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/leads/sync/trigger?customerId=${ocs.id}`
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    console.log('Response status:', response.status, response.statusText)
    
    const result = await response.json()
    console.log('Response body:', JSON.stringify(result, null, 2))
    
    // Wait 5 seconds and check sync state
    console.log('\n⏳ Waiting 5 seconds...\n')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    const syncState = await prisma.leadSyncState.findUnique({
      where: { customerId: ocs.id }
    })
    
    console.log('Sync State After Trigger:')
    console.log('  Is Running:', syncState?.isRunning)
    console.log('  Last Sync At:', syncState?.lastSyncAt)
    console.log('  Last Error:', syncState?.lastError || '(none)')
    console.log('  Lead Count:', syncState?.leadCount)

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error:', error)
    await prisma.$disconnect()
  }
}

testSync().catch(console.error)
