// Load environment from .env file
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

// Force use production database
process.env.DATABASE_URL = "postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require"

const prisma = new PrismaClient()

async function checkCustomerSheets() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' }
    })

    console.log('=== CHECKING ALL CUSTOMER SHEET URLS ===\n')

    for (const customer of customers) {
      console.log(`📁 ${customer.name}`)
      console.log(`   ID: ${customer.id}`)
      console.log(`   leadsReportingUrl: ${customer.leadsReportingUrl || '❌ NOT SET'}`)
      console.log(`   leadReportingSheetUrl: ${customer.leadReportingSheetUrl || '❌ NOT SET'}`)
      console.log(`   googleSheetsUrl: ${customer.googleSheetsUrl || '❌ NOT SET'}`)
      
      // Show all fields that might contain URLs
      const allFields = Object.keys(customer)
      const urlFields = allFields.filter(key => 
        key.toLowerCase().includes('url') || 
        key.toLowerCase().includes('sheet') ||
        key.toLowerCase().includes('google') ||
        key.toLowerCase().includes('reporting')
      )
      
      if (urlFields.length > 0) {
        console.log(`   All URL/Sheet fields:`)
        urlFields.forEach(field => {
          console.log(`     - ${field}: ${customer[field] || 'null'}`)
        })
      }
      console.log('')
    }

    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkCustomerSheets()
