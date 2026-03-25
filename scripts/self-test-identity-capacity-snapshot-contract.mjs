#!/usr/bin/env node
/**
 * Contract: identity-capacity snapshot includes EmailEvent-derived fields; UI uses source-honest labels.
 * Regression guard only; no network.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const sendWorker = path.join(root, 'server', 'src', 'routes', 'sendWorker.ts')
const enhancedTab = path.join(root, 'src', 'components', 'EmailAccountsEnhancedTab.tsx')
const marketingTab = path.join(root, 'src', 'tabs', 'marketing', 'components', 'EmailAccountsTab.tsx')

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

  const honest = 'Last recorded campaign send'
  for (const [label, p] of [
    ['EmailAccountsEnhancedTab', enhancedTab],
    ['EmailAccountsTab', marketingTab],
  ]) {
    if (!fs.existsSync(p)) {
      console.error('self-test-identity-capacity-snapshot-contract: FAIL — missing', p)
      process.exit(1)
    }
    const ui = fs.readFileSync(p, 'utf8')
    if (!ui.includes(honest)) {
      console.error(`self-test-identity-capacity-snapshot-contract: FAIL — ${label} must include "${honest}"`)
      process.exit(1)
    }
    if (ui.includes('<Th>Last recorded send</Th>')) {
      console.error(`self-test-identity-capacity-snapshot-contract: FAIL — ${label} must not use vague "Last recorded send" header`)
      process.exit(1)
    }
  }
  console.log('self-test-identity-capacity-snapshot-contract: OK')
  process.exit(0)
}

main()
