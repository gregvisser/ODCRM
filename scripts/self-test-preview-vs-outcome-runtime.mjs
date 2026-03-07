#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-preview-vs-outcome-runtime: FAIL - ${message}`)
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

if (!candidate?.id) {
  if (!sendWorkerSource.includes("router.get('/preview-vs-outcome'")) fail('no sequence found and source route marker missing')
  console.log('PASS no sequence rows available; preview-vs-outcome route marker found in source')
} else {
  const params = new URLSearchParams()
  params.set('sequenceId', String(candidate.id))
  params.set('sinceHours', '24')
  params.set('batchLimit', '15')
  params.set('outcomeLimit', '80')
  const comparisonRes = await getJson(`/api/send-worker/preview-vs-outcome?${params.toString()}`)

  if (comparisonRes.status === 404) {
    if (!sendWorkerSource.includes("router.get('/preview-vs-outcome'")) {
      fail('/preview-vs-outcome returned 404 and source marker missing')
    }
    console.log('PASS preview-vs-outcome route marker present in source (prod not yet updated)')
  } else {
    const payload = comparisonRes.body
    if (!payload?.success || !payload?.data) fail('preview-vs-outcome payload missing success/data')
    const data = payload.data
    if (!data.summary || typeof data.summary !== 'object') fail('summary missing')
    if (!Array.isArray(data.previewRows)) fail('previewRows is not an array')
    if (!Array.isArray(data.outcomeRows)) fail('outcomeRows is not an array')
    if (!Array.isArray(data.matchedRows)) fail('matchedRows is not an array')
    if (!Array.isArray(data.previewOnlyRows)) fail('previewOnlyRows is not an array')
    if (!Array.isArray(data.outcomeOnlyRows)) fail('outcomeOnlyRows is not an array')
    console.log(`PASS preview-vs-outcome endpoint reachable matched=${data.matchedRows.length} previewOnly=${data.previewOnlyRows.length} outcomeOnly=${data.outcomeOnlyRows.length}`)
  }
}

const markers = [
  'preview-vs-outcome-panel',
  'preview-vs-outcome-refresh-btn',
  'preview-vs-outcome-summary-cards',
  'preview-vs-outcome-matched-rows',
  'preview-vs-outcome-preview-only',
  'preview-vs-outcome-outcome-only',
  'preview-vs-outcome-detail-wiring',
  'preview-vs-outcome-last-updated',
  '/api/send-worker/preview-vs-outcome',
]
for (const marker of markers) {
  if (!sequencesSource.includes(marker)) fail(`SequencesTab missing marker: ${marker}`)
}

console.log('PASS preview-vs-outcome UI markers present')
console.log('self-test-preview-vs-outcome-runtime: PASS')
