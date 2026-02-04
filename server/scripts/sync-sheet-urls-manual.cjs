// Load environment from .env file
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')
const readline = require('readline')

// Force use production database
process.env.DATABASE_URL = "postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require"

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function syncSheetUrls() {
  try {
    console.log('\n🔄 MANUAL GOOGLE SHEETS URL SYNC\n')
    console.log('This script will help you sync Google Sheets URLs from the UI to the database.\n')
    
    // Get all customers
    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' }
    })

    console.log(`📊 Found ${customers.length} customers in database\n`)

    // Focus on OCS and GreenTheUK first (the ones mentioned by user)
    const priorityCustomers = [
      'OCS Group Holdings Ltd',
      'GreenTheUK Limited'
    ]

    const updates = []

    for (const customerName of priorityCustomers) {
      const customer = customers.find(c => c.name === customerName)
      if (!customer) {
        console.log(`⚠️  Customer not found: ${customerName}`)
        continue
      }

      console.log(`\n📁 ${customer.name}`)
      console.log(`   Current URL in DB: ${customer.leadsReportingUrl || '❌ NOT SET'}`)
      
      const answer = await question(`   Paste Google Sheets URL (or press Enter to skip): `)
      
      if (answer.trim()) {
        const url = answer.trim()
        if (url.includes('docs.google.com/spreadsheets')) {
          updates.push({ customer, url })
          console.log(`   ✅ Will update with: ${url}`)
        } else {
          console.log(`   ⚠️  Invalid URL (not a Google Sheets URL)`)
        }
      } else {
        console.log(`   ⏭️  Skipped`)
      }
    }

    // Ask if user wants to update other customers too
    const updateOthers = await question(`\n❓ Do you want to update other customers too? (y/n): `)
    
    if (updateOthers.toLowerCase() === 'y') {
      const otherCustomers = customers.filter(c => 
        !priorityCustomers.includes(c.name)
      )

      for (const customer of otherCustomers) {
        console.log(`\n📁 ${customer.name}`)
        console.log(`   Current URL in DB: ${customer.leadsReportingUrl || '❌ NOT SET'}`)
        
        const answer = await question(`   Paste Google Sheets URL (or press Enter to skip): `)
        
        if (answer.trim()) {
          const url = answer.trim()
          if (url.includes('docs.google.com/spreadsheets')) {
            updates.push({ customer, url })
            console.log(`   ✅ Will update with: ${url}`)
          } else {
            console.log(`   ⚠️  Invalid URL (not a Google Sheets URL)`)
          }
        } else {
          console.log(`   ⏭️  Skipped`)
        }
      }
    }

    // Apply updates
    if (updates.length === 0) {
      console.log('\n⚠️  No updates to apply')
      rl.close()
      await prisma.$disconnect()
      return
    }

    console.log(`\n📝 Applying ${updates.length} updates...`)

    for (const { customer, url } of updates) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { leadsReportingUrl: url }
      })
      console.log(`✅ Updated ${customer.name}`)
    }

    console.log('\n🎉 All updates complete!')
    console.log('\n🔄 Now triggering leads sync for updated customers...')

    // Trigger leads sync for updated customers
    const { triggerManualSync } = require('../dist/workers/leadsSync.js')

    for (const { customer } of updates) {
      console.log(`\n📥 Syncing leads for ${customer.name}...`)
      try {
        await triggerManualSync(prisma, customer.id)
        console.log(`✅ Sync complete for ${customer.name}`)
      } catch (error) {
        console.error(`❌ Sync failed for ${customer.name}:`, error.message)
      }
    }

    console.log('\n✨ All done! Check the Dashboards tab to see the leads.')

    rl.close()
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    rl.close()
    await prisma.$disconnect()
    process.exit(1)
  }
}

syncSheetUrls()
