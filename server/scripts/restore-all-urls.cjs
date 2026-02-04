// Load environment from .env file
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

// Force use production database
process.env.DATABASE_URL = "postgresql://odcrmadmin:YourStrongPassword123!@odcrm-postgres.postgres.database.azure.com/postgres?sslmode=require"

const prisma = new PrismaClient()

// Mapping of customer names to Google Sheets URLs
const urlMappings = [
  {
    name: 'OCS Group Holdings Ltd',
    url: 'https://docs.google.com/spreadsheets/d/1QlTUdtzqGR2_lHbP2DalTUG9vpg8_K5G40ns4L5CMzw/edit?gid=440825813#gid=440825813'
  },
  {
    name: 'Thomas Franks',
    url: 'https://docs.google.com/spreadsheets/d/1Gv5YBc7FUXFkRB3JDflSVziZcShsgvuSLAYn7D5ZdJY/edit?gid=719959031#gid=719959031'
  },
  {
    name: 'Panda',
    url: 'https://docs.google.com/spreadsheets/d/1yEky2Ri6gefokJIGeYUYgJVPMeXlzNhcG57qDS17Lf8/edit?gid=590540965#gid=590540965'
  },
  {
    name: 'Shield Pest Control UK',
    url: 'https://docs.google.com/spreadsheets/d/1wT_e7EdxcRwzwTek7dp6cJ8OOuRsJnOBWvsNsjLJQM8/edit?gid=482405004#gid=482405004'
  },
  {
    name: 'Be-Safe Technologies Ltd',
    url: 'https://docs.google.com/spreadsheets/d/1NdIzK1-CcRyMH8Pl5Kg4RkE56sVhUhzbqzLpawlR4Sg/edit?gid=1444726914#gid=1444726914'
  },
  {
    name: 'LegionelaSafe Services UK Ltd',
    url: 'https://docs.google.com/spreadsheets/d/1yat8uQsfaqSyu4C6TSbICurSqm-S3gLpvjwVufdvdt8/edit?gid=935693925#gid=935693925'
  },
  {
    name: 'Protech Roofing',
    url: 'https://docs.google.com/spreadsheets/d/1AvBUxkyYHqc_UQLZrCGiqbkSBMRg97jVIDOdlGDHunU/edit?gid=1897691759#gid=1897691759'
  },
  {
    name: 'P&P Morejon FM',
    url: 'https://docs.google.com/spreadsheets/d/1_bt5YEqHm5EbvIj1_68yfqdVILsRbxx6E6wGfrbboU8/edit?gid=1008554480#gid=1008554480'
  },
  {
    name: 'GreenTheUK Limited',
    url: 'https://docs.google.com/spreadsheets/d/1hBR7pfD3pecUnLAtS2LbxXiPh8waJmC2wLr2r2YjAzo/edit?gid=997734087#gid=997734087'
  },
  {
    name: 'Maxspace Projects',
    url: 'https://docs.google.com/spreadsheets/d/1flvGrcuBr6mRLM-vM1lamolKuVRmnAWj248cIIohNoY/edit?gid=1654151342#gid=1654151342'
  },
  {
    name: 'Paratus365',
    url: 'https://docs.google.com/spreadsheets/d/1yJl327dh2GVYhmvdIJMpt-CjVIRYZpvDfsJxVYp_kko/edit?gid=0#gid=0'
  },
  {
    name: 'Octavian Security UK',
    url: 'https://docs.google.com/spreadsheets/d/14uIuR33x5ofjKmQ2JiBd2_81x5IuQLl5BCc4O1lmffo/edit?gid=2099466641#gid=2099466641'
  },
  {
    name: 'Octavian IT Services',
    url: 'https://docs.google.com/spreadsheets/d/1Mne7cdssDXcZbuctvidereMVcOtNJbRPhK6lmMcy6ck/edit?gid=683282199#gid=683282199'
  },
  {
    name: 'Renewable Temporary Power Ltd',
    url: 'https://docs.google.com/spreadsheets/d/1ULdRD35s0BkE9o_9s6ZQQpvm2GaRwnqFik0ktivoiSA/edit?gid=1654759294#gid=1654759294'
  }
]

async function restoreUrls() {
  try {
    console.log('\n🔄 RESTORING GOOGLE SHEETS URLS TO DATABASE\n')
    
    let updated = 0
    let notFound = 0
    const customersToSync = []

    for (const mapping of urlMappings) {
      console.log(`📝 Processing: ${mapping.name}`)
      
      // Find customer by name (case-insensitive)
      const customer = await prisma.customer.findFirst({
        where: {
          name: { equals: mapping.name, mode: 'insensitive' }
        }
      })

      if (!customer) {
        console.log(`   ❌ Customer not found in database`)
        notFound++
        continue
      }

      // Update the URL
      await prisma.customer.update({
        where: { id: customer.id },
        data: { leadsReportingUrl: mapping.url }
      })

      console.log(`   ✅ Updated URL`)
      updated++
      customersToSync.push({ id: customer.id, name: customer.name })
    }

    console.log(`\n📊 SUMMARY:`)
    console.log(`   ✅ Updated: ${updated}`)
    console.log(`   ❌ Not found: ${notFound}`)

    // Now trigger leads sync for all updated customers
    console.log(`\n🔄 TRIGGERING LEADS SYNC FOR ALL CUSTOMERS...\n`)

    const { triggerManualSync } = require('../dist/workers/leadsSync.js')

    for (const customer of customersToSync) {
      console.log(`📥 Syncing leads for ${customer.name}...`)
      try {
        await triggerManualSync(prisma, customer.id)
        console.log(`   ✅ Sync complete`)
      } catch (error) {
        console.error(`   ❌ Sync failed:`, error.message)
      }
    }

    console.log(`\n✨ ALL DONE! Check the Dashboards tab to see the leads.`)

    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

restoreUrls()
