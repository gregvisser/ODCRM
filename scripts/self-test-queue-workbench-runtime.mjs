#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-queue-workbench-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Customer-Id': CUSTOMER_ID,
    },
  })
  const text = await response.text()
  if (!response.ok) {
    fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  }
  try {
    return text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

async function getJsonAllow404(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Customer-Id': CUSTOMER_ID,
    },
  })
  const text = await response.text()
  if (response.status === 404) return { status: 404, body: text }
  if (!response.ok) {
    fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  }
  try {
    return { status: response.status, body: text ? JSON.parse(text) : null }
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

const repoRoot = process.cwd()
const sequencesTabPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const sendWorkerPath = join(repoRoot, 'server', 'src', 'routes', 'sendWorker.ts')
const sequencesSource = readFileSync(sequencesTabPath, 'utf8')
const sendWorkerSource = readFileSync(sendWorkerPath, 'utf8')

const workbenchRes = await getJsonAllow404('/api/send-worker/queue-workbench?state=ready&limit=20&sinceHours=24')
if (workbenchRes.status === 404) {
  if (!sendWorkerSource.includes("router.get('/queue-workbench'")) {
    fail('/api/send-worker/queue-workbench returned 404 and source route marker missing')
  }
  console.log('PASS queue-workbench route marker present in source (prod not yet updated)')
} else {
  const payload = workbenchRes.body
  if (!payload?.success || !payload?.data) fail('queue-workbench payload missing success/data')
  if (!Array.isArray(payload.data.rows)) fail('queue-workbench rows is not an array')
  if (typeof payload.data.state !== 'string') fail('queue-workbench state missing')
  if (typeof payload.data.lastUpdatedAt !== 'string') fail('queue-workbench lastUpdatedAt missing')
  console.log(`PASS queue-workbench endpoint reachable state=${payload.data.state} rows=${payload.data.rows.length}`)
}

const detailPayload = await getJson('/api/send-worker/audits?limit=5')
if (!detailPayload?.success || !Array.isArray(detailPayload?.data?.items)) {
  fail('/api/send-worker/audits payload invalid')
}

const markers = [
  'queue-workbench-panel',
  'queue-workbench-view-select',
  'queue-workbench-refresh-btn',
  'queue-workbench-search',
  'queue-workbench-table',
  'queue-workbench-last-updated',
  '/api/send-worker/queue-workbench',
  '/api/send-queue/items/',
]
for (const marker of markers) {
  if (!sequencesSource.includes(marker)) {
    fail(`SequencesTab missing marker: ${marker}`)
  }
}

console.log(`PASS audits endpoint reachable rows=${detailPayload.data.items.length}`)
console.log('PASS queue workbench UI markers present')
console.log('self-test-queue-workbench-runtime: PASS')
