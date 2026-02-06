// Load environment from .env file
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

// Force use production database
process.env.DATABASE_URL = "postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require"

const prisma = new PrismaClient()

async function checkOcsLeads() {
  try {
    // Get OCS customer
    const ocs = await prisma.customer.findFirst({
      where: {
        name: { contains: 'OCS', mode: 'insensitive' }
      },
      include: {
        leadRecords: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!ocs) {
      console.log('❌ OCS customer not found')
      await prisma.$disconnect()
      return
    }

    console.log('\n=== OCS Group Holdings Ltd ===')
    console.log(`Total leads in database: ${ocs.leadRecords.length}`)
    console.log(`\n📋 ALL LEADS (with dates):\n`)

    ocs.leadRecords.forEach((lead, i) => {
      const data = lead.data || {}
      const name = data.Name || data.name || 'Unnamed'
      const company = data.Company || data.company || ''
      
      // Check ALL possible date fields
      const dateFields = ['Date', 'date', 'Created At', 'createdAt', 'First Meeting Date']
      const dates = {}
      dateFields.forEach(field => {
        if (data[field]) dates[field] = data[field]
      })
      
      console.log(`${i+1}. ${name} - ${company}`)
      console.log(`   Date fields:`, dates)
      console.log(`   All fields:`, Object.keys(data).join(', '))
      console.log('')
    })

    // Check for leads with February dates
    const febLeads = ocs.leadRecords.filter(lead => {
      const data = lead.data || {}
      const dateStr = data.Date || data.date || data['Created At'] || data.createdAt || data['First Meeting Date'] || ''
      
      // Check if date contains Feb 2026 patterns
      return (
        dateStr.includes('02.26') || 
        dateStr.includes('.02.26') ||
        dateStr.includes('/02/26') ||
        dateStr.includes('2026-02') ||
        dateStr.includes('02/2026')
      )
    })

    console.log(`\n🔍 FEBRUARY 2026 LEADS: ${febLeads.length}\n`)
    febLeads.forEach((lead, i) => {
      const data = lead.data || {}
      const name = data.Name || data.name || 'Unnamed'
      const dateStr = data.Date || data.date || data['Created At'] || data.createdAt || data['First Meeting Date'] || ''
      console.log(`${i+1}. ${name} - Date: "${dateStr}"`)
    })

    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkOcsLeads()
