#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-final-operator-facing-clarity-runtime: FAIL - ${message}`)
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

await getJson('/api/send-worker/exception-center?sinceHours=24')
await getJson('/api/send-worker/run-history?sinceHours=24&limit=20')
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
  ['ReportsTab', files.reports, 'reports-tab-operator-cue'],
  ['ReportsTab', files.reports, 'reports-tab-next-steps'],
  ['ReportsTab', files.reports, 'reports-tab-open-sequences'],
  ['SequencesTab', files.sequences, 'sequences-tab-operator-cue'],
  ['SequencesTab', files.sequences, 'sequences-tab-cross-nav'],
  ['InboxTab', files.inbox, 'inbox-tab-operator-guidance'],
  ['InboxTab', files.inbox, 'inbox-tab-send-reply-btn'],
]

for (const [scope, source, marker] of requiredMarkers) {
  if (!source.includes(marker)) fail(`${scope} missing marker: ${marker}`)
}

console.log('PASS operator-facing clarity cues present across Marketing home + Readiness/Reports/Sequences/Inbox')
console.log('PASS cross-tab follow-up markers present for issue -> inspect -> act -> verify flow')
console.log('PASS inbox receive/respond action path remains present')
console.log('self-test-final-operator-facing-clarity-runtime: PASS')
