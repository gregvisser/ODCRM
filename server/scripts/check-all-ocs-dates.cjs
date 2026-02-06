require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
process.env.DATABASE_URL = "postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require"
const prisma = new PrismaClient()

;(async () => {
  const ocs = await prisma.customer.findFirst({ where: { name: { contains: 'OCS' } } })
  const leads = await prisma.leadRecord.findMany({ 
    where: { customerId: ocs.id },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`\n📊 ALL OCS LEADS (${leads.length} total):\n`)
  
  leads.forEach((lead, idx) => {
    const d = lead.data || {}
    const date = d.Date || d.date || d['First Meeting Date'] || '(no date)'
    const name = d.Name || d.name || '(no name)'
    const company = d.Company || d.company || '(no company)'
    const week = d.Week || d.week || ''
    
    console.log(`${idx + 1}. ${date} - ${name} at ${company} [Week: ${week}]`)
  })
  
  // Check for February specifically
  const febLeads = leads.filter(l => {
    const d = l.data || {}
    const dateStr = String(d.Date || d.date || d['First Meeting Date'] || '')
    // Check for 2026-02- (ISO format) or 02.26 or /02/26
    return dateStr.includes('2026-02') || dateStr.includes('02.26') || dateStr.includes('/02/26') || dateStr.includes('02/2026')
  })
  
  console.log(`\n🎯 FEBRUARY 2026 LEADS: ${febLeads.length}`)
  
  if (febLeads.length > 0) {
    console.log('\nFebruary leads:')
    febLeads.forEach(l => {
      const d = l.data || {}
      console.log(`  ${d.Date || d.date} - ${d.Name || d.name} at ${d.Company}`)
    })
  }
  
  await prisma.$disconnect()
})().catch(console.error)
