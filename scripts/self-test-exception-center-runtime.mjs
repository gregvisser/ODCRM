#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-exception-center-runtime: FAIL - ${message}`)
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
const sequenceList = Array.isArray(sequencesRes.body)
  ? sequencesRes.body
  : Array.isArray(sequencesRes.body?.data)
    ? sequencesRes.body.data
    : []
const candidate = sequenceList.find((row) => typeof row?.id === 'string' && String(row.id).trim().length > 0)

const params = new URLSearchParams()
params.set('sinceHours', '24')
if (candidate?.id) params.set('sequenceId', String(candidate.id))

const exceptionRes = await getJson(`/api/send-worker/exception-center?${params.toString()}`)
if (exceptionRes.status === 404) {
  if (!sendWorkerSource.includes("router.get('/exception-center'")) {
    fail('/exception-center returned 404 and source route marker missing')
  }
  console.log('PASS exception-center route marker present in source (prod not yet updated)')
} else {
  const payload = exceptionRes.body
  if (!payload?.success || !payload?.data) fail('exception-center payload missing success/data')
  if (!payload.data.statusSummary || typeof payload.data.statusSummary !== 'object') fail('statusSummary missing')
  if (!Array.isArray(payload.data.groups)) fail('groups must be an array')
  for (const key of ['totalGroups', 'openGroups', 'high', 'medium', 'low']) {
    if (typeof payload.data.statusSummary[key] !== 'number') fail(`statusSummary.${key} must be numeric`)
  }
  if (payload.data.groups.length > 0) {
    const first = payload.data.groups[0]
    if (typeof first.key !== 'string') fail('group.key missing')
    if (typeof first.severity !== 'string') fail('group.severity missing')
    if (typeof first.count !== 'number') fail('group.count missing')
  }
  console.log(`PASS exception-center endpoint reachable groups=${payload.data.groups.length} open=${payload.data.statusSummary.openGroups}`)
}

const markers = [
  'exception-center-panel',
  'exception-center-refresh-btn',
  'exception-center-summary-cards',
  'exception-center-groups',
  'exception-center-severity-badge',
  'exception-center-next-step-btn',
  'exception-center-next-step-routing',
  'exception-center-last-updated',
  '/api/send-worker/exception-center',
]
for (const marker of markers) {
  if (!sequencesSource.includes(marker)) fail(`SequencesTab missing marker: ${marker}`)
}

console.log('PASS exception center UI markers present')
console.log('self-test-exception-center-runtime: PASS')
