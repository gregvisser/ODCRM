#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-sequences-tab-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJsonAllow404(path) {
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

const sequencesRes = await getJsonAllow404('/api/sequences')
if (sequencesRes.status === 404) fail('/api/sequences returned 404')
const sequenceList = Array.isArray(sequencesRes.body)
  ? sequencesRes.body
  : Array.isArray(sequencesRes.body?.data)
    ? sequencesRes.body.data
    : []

const candidate = sequenceList.find((row) => typeof row?.id === 'string' && String(row.id).trim())
if (candidate) {
  const seqId = encodeURIComponent(String(candidate.id))
  const checks = [
    `/api/send-worker/sequence-preflight?sequenceId=${seqId}&sinceHours=24`,
    `/api/send-worker/launch-preview?sequenceId=${seqId}&sinceHours=24&batchLimit=15`,
    `/api/send-worker/run-history?sequenceId=${seqId}&sinceHours=48&limit=50`,
    `/api/send-worker/preview-vs-outcome?sequenceId=${seqId}&sinceHours=48&batchLimit=25`,
    `/api/send-worker/queue-workbench?sequenceId=${seqId}&sinceHours=48&view=ready&limit=20`,
  ]
  for (const path of checks) {
    const res = await getJsonAllow404(path)
    if (res.status === 404) fail(`${path} returned 404`)
  }
  console.log(`PASS sequences-integrated endpoints reachable for sequenceId=${candidate.id}`)
} else {
  const fallbackChecks = [
    '/api/send-worker/console?windowHours=24',
    '/api/send-worker/identity-capacity?sinceHours=48',
    '/api/send-worker/exception-center?sinceHours=48',
  ]
  for (const path of fallbackChecks) {
    const res = await getJsonAllow404(path)
    if (res.status === 404) fail(`${path} returned 404`)
  }
  console.log('PASS no sequence row available; shared control-plane endpoints reachable')
}

const repoRoot = process.cwd()
const sequencesPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const homePath = join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx')
const sequencesSource = readFileSync(sequencesPath, 'utf8')
const homeSource = readFileSync(homePath, 'utf8')

const markers = [
  'sequences-tab-panel',
  'sequences-tab-no-customer',
  'sequences-tab-loading',
  'sending-console-panel',
  'sequence-preflight-panel',
  'launch-preview-panel',
  'run-history-panel',
  'preview-vs-outcome-panel',
  'exception-center-panel',
  'queue-workbench-panel',
]
for (const marker of markers) {
  if (!sequencesSource.includes(marker)) fail(`SequencesTab missing marker: ${marker}`)
}

if (!homeSource.includes('Sequences')) fail('MarketingHomePage missing Sequences nav entry')
if (!homeSource.includes('SequencesTab')) fail('MarketingHomePage missing SequencesTab wiring')

console.log(`PASS sequences endpoint reachable count=${sequenceList.length}`)
console.log('PASS sequences tab markers present')
console.log('self-test-sequences-tab-runtime: PASS')
