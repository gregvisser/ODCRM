#!/usr/bin/env node
/**
 * Contract: identity-capacity snapshot includes EmailEvent-derived fields for operator health.
 * Regression guard only; no network.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const sendWorker = path.join(root, 'server', 'src', 'routes', 'sendWorker.ts')

function main() {
  if (!fs.existsSync(sendWorker)) {
    console.error('self-test-identity-capacity-snapshot-contract: FAIL — missing', sendWorker)
    process.exit(1)
  }
  const content = fs.readFileSync(sendWorker, 'utf8')
  const must = [
    'lastRecordedOutboundAt',
    'recentCampaignBounces',
    'prisma.emailEvent.groupBy',
    'async function getIdentityCapacitySnapshot',
  ]
  const missing = must.filter((m) => !content.includes(m))
  if (missing.length) {
    console.error('self-test-identity-capacity-snapshot-contract: FAIL — missing:', missing.join(' | '))
    process.exit(1)
  }
  console.log('self-test-identity-capacity-snapshot-contract: OK')
  process.exit(0)
}

main()
