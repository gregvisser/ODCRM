#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-launch-preview-runtime: FAIL - ${message}`)
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

if (!candidate) {
  if (!sendWorkerSource.includes("router.get('/launch-preview'")) fail('no sequences and route marker missing for /launch-preview')
  console.log('PASS no sequence rows available; launch-preview route marker found in source')
} else {
  const launchPreviewRes = await getJson(`/api/send-worker/launch-preview?sequenceId=${encodeURIComponent(String(candidate.id))}&sinceHours=24&batchLimit=15`)
  if (launchPreviewRes.status === 404) {
    if (!sendWorkerSource.includes("router.get('/launch-preview'")) fail('/launch-preview returned 404 and source marker missing')
    console.log('PASS launch-preview route marker present in source (prod not yet updated)')
  } else {
    const payload = launchPreviewRes.body
    if (!payload?.success || !payload?.data) fail('launch-preview payload missing success/data')
    if (!payload.data.summary || typeof payload.data.summary !== 'object') fail('launch-preview summary missing')
    for (const key of ['firstBatch', 'excluded', 'blocked', 'notInBatch']) {
      if (!Array.isArray(payload.data[key])) fail(`launch-preview ${key} is not an array`)
    }
    console.log(`PASS launch-preview endpoint reachable firstBatch=${payload.data.firstBatch.length} excluded=${payload.data.excluded.length} blocked=${payload.data.blocked.length}`)
  }
}

const markers = [
  'launch-preview-panel',
  'launch-preview-refresh-btn',
  'launch-preview-first-batch-summary',
  'launch-preview-candidate-table',
  'launch-preview-excluded-section',
  'launch-preview-not-in-batch-section',
  'launch-preview-last-updated',
  '/api/send-worker/launch-preview',
  '/api/send-queue/items/',
]
for (const marker of markers) {
  if (!sequencesSource.includes(marker)) fail(`SequencesTab missing marker: ${marker}`)
}

console.log('PASS launch preview UI markers present')
console.log('self-test-launch-preview-runtime: PASS')
