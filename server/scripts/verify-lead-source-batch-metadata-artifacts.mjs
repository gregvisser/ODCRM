/**
 * Static guard: migration recovery + workflow must not re-mark batch metadata as applied without deploy.
 * No DATABASE_URL required.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function fail(msg) {
  console.error('❌', msg)
  process.exit(1)
}

const schema = fs.readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8')
if (!schema.includes('model LeadSourceBatchMetadata') || !schema.includes('@@map("lead_source_batch_metadata")')) {
  fail('schema.prisma must define LeadSourceBatchMetadata -> lead_source_batch_metadata')
}

const ensureDir = path.join(root, 'prisma', 'migrations', '20260320100000_ensure_lead_source_batch_metadata_table')
const ensureSql = fs.readFileSync(path.join(ensureDir, 'migration.sql'), 'utf8')
if (!ensureSql.includes('CREATE TABLE IF NOT EXISTS "lead_source_batch_metadata"')) {
  fail('ensure migration must contain idempotent CREATE TABLE IF NOT EXISTS')
}

const workflowPath = path.join(root, '..', '.github', 'workflows', 'deploy-backend-azure.yml')
const wf = fs.readFileSync(workflowPath, 'utf8')
if (wf.includes('migrate resolve --applied "20260318100000_add_lead_source_batch_metadata"')) {
  fail('deploy-backend-azure.yml must not migrate resolve --applied the batch metadata migration (skips SQL)')
}

console.log('✅ Lead source batch metadata artifacts OK')
