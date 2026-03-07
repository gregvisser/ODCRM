#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(process.cwd(), 'src')
const offenders = []

const importPattern = /import\s*\{[^}]*\bCheckCircleIcon\b[^}]*\}\s*from\s*['"]@chakra-ui\/icons['"]/
const usagePattern = /\bCheckCircleIcon\b/

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      walk(full)
      continue
    }
    if (!/\.(ts|tsx)$/.test(full)) continue

    const content = readFileSync(full, 'utf8')
    if (!usagePattern.test(content)) continue
    if (importPattern.test(content)) continue
    offenders.push(full)
  }
}

walk(root)

if (offenders.length) {
  console.error('self-test-no-undefined-checkcircleicon: FAIL')
  for (const file of offenders) console.error(` - missing import in ${file}`)
  process.exit(1)
}

console.log('self-test-no-undefined-checkcircleicon: PASS')
