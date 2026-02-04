// Load environment from .env file
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

// Force use production database
process.env.DATABASE_URL = "postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require"

const prisma = new PrismaClient()

async function checkAllCustomers() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' }
    })

    console.log('=== ALL CUSTOMERS ===')
    console.log(`Total: ${customers.length}\n`)

    for (const customer of customers) {
      const leadCount = await prisma.leadRecord.count({
        where: { customerId: customer.id }
      })

      console.log(`📁 ${customer.name}`)
      console.log(`   ID: ${customer.id}`)
      console.log(`   Leads: ${leadCount}`)
      console.log(`   Sheet URL: ${customer.leadsReportingUrl || '❌ NOT SET'}`)
      console.log('')
    }

    // Check for customers with OCS or GreenTheUK in their name
    const ocsVariants = customers.filter(c => 
      c.name.toLowerCase().includes('ocs')
    )
    
    const greenVariants = customers.filter(c => 
      c.name.toLowerCase().includes('green')
    )

    console.log('\n=== OCS VARIANTS ===')
    ocsVariants.forEach(c => {
      console.log(`- ${c.name} (ID: ${c.id})`)
      console.log(`  Sheet URL: ${c.leadsReportingUrl || 'NOT SET'}`)
    })

    console.log('\n=== GREEN VARIANTS ===')
    greenVariants.forEach(c => {
      console.log(`- ${c.name} (ID: ${c.id})`)
      console.log(`  Sheet URL: ${c.leadsReportingUrl || 'NOT SET'}`)
    })

    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkAllCustomers()
