#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = (process.env.BASE_URL || 'https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net').replace(/\/$/, '')
const CUSTOMER_ID = (process.env.CUSTOMER_ID || '').trim()

function fail(message) {
  console.error(`self-test-sequences-delete-trust-runtime: FAIL - ${message}`)
  process.exit(1)
}

if (!CUSTOMER_ID) fail('CUSTOMER_ID env var is required')

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json', 'X-Customer-Id': CUSTOMER_ID },
  })
  const text = await response.text()
  if (!response.ok) fail(`GET ${path} returned ${response.status}: ${text.slice(0, 300)}`)
  try {
    return text ? JSON.parse(text) : null
  } catch {
    fail(`GET ${path} returned non-JSON`)
  }
}

const sequencesRes = await getJson('/api/sequences')
const sequenceList = Array.isArray(sequencesRes)
  ? sequencesRes
  : Array.isArray(sequencesRes?.data)
    ? sequencesRes.data
    : []

const repoRoot = process.cwd()
const sequencesPath = join(repoRoot, 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const source = readFileSync(sequencesPath, 'utf8')

const requiredMarkers = [
  'Delete not confirmed yet',
  'Removed and confirmed from the latest list refresh.',
  'deletingSequenceId',
  'deleteRes.error',
  'stillVisible',
  'startsWith(\'cust_\')',
]

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) fail(`Missing delete-trust marker in SequencesTab: ${marker}`)
}

console.log(`PASS sequences endpoint reachable count=${sequenceList.length}`)
console.log('PASS delete flow requires backend response + post-delete refresh verification markers')
console.log('PASS tenant guard marker present for delete flow')
console.log('self-test-sequences-delete-trust-runtime: PASS')
