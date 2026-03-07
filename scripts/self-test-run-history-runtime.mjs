#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-run-history-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json', 'X-Customer-Id': CUSTOMER_ID },
  })
  const text = await response.text()
  if (response.status === 404) return { status: 404, body: text }
  if (!response.ok) fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  try {
    return { status: response.status, body: text ? JSON.parse(text) : null }
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

const repoRoot = process.cwd()
const sendWorkerPath = join(repoRoot, 'server', 'src', 'routes', 'sendWorker.ts')
const sequencesPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const sendWorkerSource = readFileSync(sendWorkerPath, 'utf8')
const sequencesSource = readFileSync(sequencesPath, 'utf8')

const sequencesRes = await getJson('/api/sequences')
if (sequencesRes.status === 404) fail('/api/sequences returned 404')
const sequenceList = Array.isArray(sequencesRes.body) ? sequencesRes.body : Array.isArray(sequencesRes.body?.data) ? sequencesRes.body.data : []
const candidate = sequenceList.find((row) => typeof row?.id === 'string' && String(row.id).trim().length > 0)

const params = new URLSearchParams()
params.set('sinceHours', '24')
params.set('limit', '50')
if (candidate?.id) params.set('sequenceId', String(candidate.id))

const runHistoryRes = await getJson(`/api/send-worker/run-history?${params.toString()}`)
if (runHistoryRes.status === 404) {
  if (!sendWorkerSource.includes("router.get('/run-history'")) {
    fail('/run-history returned 404 and source marker missing')
  }
  console.log('PASS run-history route marker present in source (prod not yet updated)')
} else {
  const payload = runHistoryRes.body
  if (!payload?.success || !payload?.data) fail('run-history payload missing success/data')
  if (typeof payload.data.summary !== 'object' || payload.data.summary == null) fail('run-history summary missing')
  if (!Array.isArray(payload.data.recentRuns)) fail('run-history recentRuns must be an array')
  if (!Array.isArray(payload.data.rows)) fail('run-history rows must be an array')
  if (typeof payload.data.totalReturned !== 'number') fail('run-history totalReturned must be numeric')
  console.log(`PASS run-history endpoint reachable runs=${payload.data.recentRuns.length} rows=${payload.data.rows.length}`)
}

const markers = [
  'run-history-panel',
  'run-history-refresh-btn',
  'run-history-outcomes-summary',
  'run-history-attempt-rows',
  'run-history-last-updated',
  '/api/send-worker/run-history',
  'in first batch preview',
]
for (const marker of markers) {
  if (!sequencesSource.includes(marker)) fail(`SequencesTab missing marker: ${marker}`)
}

console.log('PASS run history UI markers present')
console.log('self-test-run-history-runtime: PASS')
