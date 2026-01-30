#!/usr/bin/env node

/**
 * Diagnostics script for leads system
 * Usage: node scripts/diagnose-leads.cjs
 */

async function diagnoseLeads() {
  console.log('🔍 LEADS SYSTEM DIAGNOSTICS')
  console.log('=' .repeat(50))

  try {
    // Test server connectivity
    console.log('\n1. Testing server connectivity...')
    const response = await fetch('http://localhost:3001/api/leads/diagnostics')
    if (!response.ok) {
      console.log('❌ Server not responding on localhost:3001')
      console.log('   Make sure the server is running with: cd server && npm run dev')
      return
    }

    const diagnostics = await response.json()
    console.log('✅ Server responding')

    // Display key metrics
    console.log('\n2. Database Status:')
    console.log(`   Total leads: ${diagnostics.totalLeads}`)
    console.log(`   Customers with leads: ${diagnostics.customersWithLeads}`)
    console.log(`   Recent syncs (24h): ${diagnostics.recentSyncs.length}`)

    if (diagnostics.recentSyncs.length > 0) {
      const lastSync = diagnostics.recentSyncs[0]
      const age = Date.now() - new Date(lastSync.lastSuccessAt).getTime()
      const ageMinutes = Math.floor(age / (1000 * 60))
      console.log(`   Last successful sync: ${ageMinutes} minutes ago`)
      console.log(`   Last sync had ${lastSync.rowCount || 0} leads`)
    }

    // Display lead counts by customer
    console.log('\n3. Leads by Customer:')
    diagnostics.leadCounts.forEach(count => {
      console.log(`   ${count.accountName}: ${count._count.id} leads`)
    })

    // Health checks
    console.log('\n4. Health Checks:')
    console.log(`   Has data: ${diagnostics.health.hasData ? '✅' : '❌'}`)
    console.log(`   Has recent sync: ${diagnostics.health.hasRecentSync ? '✅' : '❌'}`)

    if (diagnostics.health.lastSyncAge) {
      const ageHours = Math.floor(diagnostics.health.lastSyncAge / (1000 * 60 * 60))
      console.log(`   Last sync age: ${ageHours} hours`)
    }

    // Recommendations
    console.log('\n5. Recommendations:')
    if (!diagnostics.health.hasData) {
      console.log('   ⚠️  No leads data found. Check Google Sheets URLs in customer settings.')
    }
    if (!diagnostics.health.hasRecentSync) {
      console.log('   ⚠️  No recent syncs. Check server logs for sync errors.')
    }
    if (diagnostics.health.lastSyncAge && diagnostics.health.lastSyncAge > 2 * 60 * 60 * 1000) { // 2 hours
      console.log('   ⚠️  Last sync is old. Check if sync worker is running.')
    }

    // Test sync functionality
    console.log('\n6. Testing sync functionality...')
    try {
      const syncTest = await fetch('http://localhost:3001/api/leads?customerId=test')
      if (syncTest.ok) {
        const data = await syncTest.json()
        console.log(`   ✅ API responding with ${data.leads?.length || 0} leads`)
      } else {
        console.log(`   ❌ API error: ${syncTest.status}`)
      }
    } catch (error) {
      console.log(`   ❌ API test failed: ${error.message}`)
    }

  } catch (error) {
    console.log(`❌ Diagnostics failed: ${error.message}`)
    console.log('\nTroubleshooting:')
    console.log('1. Make sure the server is running: cd server && npm run dev')
    console.log('2. Check server logs for errors')
    console.log('3. Verify database connection in server/.env')
  }
}

diagnoseLeads().catch(console.error)