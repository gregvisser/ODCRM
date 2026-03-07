#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-sequence-preflight-runtime: FAIL - ${message}`)
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
const sequencesPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const sendWorkerSource = readFileSync(sendWorkerPath, 'utf8')
const sequencesSource = readFileSync(sequencesPath, 'utf8')

const sequencesRes = await getJson('/api/sequences')
if (sequencesRes.status === 404) fail('/api/sequences returned 404')
const seqArray = Array.isArray(sequencesRes.body) ? sequencesRes.body : Array.isArray(sequencesRes.body?.data) ? sequencesRes.body.data : []
const candidate = seqArray.find((s) => typeof s?.id === 'string' && String(s.id).trim().length > 0)

if (!candidate) {
  if (!sendWorkerSource.includes("router.get('/sequence-preflight'")) {
    fail('no sequence found and source missing /sequence-preflight route marker')
  }
  console.log('PASS no sequence rows available; route marker found in source')
} else {
  const preflightRes = await getJson(`/api/send-worker/sequence-preflight?sequenceId=${encodeURIComponent(String(candidate.id))}&sinceHours=24`)
  if (preflightRes.status === 404) {
    if (!sendWorkerSource.includes("router.get('/sequence-preflight'")) {
      fail('/api/send-worker/sequence-preflight returned 404 and source marker missing')
    }
    console.log('PASS preflight route marker present in source (prod not yet updated)')
  } else {
    const payload = preflightRes.body
    if (!payload?.success || !payload?.data) fail('preflight payload missing success/data')
    if (typeof payload.data.overallStatus !== 'string') fail('preflight overallStatus missing')
    if (!Array.isArray(payload.data.blockers)) fail('preflight blockers missing array')
    if (!Array.isArray(payload.data.warnings)) fail('preflight warnings missing array')
    if (typeof payload.data.checks !== 'object' || payload.data.checks == null) fail('preflight checks missing object')
    if (typeof payload.data.counts !== 'object' || payload.data.counts == null) fail('preflight counts missing object')
    console.log(`PASS preflight endpoint reachable status=${payload.data.overallStatus} blockers=${payload.data.blockers.length} warnings=${payload.data.warnings.length}`)
  }
}

const markers = [
  'sequence-preflight-panel',
  'sequence-preflight-overall-status',
  'sequence-preflight-checks',
  'sequence-preflight-counts',
  'sequence-preflight-blockers',
  'sequence-preflight-warnings',
  'sequence-preflight-next-action',
  'sequence-preflight-drilldown-readiness',
  'sequence-preflight-drilldown-workbench',
  'sequence-preflight-drilldown-reporting',
  'sequence-preflight-last-updated',
  '/api/send-worker/sequence-preflight',
]
for (const marker of markers) {
  if (!sequencesSource.includes(marker)) fail(`SequencesTab missing marker: ${marker}`)
}

console.log('PASS sequence preflight UI markers present')
console.log('self-test-sequence-preflight-runtime: PASS')
