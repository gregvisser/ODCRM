/**
 * Quarterly About Section Enrichment Worker
 * Re-enriches company About data for customers whose lastEnrichedAt is older than 90 days
 */

import cron from 'node-cron'
import type { PrismaClient } from '@prisma/client'
import { enrichCompanyAbout } from '../services/aboutEnrichment.js'

/**
 * Background worker that runs daily to check for customers needing About refresh
 * Only enriches customers whose lastEnrichedAt is older than 90 days
 */
export function startAboutEnrichmentWorker(prisma: PrismaClient) {
  // Run daily at 2 AM
  const cronExpression = process.env.ABOUT_ENRICHMENT_CRON || '0 2 * * *'

  cron.schedule(cronExpression, async () => {
    try {
      await processQuarterlyEnrichment(prisma)
    } catch (error) {
      console.error('Error in About enrichment worker:', error)
    }
  })

  console.log(`✅ About enrichment worker started (${cronExpression})`)
}

async function processQuarterlyEnrichment(prisma: PrismaClient) {
  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // Find customers that need enrichment:
  // 1. Have a website or domain
  // 2. Either have never been enriched (lastEnrichedAt is null) OR last enriched more than 90 days ago
  const customersToEnrich = await prisma.customer.findMany({
    where: {
      AND: [
        {
          OR: [
            { website: { not: null } },
            { domain: { not: null } },
          ],
        },
        {
          OR: [
            { lastEnrichedAt: null },
            { lastEnrichedAt: { lt: ninetyDaysAgo } },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      website: true,
      domain: true,
    },
  })

  if (customersToEnrich.length === 0) {
    console.log('📊 No customers need About enrichment refresh')
    return
  }

  console.log(`📊 Starting quarterly About enrichment for ${customersToEnrich.length} customers...`)

  let successCount = 0
  let errorCount = 0

  for (const customer of customersToEnrich) {
    try {
      const website = customer.website || customer.domain
      if (!website) {
        console.warn(`⚠️  Skipping ${customer.name} (no website/domain)`)
        continue
      }

      const result = await enrichCompanyAbout(prisma, customer.id, customer.name, website)
      if (result) {
        successCount++
        console.log(`✅ Enriched About data for ${customer.name}`)
      } else {
        errorCount++
        console.warn(`⚠️  Failed to enrich About data for ${customer.name}`)
      }

      // Add a small delay to avoid overwhelming the LLM endpoint
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      errorCount++
      console.error(`❌ Error enriching ${customer.name}:`, error)
    }
  }

  console.log(
    `📊 Quarterly About enrichment completed: ${successCount} succeeded, ${errorCount} failed`
  )
}
