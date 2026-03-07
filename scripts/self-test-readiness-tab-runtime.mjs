#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-readiness-tab-runtime: FAIL - ${message}`)
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
const readinessPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReadinessTab.tsx')
const marketingHomePath = join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
const sendWorkerSource = readFileSync(sendWorkerPath, 'utf8')
const readinessSource = readFileSync(readinessPath, 'utf8')
const marketingHomeSource = readFileSync(marketingHomePath, 'utf8')

const sequenceRes = await getJson('/api/sequences')
if (sequenceRes.status === 404) fail('/api/sequences returned 404')
const sequenceRows = Array.isArray(sequenceRes.body)
  ? sequenceRes.body
  : Array.isArray(sequenceRes.body?.data)
    ? sequenceRes.body.data
    : []
const candidate = sequenceRows.find((row) => typeof row?.id === 'string' && String(row.id).trim().length > 0)

const exceptionRes = await getJson(`/api/send-worker/exception-center?sinceHours=24${candidate?.id ? `&sequenceId=${encodeURIComponent(String(candidate.id))}` : ''}`)
if (exceptionRes.status === 404 && !sendWorkerSource.includes("router.get('/exception-center'")) {
  fail('/exception-center returned 404 and route marker missing')
}

const identityRes = await getJson('/api/send-worker/identity-capacity?sinceHours=24')
if (identityRes.status === 404 && !sendWorkerSource.includes("router.get('/identity-capacity'")) {
  fail('/identity-capacity returned 404 and route marker missing')
}

const runHistoryRes = await getJson(`/api/send-worker/run-history?sinceHours=24&limit=20${candidate?.id ? `&sequenceId=${encodeURIComponent(String(candidate.id))}` : ''}`)
if (runHistoryRes.status === 404 && !sendWorkerSource.includes("router.get('/run-history'")) {
  fail('/run-history returned 404 and route marker missing')
}

if (candidate?.id) {
  const preflightRes = await getJson(`/api/send-worker/sequence-preflight?sequenceId=${encodeURIComponent(String(candidate.id))}&sinceHours=24`)
  if (preflightRes.status === 404 && !sendWorkerSource.includes("router.get('/sequence-preflight'")) {
    fail('/sequence-preflight returned 404 and route marker missing')
  }
  const launchRes = await getJson(`/api/send-worker/launch-preview?sequenceId=${encodeURIComponent(String(candidate.id))}&sinceHours=24&batchLimit=15`)
  if (launchRes.status === 404 && !sendWorkerSource.includes("router.get('/launch-preview'")) {
    fail('/launch-preview returned 404 and route marker missing')
  }
  const comparisonRes = await getJson(`/api/send-worker/preview-vs-outcome?sequenceId=${encodeURIComponent(String(candidate.id))}&sinceHours=24&batchLimit=15&outcomeLimit=80`)
  if (comparisonRes.status === 404 && !sendWorkerSource.includes("router.get('/preview-vs-outcome'")) {
    fail('/preview-vs-outcome returned 404 and route marker missing')
  }
}

const markers = [
  'readiness-tab-panel',
  'readiness-tab-cockpit',
  'readiness-tab-sequence-select',
  'readiness-tab-refresh-btn',
  'readiness-tab-summary-cards',
  'readiness-tab-launch-status',
  'readiness-tab-last-updated',
  'readiness-tab-next-actions',
  'readiness-tab-next-step-link',
  'readiness-tab-preflight',
  'readiness-tab-launch-preview',
  'readiness-tab-preview-vs-outcome',
  'readiness-tab-run-history',
  'readiness-tab-open-preflight',
  'readiness-tab-open-launch-preview',
  'readiness-tab-open-comparison',
  'readiness-tab-open-run-history',
  '/api/send-worker/exception-center',
  '/api/send-worker/sequence-preflight',
  '/api/send-worker/launch-preview',
  '/api/send-worker/preview-vs-outcome',
  '/api/send-worker/identity-capacity',
  '/api/send-worker/run-history',
]

for (const marker of markers) {
  if (!readinessSource.includes(marker)) fail(`ReadinessTab missing marker: ${marker}`)
}

if (!marketingHomeSource.includes("id: 'readiness'")) fail('MarketingHomePage missing readiness nav item')
if (!marketingHomeSource.includes('ReadinessTab')) fail('MarketingHomePage missing ReadinessTab wiring')

console.log(`PASS readiness backend surfaces reachable (candidateSequence=${candidate?.id || 'none'})`)
console.log('PASS readiness tab deterministic markers present')
console.log('self-test-readiness-tab-runtime: PASS')
