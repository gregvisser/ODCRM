/**
 * One-time backfill: copy leads sheet URL from accountData.clientLeadsSheetUrl
 * into Customer.leadsReportingUrl where the latter is null/empty.
 * Prints counts only (no secrets).
 * Run: node server/scripts/backfillLeadsReportingUrl.cjs
 * Or from server/: node scripts/backfillLeadsReportingUrl.cjs
 */
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function getLegacyUrl(accountData) {
  if (!accountData || typeof accountData !== 'object') return null
  const v = accountData.clientLeadsSheetUrl
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function main() {
  const all = await prisma.customer.findMany({
    select: { id: true, name: true, leadsReportingUrl: true, accountData: true },
  })
  const missing = all.filter(
    (c) =>
      !c.leadsReportingUrl ||
      (typeof c.leadsReportingUrl === 'string' && c.leadsReportingUrl.trim() === '')
  )
  let backfilled = 0
  let skipped = 0
  for (const customer of missing) {
    const legacy = getLegacyUrl(customer.accountData)
    if (!legacy) {
      skipped++
      continue
    }
    await prisma.customer.update({
      where: { id: customer.id },
      data: { leadsReportingUrl: legacy },
    })
    backfilled++
  }
  console.log('Backfill counts: total customers', all.length)
  console.log('Backfill counts: missing leadsReportingUrl', missing.length)
  console.log('Backfill counts: backfilled from accountData', backfilled)
  console.log('Backfill counts: skipped (no legacy URL)', skipped)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
