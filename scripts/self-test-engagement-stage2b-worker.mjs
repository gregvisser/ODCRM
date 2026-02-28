#!/usr/bin/env node
/**
 * Self-test: Stage 2B send-queue worker presence — contract doc exists, worker file exists, startup references env gate.
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
    console.error('self-test-engagement-stage2b-worker: FAIL — Stage 2B contract doc not found:', contractPath)
    process.exit(1)
  }

  if (!fs.existsSync(workerPath)) {
    console.error('self-test-engagement-stage2b-worker: FAIL — sendQueueWorker.ts not found:', workerPath)
    process.exit(1)
  }

  const indexContent = fs.readFileSync(indexPath, 'utf8')
  if (!indexContent.includes('ENABLE_SEND_QUEUE_WORKER')) {
    console.error('self-test-engagement-stage2b-worker: FAIL — server startup does not reference ENABLE_SEND_QUEUE_WORKER')
    process.exit(1)
  }

  console.log('self-test-engagement-stage2b-worker: OK')
  process.exit(0)
}

main()
