// Load environment from .env file
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

// Force use production database
process.env.DATABASE_URL = "postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require"

const prisma = new PrismaClient()

async function checkUrls() {
  try {
    const customers = await prisma.customer.findMany({
      where: {
        leadsReportingUrl: { not: null }
      },
      select: {
        id: true,
        name: true,
        leadsReportingUrl: true
      }
    })

    console.log('\n🔍 CUSTOMERS WITH GOOGLE SHEETS URLS IN DATABASE:\n')
    
    if (customers.length === 0) {
      console.log('❌ NO URLS FOUND IN DATABASE!\n')
    } else {
      customers.forEach(c => {
        console.log(`✅ ${c.name}`)
        console.log(`   URL: ${c.leadsReportingUrl}\n`)
      })
    }

    console.log(`Total: ${customers.length} customers with URLs`)

    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkUrls()
