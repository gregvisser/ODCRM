#!/usr/bin/env node
/**
 * Fails deploy if lead_source_batch_metadata is missing (Lead Sources batch UI / leadSources routes).
 * Run after `prisma migrate deploy` in CI.
 */
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const rows = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'lead_source_batch_metadata'
    `
    if (!rows?.length) {
      console.error('❌ Missing table public.lead_source_batch_metadata (Lead Sources batch metadata).')
      process.exit(1)
    }
    console.log('✅ Table lead_source_batch_metadata exists')
    process.exit(0)
  } catch (e) {
    console.error('❌ verify-lead-source-batch-metadata-table failed:', e?.message || e)
    process.exit(1)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
