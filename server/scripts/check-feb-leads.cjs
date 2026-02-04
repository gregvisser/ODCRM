// Load environment from .env file
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

// Force use production database
process.env.DATABASE_URL = "postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require"

const prisma = new PrismaClient()

async function checkFebLeads() {
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

    // Get GreenTheUK customer
    const green = await prisma.customer.findFirst({
      where: {
        name: { contains: 'GreenTheUK', mode: 'insensitive' }
      },
      include: {
        leadRecords: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    console.log('=== OCS Leads ===')
    console.log('Customer:', ocs?.name)
    console.log('Total leads:', ocs?.leadRecords?.length || 0)
    console.log('Leads Sheet URL:', ocs?.leadsReportingUrl || 'NOT SET')
    
    if (ocs?.leadRecords && ocs.leadRecords.length > 0) {
      // Filter for Feb 2026 leads
      const febLeads = ocs.leadRecords.filter(lead => {
        const leadData = lead.data || {}
        const dateStr = leadData.Date || leadData.date || leadData['Created At'] || leadData.createdAt || ''
        return dateStr.includes('02.26') || dateStr.includes('2026-02') || dateStr.includes('/02/2026')
      })
      
      console.log('February 2026 leads:', febLeads.length)
      febLeads.forEach((lead, i) => {
        const data = lead.data || {}
        const name = data.Name || data.name || 'Unnamed'
        const date = data.Date || data.date || data['Created At'] || data.createdAt || 'No date'
        console.log(`  ${i+1}. ${name} - ${date}`)
      })
      
      console.log('\nAll leads (latest 10):')
      ocs.leadRecords.slice(0, 10).forEach((lead, i) => {
        const data = lead.data || {}
        const name = data.Name || data.name || 'Unnamed'
        const date = data.Date || data.date || data['Created At'] || data.createdAt || 'No date'
        console.log(`  ${i+1}. ${name} - ${date}`)
      })
    }

    console.log('\n=== GreenTheUK Leads ===')
    console.log('Customer:', green?.name)
    console.log('Total leads:', green?.leadRecords?.length || 0)
    console.log('Leads Sheet URL:', green?.leadsReportingUrl || 'NOT SET')
    
    if (green?.leadRecords && green.leadRecords.length > 0) {
      // Filter for Feb 2026 leads
      const febLeads = green.leadRecords.filter(lead => {
        const leadData = lead.data || {}
        const dateStr = leadData.Date || leadData.date || leadData['Created At'] || leadData.createdAt || ''
        return dateStr.includes('02.26') || dateStr.includes('2026-02') || dateStr.includes('/02/2026')
      })
      
      console.log('February 2026 leads:', febLeads.length)
      febLeads.forEach((lead, i) => {
        const data = lead.data || {}
        const name = data.Name || data.name || 'Unnamed'
        const date = data.Date || data.date || data['Created At'] || data.createdAt || 'No date'
        console.log(`  ${i+1}. ${name} - ${date}`)
      })
      
      console.log('\nAll leads (latest 10):')
      green.leadRecords.slice(0, 10).forEach((lead, i) => {
        const data = lead.data || {}
        const name = data.Name || data.name || 'Unnamed'
        const date = data.Date || data.date || data['Created At'] || data.createdAt || 'No date'
        console.log(`  ${i+1}. ${name} - ${date}`)
      })
    }

    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkFebLeads()
