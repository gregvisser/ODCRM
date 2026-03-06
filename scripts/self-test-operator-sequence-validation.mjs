#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const file = join(process.cwd(), 'src', 'tabs', 'marketing', 'components', 'SequencesTab.tsx')
const src = readFileSync(file, 'utf8')

function fail(msg) {
  console.error(`self-test-operator-sequence-validation: FAIL - ${msg}`)
  process.exit(1)
}

const checks = [
  { re: /Validation required before save/, msg: 'missing inline validation alert text' },
  { re: /Step \$\{step\.stepOrder\}: template is required\./, msg: 'missing step template required validation' },
  { re: /delay must be between 0 and \$\{MAX_STEP_DELAY_DAYS\} days\./, msg: 'missing step delay bounds validation' },
  { re: /isDisabled=\{!canSaveDraft\}/, msg: 'Save Draft button is not guarded by canSaveDraft' },
  { re: /Preview recipients:/, msg: 'missing recipients preview helper text' },
]

for (const c of checks) {
  if (!c.re.test(src)) fail(c.msg)
}

console.log('self-test-operator-sequence-validation: PASS')
