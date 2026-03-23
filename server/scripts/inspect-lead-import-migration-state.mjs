/**
 * Read-only: _prisma_migrations row + table existence for lead import recovery.
 * Usage: cd server && node scripts/inspect-lead-import-migration-state.mjs
 */
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()
try {
  const rows = await p.$queryRaw`
    SELECT migration_name, finished_at, rolled_back_at, started_at
    FROM _prisma_migrations
    WHERE migration_name = '20260323130000_lead_source_imported_contacts'
  `
  console.log('_prisma_migrations:', JSON.stringify(rows, null, 2))
  const t = await p.$queryRaw`
    SELECT to_regclass('public.lead_source_imported_contacts')::text AS reg
  `
  console.log('lead_source_imported_contacts to_regclass:', JSON.stringify(t))
} finally {
  await p.$disconnect()
}
