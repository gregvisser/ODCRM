const { PrismaClient } = require('../server/node_modules/@prisma/client')

async function checkLeadDataStructure() {
  const prisma = new PrismaClient()
  
  try {
    console.log('\n🔍 CHECKING LEAD DATA STRUCTURE\n')
    console.log('='.repeat(80))
    
    // Get a sample lead from each customer
    console.log('\n📋 Sample lead data from each customer:\n')
    
    const customers = await prisma.customer.findMany({
      where: {
        leadsReportingUrl: { not: null }
      },
      include: {
        leadRecords: {
          take: 1,
          orderBy: { updatedAt: 'desc' }
        }
      }
    })
    
    for (const customer of customers) {
      if (customer.leadRecords.length > 0) {
        const lead = customer.leadRecords[0]
        console.log(`\n${customer.name}:`)
        console.log(`  Lead ID: ${lead.id}`)
        console.log(`  Account Name: ${lead.accountName}`)
        console.log(`  Source URL: ${lead.sourceUrl?.substring(0, 80)}...`)
        console.log(`  Sheet GID: ${lead.sheetGid}`)
        console.log(`  Created: ${lead.createdAt}`)
        console.log(`  Updated: ${lead.updatedAt}`)
        console.log(`  Data fields:`)
        
        // Parse the JSON data field
        const data = typeof lead.data === 'string' ? JSON.parse(lead.data) : lead.data
        console.log(`    Keys: ${Object.keys(data).join(', ')}`)
        console.log(`    Sample values:`)
        
        // Show first few fields
        const entries = Object.entries(data).slice(0, 8)
        entries.forEach(([key, value]) => {
          const displayValue = typeof value === 'string' && value.length > 50 
            ? value.substring(0, 50) + '...' 
            : value
          console.log(`      ${key}: ${displayValue}`)
        })
      }
    }
    
    // Check sync states
    console.log('\n\n🔄 SYNC STATES:\n')
    const syncStates = await prisma.leadSyncState.findMany({
      include: {
        customer: {
          select: { name: true }
        }
      },
      orderBy: { lastSyncAt: 'desc' }
    })
    
    if (syncStates.length === 0) {
      console.log('❌ NO SYNC STATES! Backend worker may not have run yet.')
    } else {
      syncStates.forEach(state => {
        const status = state.lastSuccessAt ? '✅' : '❌'
        const timeSince = state.lastSyncAt 
          ? Math.floor((Date.now() - new Date(state.lastSyncAt).getTime()) / 60000)
          : null
        
        console.log(`${status} ${state.customer.name}`)
        console.log(`   Last Sync: ${state.lastSyncAt} (${timeSince} minutes ago)`)
        console.log(`   Last Success: ${state.lastSuccessAt}`)
        console.log(`   Row Count: ${state.rowCount}`)
        if (state.lastError) {
          console.log(`   Error: ${state.lastError}`)
        }
        console.log()
      })
    }
    
    console.log('='.repeat(80) + '\n')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkLeadDataStructure()
