// Trigger manual sync for OCS to pull February leads
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

// Override with production database
process.env.DATABASE_URL = "postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require"
const prisma = new PrismaClient()

async function triggerOcsSync() {
  try {
    console.log('🔄 TRIGGERING OCS LEAD SYNC\n')
    
    // Find OCS customer
    const ocs = await prisma.customer.findFirst({
      where: {
        name: { contains: 'OCS', mode: 'insensitive' }
      }
    })

    if (!ocs) {
      console.error('❌ OCS customer not found')
      await prisma.$disconnect()
      return
    }

    console.log(`Found: ${ocs.name} (ID: ${ocs.id})`)
    console.log(`Google Sheet URL: ${ocs.leadsReportingUrl || '(none)'}\n`)

    if (!ocs.leadsReportingUrl) {
      console.error('❌ No leadsReportingUrl configured for OCS')
      await prisma.$disconnect()
      return
    }

    // Call the production API to trigger sync
    const apiUrl = `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/leads/sync/trigger?customerId=${ocs.id}`
    
    console.log('📡 Calling production API to trigger sync...')
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ API call failed: ${response.status} ${response.statusText}`)
      console.error(errorText)
      await prisma.$disconnect()
      return
    }

    const result = await response.json()
    console.log('\n✅ Sync triggered successfully!')
    console.log(JSON.stringify(result, null, 2))

    // Wait a bit for sync to complete
    console.log('\n⏳ Waiting 10 seconds for sync to complete...')
    await new Promise(resolve => setTimeout(resolve, 10000))

    // Check for February leads in database
    console.log('\n🔍 Checking for February leads in database...\n')
    
    const febLeads = await prisma.leadRecord.findMany({
      where: {
        customerId: ocs.id
      }
    })

    const febCount = febLeads.filter(lead => {
      const data = lead.data || {}
      const dateStr = data.Date || data.date || data['Created At'] || data.createdAt || ''
      return dateStr.includes('02.26') || dateStr.includes('.02.26') || dateStr.includes('/02/26')
    }).length

    console.log(`📊 Total leads for OCS: ${febLeads.length}`)
    console.log(`🎯 February 2026 leads: ${febCount}`)

    if (febCount > 0) {
      console.log('\n✅ SUCCESS! February leads are now in the database!')
    } else {
      console.log('\n⚠️ No February leads found yet - may need more time or re-sync')
    }

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

triggerOcsSync().catch(console.error)
