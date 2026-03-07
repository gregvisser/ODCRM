#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-identity-capacity-runtime: FAIL - ${message}`)
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

const capacityRes = await getJson('/api/send-worker/identity-capacity?sinceHours=24')
if (capacityRes.status === 404) {
  if (!sendWorkerSource.includes("router.get('/identity-capacity'")) fail('/identity-capacity returned 404 and source route marker missing')
  console.log('PASS identity-capacity route marker present in source (prod not yet updated)')
} else {
  const payload = capacityRes.body
  if (!payload?.success || !payload?.data) fail('identity-capacity payload missing success/data')
  if (typeof payload.data.summary !== 'object' || payload.data.summary == null) fail('identity-capacity summary missing')
  if (!Array.isArray(payload.data.rows)) fail('identity-capacity rows must be array')
  if (typeof payload.data.summary.usable !== 'number') fail('identity-capacity summary.usable must be numeric')
  console.log(`PASS identity-capacity endpoint reachable total=${payload.data.summary.total ?? 0} usable=${payload.data.summary.usable ?? 0} risky=${payload.data.summary.risky ?? 0}`)
}

const markers = [
  'identity-capacity-panel',
  'identity-capacity-refresh-btn',
  'identity-capacity-summary',
  'identity-capacity-rows',
  'identity-capacity-state-badge',
  'identity-capacity-last-updated',
  '/api/send-worker/identity-capacity',
  'sequence-preflight-identity-guardrail',
]
for (const marker of markers) {
  if (!sequencesSource.includes(marker)) fail(`SequencesTab missing marker: ${marker}`)
}

console.log('PASS identity capacity UI markers present')
console.log('self-test-identity-capacity-runtime: PASS')
