#!/usr/bin/env node
/**
 * Self-test: Stage 2B live sending — contract doc exists, worker has kill-switch + canary gating, startup defaults safe.
 * Regression guard only; no network.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const contractPath = path.join(root, 'docs', 'product', 'ENGAGEMENT_PIPELINE_STAGE2B_LIVE_SENDING.md')
const workerPath = path.join(root, 'server', 'src', 'workers', 'sendQueueWorker.ts')
const indexPath = path.join(root, 'server', 'src', 'index.ts')

function main() {
  if (!fs.existsSync(contractPath)) {
    console.error('self-test-engagement-stage2b-live-sending: FAIL — Stage 2B contract doc not found:', contractPath)
    process.exit(1)
  }

  if (!fs.existsSync(workerPath)) {
    console.error('self-test-engagement-stage2b-live-sending: FAIL — sendQueueWorker.ts not found:', workerPath)
    process.exit(1)
  }

  const workerContent = fs.readFileSync(workerPath, 'utf8')
  if (!workerContent.includes('ENABLE_LIVE_SENDING')) {
    console.error('self-test-engagement-stage2b-live-sending: FAIL — worker does not gate on ENABLE_LIVE_SENDING')
    process.exit(1)
  }
  if (!workerContent.includes('SEND_CANARY_CUSTOMER_ID')) {
    console.error('self-test-engagement-stage2b-live-sending: FAIL — worker does not reference SEND_CANARY_CUSTOMER_ID')
    process.exit(1)
  }
  if (!workerContent.includes('SEND_CANARY_IDENTITY_ID')) {
    console.error('self-test-engagement-stage2b-live-sending: FAIL — worker does not reference SEND_CANARY_IDENTITY_ID')
    process.exit(1)
  }

  const indexContent = fs.readFileSync(indexPath, 'utf8')
  if (!indexContent.includes('ENABLE_SEND_QUEUE_WORKER')) {
    console.error('self-test-engagement-stage2b-live-sending: FAIL — server startup does not reference ENABLE_SEND_QUEUE_WORKER')
    process.exit(1)
  }
  if (!indexContent.includes("'true'") && !indexContent.includes('"true"')) {
    // Startup should only start worker when env === 'true' (safe default)
    console.error('self-test-engagement-stage2b-live-sending: FAIL — startup must gate worker on explicit true')
    process.exit(1)
  }

  console.log('self-test-engagement-stage2b-live-sending: OK')
  process.exit(0)
}

main()
