#!/usr/bin/env node
/**
 * Self-test: Stage 2C — ops metrics report with output file.
 * Requires: ODCRM_TEST_ADMIN_SECRET, ODCRM_TEST_CUSTOMER_IDS (or ODCRM_TEST_CUSTOMER_IDS_FILE).
 * Runs report with ODCRM_OUTPUT=json and ODCRM_OUTPUT_FILE to a temp path; asserts exit 0, file exists, valid JSON with items and totals.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const reportScript = join(__dirname, 'send-queue-metrics-report.mjs')

const SECRET = process.env.ODCRM_TEST_ADMIN_SECRET?.trim()
const CUSTOMER_IDS = process.env.ODCRM_TEST_CUSTOMER_IDS?.trim()
const CUSTOMER_IDS_FILE = process.env.ODCRM_TEST_CUSTOMER_IDS_FILE?.trim()
const API_BASE = process.env.ODCRM_METRICS_API_BASE || process.env.ODCRM_API_BASE_URL || ''

function fail(msg) {
  console.error('self-test-send-queue-metrics-stage2c: FAIL')
  console.error('  ', msg)
  process.exit(1)
}

if (!SECRET) fail('ODCRM_TEST_ADMIN_SECRET is required')
if (!CUSTOMER_IDS && !CUSTOMER_IDS_FILE) fail('ODCRM_TEST_CUSTOMER_IDS or ODCRM_TEST_CUSTOMER_IDS_FILE is required')

const outputPath = join(os.tmpdir(), `send-queue-metrics-stage2c-${Date.now()}.json`)

async function main() {
  const env = {
    ...process.env,
    ODCRM_ADMIN_SECRET: SECRET,
    ODCRM_OUTPUT: 'json',
    ODCRM_OUTPUT_FILE: outputPath,
  }
  if (CUSTOMER_IDS) env.ODCRM_CUSTOMER_IDS = CUSTOMER_IDS
  if (CUSTOMER_IDS_FILE) env.ODCRM_CUSTOMER_IDS_FILE = CUSTOMER_IDS_FILE
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

  if (!fs.existsSync(outputPath)) {
    fail(`output file not created: ${outputPath}`)
  }

  let content
  try {
    content = fs.readFileSync(outputPath, 'utf8')
  } catch (e) {
    fail(`read output file: ${e instanceof Error ? e.message : String(e)}`)
  }

  let parsed
  try {
    parsed = JSON.parse(content)
  } catch (e) {
    fail('Output file is not valid JSON: ' + (e && e.message))
  }

  if (!Array.isArray(parsed?.items)) {
    fail('JSON must have "items" array')
  }
  if (typeof parsed.totals !== 'object' || parsed.totals === null) {
    fail('JSON must have "totals" object')
  }

  try {
    fs.unlinkSync(outputPath)
  } catch {
    // ignore cleanup
  }

  console.log('self-test-send-queue-metrics-stage2c: PASS')
  console.log('  items:', parsed.items.length, 'totals: present')
  process.exit(0)
}

main().catch((err) => {
  console.error('self-test-send-queue-metrics-stage2c: FAIL')
  console.error(err)
  process.exit(1)
})
