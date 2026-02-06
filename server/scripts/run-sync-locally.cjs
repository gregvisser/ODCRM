// Run the actual sync logic locally to see errors
const path = require('path')
const { fileURLToPath } = require('url')

// Set env before importing
process.env.DATABASE_URL = "postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require"

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Import the trigger function from the compiled JS
async function importSync() {
  try {
    // Build first
    console.log('📦 Building TypeScript...\n')
    const { execSync } = require('child_process')
    execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
    
    console.log('\n🔄 Importing sync worker...\n')
    const { triggerManualSync } = require('../dist/workers/leadsSync.js')
    
    // Find OCS
    const ocs = await prisma.customer.findFirst({ where: { name: { contains: 'OCS' } } })
    console.log(`Found: ${ocs.name} (ID: ${ocs.id})`)
    console.log(`Google Sheet URL: ${ocs.leadsReportingUrl}\n`)
    
    console.log('🚀 Triggering sync...\n')
    await triggerManualSync(prisma, ocs.id)
    
    console.log('\n✅ Sync completed! Checking results...\n')
    
    // Check results
    const leads = await prisma.leadRecord.findMany({ where: { customerId: ocs.id } })
    const febLeads = leads.filter(l => {
      const d = l.data || {}
      const ds = d.Date || d.date || ''
      return ds.includes('02.26') || ds.includes('.02.26') || ds.includes('/02/26')
    })
    
    console.log(`📊 Total leads: ${leads.length}`)
    console.log(`🎯 February 2026 leads: ${febLeads.length}`)
    
    if (febLeads.length > 0) {
      console.log('\nFebruary leads:')
      febLeads.forEach(l => {
        const d = l.data || {}
        console.log(`  ${d.Date || d.date} - ${d.Name || d.name} at ${d.Company || '(no company)'}`)
      })
    }
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('\n❌ ERROR:', error)
    console.error('\nStack trace:')
    console.error(error.stack)
    await prisma.$disconnect()
    process.exit(1)
  }
}

importSync().catch(console.error)
