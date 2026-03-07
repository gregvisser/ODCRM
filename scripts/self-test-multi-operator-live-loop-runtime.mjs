#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-multi-operator-live-loop-runtime: FAIL - ${message}`)
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
  if (!response.ok) {
    fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  }
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
  return parsed
}

const consolePayload = await getJson('/api/send-worker/console?sinceHours=24')
if (!consolePayload?.success || !consolePayload?.data || typeof consolePayload.data !== 'object') {
  fail('operator console envelope invalid')
}

const gatesPayload = await getJson('/api/send-worker/live-gates?sinceHours=24')
if (!gatesPayload?.success || !gatesPayload?.data || typeof gatesPayload.data !== 'object') {
  fail('live-gates envelope invalid')
}

const auditsPayload = await getJson('/api/send-worker/audits?limit=5')
const auditItems = Array.isArray(auditsPayload?.data?.items) ? auditsPayload.data.items : []

const repoRoot = process.cwd()
const sequencesPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const sequencesSource = readFileSync(sequencesPath, 'utf8')

const requiredMarkers = [
  'sending-console-panel',
  'sending-console-refresh-btn',
  'sending-console-last-updated',
  'sending-console-action-status',
  '/api/send-worker/console',
  '/api/send-worker/dry-run',
  '/api/send-worker/live-tick',
]

for (const marker of requiredMarkers) {
  if (!sequencesSource.includes(marker)) {
    fail(`SequencesTab missing control-loop marker: ${marker}`)
  }
}

const hasActionControls =
  sequencesSource.includes('sending-console-run-dry-run-btn') &&
  sequencesSource.includes('sending-console-run-live-canary-btn')
const hasReadOnlyExplanation = sequencesSource.includes('Read-only console')

if (!hasActionControls && !hasReadOnlyExplanation) {
  fail('console has neither safe action controls nor explicit read-only explanation')
}

const mode = String(consolePayload?.data?.status?.scheduledEngineMode ?? 'unknown')
const liveAllowed = Boolean(consolePayload?.data?.status?.manualLiveTickAllowed)
const queueTotal = Number(consolePayload?.data?.queue?.totalQueued ?? 0)

console.log(`PASS control-plane routes reachable mode=${mode} manualLiveTickAllowed=${liveAllowed}`)
console.log(`PASS UI control-loop markers present (panel/refresh/last-updated/action-status + route wiring)`)
console.log(`PASS audits reachable rows=${auditItems.length} queued=${queueTotal}`)
console.log('self-test-multi-operator-live-loop-runtime: PASS')
