#!/usr/bin/env node
/**
 * Self-test: Stage 2B — ops metrics report script.
 * Requires: ODCRM_TEST_ADMIN_SECRET, ODCRM_TEST_CUSTOMER_IDS (comma-separated).
 * Runs the report script in JSON mode and asserts output is valid JSON with countsByStatus and dueNow per item.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const reportScript = join(__dirname, 'send-queue-metrics-report.mjs')

const SECRET = process.env.ODCRM_TEST_ADMIN_SECRET?.trim()
const CUSTOMER_IDS = process.env.ODCRM_TEST_CUSTOMER_IDS?.trim()
const API_BASE = process.env.ODCRM_METRICS_API_BASE || process.env.ODCRM_API_BASE_URL || ''

function fail(msg) {
  console.error('self-test-send-queue-metrics-stage2b: FAIL')
  console.error('  ', msg)
  process.exit(1)
}

if (!SECRET) fail('ODCRM_TEST_ADMIN_SECRET is required')
if (!CUSTOMER_IDS) fail('ODCRM_TEST_CUSTOMER_IDS is required (comma-separated)')

async function main() {
  const env = {
    ...process.env,
    ODCRM_ADMIN_SECRET: SECRET,
    ODCRM_CUSTOMER_IDS: CUSTOMER_IDS,
    ODCRM_OUTPUT: 'json',
  }
  if (API_BASE) env.ODCRM_METRICS_API_BASE = API_BASE

  const child = spawn(process.execPath, [reportScript], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const code = await new Promise((resolve) => child.on('close', resolve))
  if (code !== 0) {
    console.error('  stdout:', stdout)
    console.error('  stderr:', stderr)
    fail(`report script exited ${code}`)
  }
  let parsed
  try {
    parsed = JSON.parse(stdout.trim())
  } catch (e) {
    console.error('  stdout:', stdout)
    fail('Output is not valid JSON: ' + (e && e.message))
  }
  const items = parsed?.items
  if (!Array.isArray(items)) {
    fail('JSON must have "items" array')
  }
  for (const item of items) {
    if (typeof item.countsByStatus !== 'object' || item.countsByStatus === null) {
      fail(`Item ${item.customerId || '?'} missing countsByStatus`)
    }
    if (typeof item.dueNow !== 'number') {
      fail(`Item ${item.customerId || '?'} missing or invalid dueNow`)
    }
  }
  console.log('self-test-send-queue-metrics-stage2b: PASS')
  console.log('  items:', items.length, 'totals:', parsed.totals ? 'present' : 'n/a')
  process.exit(0)
}

main().catch((err) => {
  console.error('self-test-send-queue-metrics-stage2b: FAIL')
  console.error(err)
  process.exit(1)
})
