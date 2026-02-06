require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
process.env.DATABASE_URL = "postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require"
const prisma = new PrismaClient()

;(async () => {
  const ocs = await prisma.customer.findFirst({ where: { name: { contains: 'OCS' } } })
  const leads = await prisma.leadRecord.findMany({ where: { customerId: ocs.id } })
  const febLeads = leads.filter(l => {
    const d = l.data || {}
    const ds = d.Date || d.date || ''
    return ds.includes('02.26') || ds.includes('.02.26') || ds.includes('/02/26')
  })
  console.log('Total leads:', leads.length)
  console.log('Feb 2026 leads:', febLeads.length)
  if (febLeads.length > 0) {
    console.log('\nFebruary leads:')
    febLeads.forEach(l => {
      const d = l.data || {}
      console.log(`  ${d.Date || d.date} - ${d.Name || d.name} at ${d.Company || '(no company)'}`)
    })
  }
  await prisma.$disconnect()
})().catch(console.error)
