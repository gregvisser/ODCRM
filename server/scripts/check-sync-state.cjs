require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
process.env.DATABASE_URL = "postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require"
const prisma = new PrismaClient()

;(async () => {
  const ocs = await prisma.customer.findFirst({ where: { name: { contains: 'OCS' } } })
  
  const syncState = await prisma.leadSyncState.findUnique({
    where: { customerId: ocs.id }
  })

  console.log('\n📊 OCS SYNC STATE:\n')
  console.log('Customer:', ocs.name)
  console.log('Customer ID:', ocs.id)
  console.log('\nSync State:')
  console.log('  Is Running:', syncState?.isRunning || false)
  console.log('  Last Sync At:', syncState?.lastSyncAt || '(never)')
  console.log('  Last Error:', syncState?.lastError || '(none)')
  console.log('  Last Error At:', syncState?.lastErrorAt || '(none)')
  console.log('  Lead Count:', syncState?.leadCount || 0)
  console.log('  Last Successful Sync:', syncState?.lastSuccessfulSync || '(never)')

  await prisma.$disconnect()
})().catch(console.error)
