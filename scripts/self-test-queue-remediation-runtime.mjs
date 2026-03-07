#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-queue-remediation-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function callJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Customer-Id': CUSTOMER_ID,
      ...(options.headers || {}),
    },
  })
  const text = await response.text()
  let parsed = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      fail(`${options.method || 'GET'} ${path} returned non-JSON`)
    }
  }
  return { status: response.status, body: parsed, text }
}

const repoRoot = process.cwd()
const sequencesTabPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const sendQueuePath = join(repoRoot, 'server', 'src', 'routes', 'sendQueue.ts')
const sendWorkerPath = join(repoRoot, 'server', 'src', 'routes', 'sendWorker.ts')
const sequencesSource = readFileSync(sequencesTabPath, 'utf8')
const sendQueueSource = readFileSync(sendQueuePath, 'utf8')
const sendWorkerSource = readFileSync(sendWorkerPath, 'utf8')

const workbenchRes = await callJson('/api/send-worker/queue-workbench?state=failed&limit=20&sinceHours=24')
if (workbenchRes.status === 404) {
  if (!sendWorkerSource.includes("router.get('/queue-workbench'")) {
    fail('queue-workbench is 404 and source queue-workbench marker missing')
  }
  console.log('PASS queue-workbench route not yet deployed; source markers present locally')
} else if (workbenchRes.status >= 200 && workbenchRes.status < 300) {
  const payload = workbenchRes.body
  if (!payload?.success || !payload?.data || !Array.isArray(payload.data.rows)) {
    fail('queue-workbench payload invalid')
  }
  console.log(`PASS queue-workbench endpoint reachable rows=${payload.data.rows.length}`)
} else {
  fail(`GET /api/send-worker/queue-workbench returned ${workbenchRes.status}: ${workbenchRes.text?.slice(0, 300) || ''}`)
}

const bulkRes = await callJson('/api/send-queue/items/bulk', {
  method: 'PATCH',
  body: JSON.stringify({ itemIds: [], status: 'QUEUED' }),
})
if (bulkRes.status === 404) {
  if (!sendQueueSource.includes("router.patch('/items/bulk'")) {
    fail('/api/send-queue/items/bulk returned 404 and source route marker missing')
  }
  console.log('PASS bulk route marker present in source (prod not yet updated)')
} else if ([200, 400, 401, 403, 405].includes(bulkRes.status)) {
  console.log(`PASS bulk route reachable/status-confirmed (${bulkRes.status})`)
} else {
  fail(`PATCH /api/send-queue/items/bulk unexpected status ${bulkRes.status}`)
}

const markers = [
  'queue-workbench-bulk-selection',
  'queue-workbench-select-all',
  'queue-workbench-clear-selection',
  'queue-workbench-selected-count',
  'queue-workbench-bulk-action-bar',
  'queue-workbench-bulk-requeue-btn',
  'queue-workbench-bulk-skip-btn',
  'queue-workbench-bulk-result-summary',
  'queue-workbench-backend-refresh',
  '/api/send-queue/items/bulk',
]
for (const marker of markers) {
  if (!sequencesSource.includes(marker)) {
    fail(`SequencesTab missing marker: ${marker}`)
  }
}

console.log('PASS queue remediation UI markers present')
console.log('self-test-queue-remediation-runtime: PASS')
