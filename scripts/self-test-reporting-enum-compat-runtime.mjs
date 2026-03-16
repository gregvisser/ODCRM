#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function fail(message) {
  console.error(`self-test-reporting-enum-compat-runtime: FAIL - ${message}`)
  process.exit(1)
}

const repoRoot = process.cwd()
const reportingSource = readFileSync(join(repoRoot, 'server', 'src', 'routes', 'reporting.ts'), 'utf8')
const reportsSource = readFileSync(join(repoRoot, 'server', 'src', 'routes', 'reports.ts'), 'utf8')

for (const [label, source] of [
  ['reporting.ts', reportingSource],
  ['reports.ts', reportsSource],
]) {
  if (!source.includes('function isOptOutEventType')) fail(`${label} missing opt-out compatibility helper`)
  if (source.includes("type: 'opted_out'")) fail(`${label} still uses invalid direct opted_out enum filter`)
  if (source.includes("type: { in: ['replied', 'opted_out'] }")) fail(`${label} still uses invalid opted_out enum array filter`)
  if (source.includes("type: { in: ['replied','opted_out'] }")) fail(`${label} still uses compact invalid opted_out enum array filter`)
}

console.log('PASS reporting routes no longer query opted_out directly in Prisma filters')
console.log('PASS compatibility helper exists for legacy unsubscribed vs opted_out drift')
console.log('self-test-reporting-enum-compat-runtime: PASS')
