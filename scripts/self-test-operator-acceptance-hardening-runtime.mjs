#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-operator-acceptance-hardening-runtime: FAIL - ${message}`)
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
  if (!response.ok) fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  try {
    return text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

const sequenceListRaw = await getJson('/api/sequences')
const sequenceItems = Array.isArray(sequenceListRaw?.data)
  ? sequenceListRaw.data
  : Array.isArray(sequenceListRaw)
    ? sequenceListRaw
    : []
const candidateSequenceId = typeof sequenceItems[0]?.id === 'string' ? sequenceItems[0].id : ''

await getJson('/api/send-worker/exception-center?sinceHours=24' + (candidateSequenceId ? `&sequenceId=${encodeURIComponent(candidateSequenceId)}` : ''))
if (candidateSequenceId) {
  await getJson(`/api/send-worker/sequence-preflight?sequenceId=${encodeURIComponent(candidateSequenceId)}&sinceHours=24`)
}
await getJson('/api/send-worker/run-history?sinceHours=24&limit=20' + (candidateSequenceId ? `&sequenceId=${encodeURIComponent(candidateSequenceId)}` : ''))
await getJson('/api/reports/outreach?customerId=' + encodeURIComponent(CUSTOMER_ID) + '&sinceDays=30')
await getJson('/api/inbox/threads?limit=5&offset=0&unreadOnly=false')
await getJson('/api/inbox/replies')

const repoRoot = process.cwd()
const files = {
  home: readFileSync(join(repoRoot, 'src', 'tabs', 'marketing', 'MarketingHomePage.tsx'), 'utf8'),
  readiness: readFileSync(join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReadinessTab.tsx'), 'utf8'),
  reports: readFileSync(join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'ReportsTab.tsx'), 'utf8'),
  sequences: readFileSync(join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx'), 'utf8'),
  inbox: readFileSync(join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'InboxTab.tsx'), 'utf8'),
}

const requiredMarkers = [
  ['MarketingHomePage', files.home, 'marketing-home-operator-guidance'],
  ['ReadinessTab', files.readiness, 'readiness-tab-operator-cue'],
  ['ReadinessTab', files.readiness, 'readiness-tab-go-reports'],
  ['ReadinessTab', files.readiness, 'readiness-tab-go-inbox'],
  ['ReadinessTab', files.readiness, 'readiness-tab-open-reports-followup'],
  ['ReportsTab', files.reports, 'reports-tab-operator-cue'],
  ['ReportsTab', files.reports, 'reports-tab-next-steps'],
  ['ReportsTab', files.reports, 'reports-tab-open-sequences'],
  ['ReportsTab', files.reports, 'reports-tab-open-inbox'],
  ['SequencesTab', files.sequences, 'sequences-tab-operator-cue'],
  ['SequencesTab', files.sequences, 'sequences-tab-cross-nav'],
  ['InboxTab', files.inbox, 'inbox-tab-operator-guidance'],
  ['InboxTab', files.inbox, 'inbox-tab-open-sequences'],
  ['InboxTab', files.inbox, 'inbox-tab-open-reports'],
  ['InboxTab', files.inbox, 'inbox-tab-send-reply-btn'],
]

for (const [scope, source, marker] of requiredMarkers) {
  if (!source.includes(marker)) fail(`${scope} missing marker: ${marker}`)
}

const guidanceMarkers = [
  ['ReadinessTab', files.readiness, 'No sequence is selected yet.'],
  ['ReportsTab', files.reports, 'Operator Follow-Up'],
  ['InboxTab', files.inbox, 'Operator flow'],
]

for (const [scope, source, marker] of guidanceMarkers) {
  if (!source.includes(marker)) fail(`${scope} missing operator guidance copy: ${marker}`)
}

console.log('PASS backend truth surfaces reachable for readiness/reports/inbox acceptance flow')
console.log('PASS cross-tab continuity markers present (Readiness <-> Sequences/Reports/Inbox)')
console.log('PASS operator guidance markers present for no-sequence/no-data follow-up paths')
console.log('PASS inbox receive/respond path remains reachable')
console.log('self-test-operator-acceptance-hardening-runtime: PASS')
