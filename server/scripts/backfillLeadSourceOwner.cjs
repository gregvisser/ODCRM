/**
 * One-time backfill: set LeadRecord.source and LeadRecord.owner from data JSON
 * when they are null/empty, so dashboards show Channels and OD Team.
 * Derives from: source -> Channel of Lead, Channel, Source, Lead Source, Campaign
 *               owner -> OD Team Member, Owner, User, Rep, Agent, Assigned To
 * Run: node server/scripts/backfillLeadSourceOwner.cjs (from repo root)
 * Or: cd server && node scripts/backfillLeadSourceOwner.cjs
 * Prints counts only (no secrets).
 */
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const SOURCE_KEYS = ['Channel of Lead', 'Channel', 'Source', 'Lead Source', 'Campaign', 'UTM Source', 'Marketing Channel']
const OWNER_KEYS = ['OD Team Member', 'OD Team', 'Owner', 'User', 'Rep', 'Agent', 'Assigned To', 'Salesperson']

function getFirstNonEmpty(data, keys) {
  if (!data || typeof data !== 'object') return null
  for (const k of keys) {
    const v = data[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return null
}

async function main() {
  const records = await prisma.leadRecord.findMany({
    select: { id: true, customerId: true, source: true, owner: true, data: true },
  })
  let sourceUpdated = 0
  let ownerUpdated = 0
  for (const rec of records) {
    const data = rec.data && typeof rec.data === 'object' ? rec.data : {}
    let update = {}
    const needSource = rec.source == null || String(rec.source).trim() === ''
    const needOwner = rec.owner == null || String(rec.owner).trim() === ''
    if (needSource) {
      const derived = getFirstNonEmpty(data, SOURCE_KEYS)
      if (derived) {
        update.source = derived
        sourceUpdated++
      }
    }
    if (needOwner) {
      const derived = getFirstNonEmpty(data, OWNER_KEYS)
      if (derived) {
        update.owner = derived
        ownerUpdated++
      }
    }
    if (Object.keys(update).length > 0) {
      await prisma.leadRecord.update({
        where: { id: rec.id },
        data: update,
      })
    }
  }
  console.log('Backfill LeadRecord source/owner counts: total records', records.length)
  console.log('Backfill LeadRecord source/owner counts: source updated', sourceUpdated)
  console.log('Backfill LeadRecord source/owner counts: owner updated', ownerUpdated)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
