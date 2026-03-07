#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const file = join(process.cwd(), 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const src = readFileSync(file, 'utf8')

function fail(msg) {
  console.error(`self-test-operator-enrollment-ui: FAIL - ${msg}`)
  process.exit(1)
}

const checks = [
  { re: /Enrollment flow/, msg: 'missing enrollment wizard helper block' },
  { re: /Step 1: choose source\. Step 2: preview recipients\./, msg: 'missing enrollment flow steps text' },
  { re: /Recipient preview:/, msg: 'missing recipient preview helper text' },
  { re: /View Queue Items/, msg: 'missing post-create queue CTA' },
  { re: /Queue empty: awaiting generation \/ schedule\./, msg: 'missing queue empty-state reason text' },
]

for (const c of checks) {
  if (!c.re.test(src)) fail(c.msg)
}

console.log('self-test-operator-enrollment-ui: PASS')
