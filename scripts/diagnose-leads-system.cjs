const { PrismaClient } = require('../server/node_modules/@prisma/client')

async function diagnoseLeadsSystem() {
  const prisma = new PrismaClient()
  
  try {
    console.log('\n🔍 COMPLETE LEADS SYSTEM DIAGNOSTIC\n')
    console.log('='.repeat(80))
    
    // 1. Check all customers with Google Sheet URLs
    console.log('\n1️⃣  CUSTOMERS WITH GOOGLE SHEET URLs:\n')
    const customersWithSheets = await prisma.customer.findMany({
      where: {
        leadsReportingUrl: { not: null }
      },
      select: {
        id: true,
        name: true,
        leadsReportingUrl: true,
        weeklyLeadTarget: true,
        monthlyLeadTarget: true,
        weeklyLeadActual: true,
        monthlyLeadActual: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' }
    })
    
    console.log(`Found ${customersWithSheets.length} customers with Google Sheet URLs:\n`)
    customersWithSheets.forEach(c => {
      console.log(`✅ ${c.name}`)
      console.log(`   Sheet: ${c.leadsReportingUrl?.substring(0, 80)}...`)
      console.log(`   Targets: Weekly=${c.weeklyLeadTarget}, Monthly=${c.monthlyLeadTarget}`)
      console.log(`   Actuals: Weekly=${c.weeklyLeadActual}, Monthly=${c.monthlyLeadActual}`)
      console.log(`   Last Updated: ${c.updatedAt}`)
      console.log()
    })
    
    // 2. Check lead records in database
    console.log('\n2️⃣  LEAD RECORDS IN DATABASE:\n')
    const totalLeads = await prisma.leadRecord.count()
    console.log(`Total leads in database: ${totalLeads}`)
    
    if (totalLeads === 0) {
      console.log('\n❌ NO LEADS IN DATABASE! This is the problem!')
      console.log('   The backend worker is not syncing leads from Google Sheets.')
    } else {
      // Group by customer
      const leadsByCustomer = await prisma.leadRecord.groupBy({
        by: ['customerId'],
        _count: { id: true }
      })
      
      console.log(`\nLeads by customer:\n`)
      for (const group of leadsByCustomer) {
        const customer = await prisma.customer.findUnique({
          where: { id: group.customerId },
          select: { name: true }
        })
        console.log(`  ${customer?.name}: ${group._count.id} leads`)
      }
      
      // Check most recent leads
      console.log(`\nMost recent 5 leads:\n`)
      const recentLeads = await prisma.leadRecord.findMany({
        take: 5,
        orderBy: { syncedAt: 'desc' },
        include: {
          customer: {
            select: { name: true }
          }
        }
      })
      
      recentLeads.forEach(lead => {
        console.log(`  ${lead.customer.name}: ${lead.companyName || 'N/A'}`)
        console.log(`    Date: ${lead.date}`)
        console.log(`    Contact: ${lead.contactName || 'N/A'}`)
        console.log(`    Synced: ${lead.syncedAt}`)
        console.log()
      })
    }
    
    // 3. Check lead sync state
    console.log('\n3️⃣  LEAD SYNC STATE:\n')
    const syncStates = await prisma.leadSyncState.findMany({
      include: {
        customer: {
          select: { name: true }
        }
      },
      orderBy: { lastSyncAt: 'desc' }
    })
    
    if (syncStates.length === 0) {
      console.log('❌ NO SYNC STATES! Backend worker has never run.')
    } else {
      console.log(`Found ${syncStates.length} sync states:\n`)
      syncStates.forEach(state => {
        const status = state.lastSyncSuccess ? '✅' : '❌'
        console.log(`${status} ${state.customer.name}`)
        console.log(`   Last Sync: ${state.lastSyncAt}`)
        console.log(`   Success: ${state.lastSyncSuccess}`)
        console.log(`   Leads Synced: ${state.leadsCount}`)
        if (state.lastSyncError) {
          console.log(`   Error: ${state.lastSyncError}`)
        }
        console.log()
      })
    }
    
    // 4. Check if backend server is configured
    console.log('\n4️⃣  BACKEND CONFIGURATION:\n')
    const env = require('dotenv')
    const path = require('path')
    const fs = require('fs')
    
    const serverEnvPath = path.join(__dirname, '../server/.env')
    if (fs.existsSync(serverEnvPath)) {
      console.log('✅ server/.env exists')
      env.config({ path: serverEnvPath })
      
      const hasDb = process.env.DATABASE_URL ? '✅' : '❌'
      const hasGoogle = process.env.GOOGLE_SHEETS_API_KEY ? '✅' : '❌'
      
      console.log(`${hasDb} DATABASE_URL configured`)
      console.log(`${hasGoogle} GOOGLE_SHEETS_API_KEY configured`)
      
      if (!process.env.GOOGLE_SHEETS_API_KEY) {
        console.log('\n❌ CRITICAL: No Google Sheets API key!')
        console.log('   The backend cannot access Google Sheets without an API key.')
      }
    } else {
      console.log('❌ server/.env not found!')
    }
    
    // 5. Summary and recommendations
    console.log('\n' + '='.repeat(80))
    console.log('\n📊 DIAGNOSIS SUMMARY:\n')
    
    const issues = []
    const recommendations = []
    
    if (customersWithSheets.length === 0) {
      issues.push('No customers have Google Sheet URLs configured')
      recommendations.push('Add Google Sheet URLs to customer accounts')
    }
    
    if (totalLeads === 0) {
      issues.push('No leads in database - backend worker not syncing')
      recommendations.push('Check if backend server is running: cd server && npm run dev')
      recommendations.push('Check backend logs for errors')
      recommendations.push('Verify Google Sheets API key is configured')
    }
    
    if (syncStates.length === 0) {
      issues.push('No sync states - backend worker has never run')
      recommendations.push('Restart backend server to trigger initial sync')
    } else {
      const failedSyncs = syncStates.filter(s => !s.lastSyncSuccess)
      if (failedSyncs.length > 0) {
        issues.push(`${failedSyncs.length} customers have failed syncs`)
        recommendations.push('Check Google Sheet permissions (must be publicly readable)')
        recommendations.push('Verify Google Sheet URLs are correct')
      }
      
      // Check if syncs are recent (within last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const staleSyncs = syncStates.filter(s => new Date(s.lastSyncAt) < oneHourAgo)
      if (staleSyncs.length > 0) {
        issues.push(`${staleSyncs.length} customers have stale syncs (>1 hour old)`)
        recommendations.push('Backend worker may not be running - check server logs')
      }
    }
    
    if (issues.length === 0) {
      console.log('✅ No critical issues found!')
    } else {
      console.log('❌ ISSUES FOUND:\n')
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`)
      })
      
      console.log('\n💡 RECOMMENDATIONS:\n')
      recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`)
      })
    }
    
    console.log('\n' + '='.repeat(80) + '\n')
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

diagnoseLeadsSystem()
