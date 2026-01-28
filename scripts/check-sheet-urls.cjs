const { PrismaClient } = require('../server/node_modules/@prisma/client')

async function checkSheetUrls() {
  const prisma = new PrismaClient()
  
  try {
    console.log('\n🔍 Checking Google Sheet URLs in database...\n')
    
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        leadsReportingUrl: true,
      },
      orderBy: { name: 'asc' }
    })
    
    console.log(`Found ${customers.length} customers:\n`)
    
    customers.forEach(customer => {
      const hasUrl = customer.leadsReportingUrl ? '✅' : '❌'
      console.log(`${hasUrl} ${customer.name}`)
      if (customer.leadsReportingUrl) {
        console.log(`   URL: ${customer.leadsReportingUrl.substring(0, 80)}...`)
      }
      console.log()
    })
    
    // Specifically check for the 3 problem accounts
    const problemAccounts = [
      'Octavian Security UK',
      'Octavian IT Services', 
      'Renewable Temporary Power Ltd'
    ]
    
    console.log('\n⚠️  Checking problem accounts:\n')
    
    for (const name of problemAccounts) {
      const customer = await prisma.customer.findFirst({
        where: { 
          name: { 
            contains: name.split(' ')[0], // Search by first word
            mode: 'insensitive' 
          } 
        }
      })
      
      if (customer) {
        console.log(`Found: ${customer.name}`)
        console.log(`  ID: ${customer.id}`)
        console.log(`  URL: ${customer.leadsReportingUrl || 'MISSING'}`)
        console.log()
      } else {
        console.log(`NOT FOUND: ${name}`)
        console.log()
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSheetUrls()
