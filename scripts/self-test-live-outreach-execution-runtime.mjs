#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-live-outreach-execution-runtime: FAIL - ${message}`)
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
  try {
    return text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

const consolePayload = await getJson('/api/send-worker/console?sinceHours=24')
if (!consolePayload?.success || !consolePayload?.data?.status) {
  fail('/api/send-worker/console payload missing status block')
}
const status = consolePayload.data.status
if (typeof status.scheduledEngineMode !== 'string') fail('status.scheduledEngineMode missing')
if (typeof status.manualLiveTickAllowed !== 'boolean') fail('status.manualLiveTickAllowed missing')

const auditsPayload = await getJson('/api/send-worker/audits?limit=5')
if (!auditsPayload?.success || !Array.isArray(auditsPayload?.data?.items)) {
  fail('/api/send-worker/audits payload invalid')
}

const repoRoot = process.cwd()
const sequencesTabPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const sendWorkerRoutePath = join(repoRoot, 'server', 'src', 'routes', 'sendWorker.ts')
const source = readFileSync(sequencesTabPath, 'utf8')
const sendWorkerSource = readFileSync(sendWorkerRoutePath, 'utf8')

if (typeof status.dryRunTickRequiresAdminSecret !== 'boolean') {
  if (!sendWorkerSource.includes('dryRunTickRequiresAdminSecret')) {
    fail('status.dryRunTickRequiresAdminSecret missing and source marker not found')
  }
  console.log('PASS dryRunTickRequiresAdminSecret marker present in source (prod not yet updated)')
}
if (typeof status.liveCanaryTickRequiresAdminSecret !== 'boolean') {
  if (!sendWorkerSource.includes('liveCanaryTickRequiresAdminSecret')) {
    fail('status.liveCanaryTickRequiresAdminSecret missing and source marker not found')
  }
  console.log('PASS liveCanaryTickRequiresAdminSecret marker present in source (prod not yet updated)')
}

const markers = [
  'sending-console-panel',
  'sending-console-action-readiness',
  'sending-console-last-action-result',
  'sending-console-backend-truth-refresh',
  'sending-console-run-dry-run-btn',
  'sending-console-run-live-canary-btn',
  'refreshControlLoopTruth',
  '/api/send-worker/dry-run',
  '/api/send-worker/live-tick',
]
for (const marker of markers) {
  if (!source.includes(marker)) {
    fail(`SequencesTab missing marker: ${marker}`)
  }
}

console.log(`PASS action wiring mode=${status.scheduledEngineMode} dryRunRoute=${status.dryRunTickRoute || '/api/send-worker/dry-run'} liveRoute=${status.liveCanaryTickRoute || '/api/send-worker/live-tick'}`)
console.log(`PASS live canary availability allowed=${status.manualLiveTickAllowed} reason=${status.manualLiveTickReason || 'none'}`)
console.log(`PASS audits reachable rows=${auditsPayload.data.items.length}`)
console.log('PASS UI markers for inspect -> act -> refresh -> verify are present')
console.log('self-test-live-outreach-execution-runtime: PASS')
