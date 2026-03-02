#!/usr/bin/env node
/**
 * Self-test: Stage 2D — workflow and customer list sanity.
 * Validates: customer list file exists and has at least one non-comment line;
 * workflow file references ODCRM_CUSTOMER_IDS_FILE and ODCRM_OUTPUT_FILE.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const customerListPath = path.join(rootDir, 'docs', 'ops', 'send-queue-metrics-customers.txt')
const workflowPath = path.join(rootDir, '.github', 'workflows', 'send-queue-metrics-monitor.yml')

function fail(msg) {
  console.error('self-test-send-queue-metrics-workflow-stage2d: FAIL')
  console.error('  ', msg)
  process.exit(1)
}

function main() {
  if (!fs.existsSync(customerListPath)) {
    fail(`Customer list file not found: ${customerListPath}`)
  }
  const content = fs.readFileSync(customerListPath, 'utf8')
  const lines = content.split(/\r?\n/)
  const nonComment = lines.filter((line) => {
    const t = line.trim()
    return t && !t.startsWith('#')
  })
  const hasIds = nonComment.some((line) => line.split(/[\s,]+/).some((p) => p.trim().length > 0))
  if (!hasIds) {
    fail('Customer list file has no non-comment customer IDs (at least one required)')
  }

  if (!fs.existsSync(workflowPath)) {
    fail(`Workflow file not found: ${workflowPath}`)
  }
  const workflowContent = fs.readFileSync(workflowPath, 'utf8')
  if (!workflowContent.includes('ODCRM_CUSTOMER_IDS_FILE')) {
    fail('Workflow must reference ODCRM_CUSTOMER_IDS_FILE')
  }
  if (!workflowContent.includes('ODCRM_OUTPUT_FILE')) {
    fail('Workflow must reference ODCRM_OUTPUT_FILE')
  }

  console.log('self-test-send-queue-metrics-workflow-stage2d: PASS')
  console.log('  customer list: present with at least one ID')
  console.log('  workflow: references ODCRM_CUSTOMER_IDS_FILE and ODCRM_OUTPUT_FILE')
  process.exit(0)
}

main()
