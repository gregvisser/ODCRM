#!/usr/bin/env node
/**
 * verifyLeadSourcesTables.cjs
 * Verifies that lead_source_sheet_configs and lead_source_row_seen exist and are queryable.
 * Run from server/: node scripts/verifyLeadSourcesTables.cjs
 * Exit 0 if both counts succeed; 1 on error.
 */

const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const configCount = await prisma.leadSourceSheetConfig.count()
    const rowSeenCount = await prisma.leadSourceRowSeen.count()
    console.log('lead_source_sheet_configs count:', configCount)
    console.log('lead_source_row_seen count:', rowSeenCount)
    console.log('OK: both tables exist and are queryable.')
    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
