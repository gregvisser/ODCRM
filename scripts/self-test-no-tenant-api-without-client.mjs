/**
 * Regression: tenant API guard — no tenantless API usage.
 * Run: npm run test:tenant-guard (from repo root)
 * Fails if:
 * 1) src/utils/api.ts does not only set X-Customer-Id when non-null (e.g. missing "&& customerId").
 * 2) Code passes getCurrentCustomerId() ?? '' or || '' into an API header setter for X-Customer-Id.
 * Prints "OK tenant API guard self-test passed" on success.
 */
import fs from 'fs'
import path from 'path'

const root = path.resolve(process.cwd())
const apiPath = path.join(root, 'src', 'utils', 'api.ts')

let fail = 0

// 1) api.ts must only set X-Customer-Id when customerId is non-null
if (fs.existsSync(apiPath)) {
  const content = fs.readFileSync(apiPath, 'utf8')
  // Expect: only set X-Customer-Id when customerId is truthy (no silent fallback).
  const hasConditionalSet =
    content.includes("headers.set('X-Customer-Id'") &&
    /&&\s*customerId\s*\)/.test(content)
  if (!hasConditionalSet) {
    console.error('FAIL: src/utils/api.ts must only set X-Customer-Id when customerId is non-null (e.g. "&& customerId" before headers.set)')
    fail++
  }
} else {
  console.error('FAIL: src/utils/api.ts not found')
  fail++
}

// 2) No getCurrentCustomerId() ?? '' or || '' passed into API header setter (X-Customer-Id)
// Only flag when used as header value, not for local state.
const headerFallbackPatterns = [
  /['"]X-Customer-Id['"]\s*:\s*[^,}]*getCurrentCustomerId\s*\(\s*\)\s*\?\?\s*['"]{2}/,
  /['"]X-Customer-Id['"]\s*:\s*[^,}]*getCurrentCustomerId\s*\(\s*\)\s*\|\|\s*['"]{2}/,
  /['"]x-customer-id['"]\s*:\s*[^,}]*getCurrentCustomerId\s*\(\s*\)\s*\?\?\s*['"]{2}/i,
  /['"]x-customer-id['"]\s*:\s*[^,}]*getCurrentCustomerId\s*\(\s*\)\s*\|\|\s*['"]{2}/i,
]

function* walk(dir, ext) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(full, ext)
    else if (ext.some((x) => e.name.endsWith(x))) yield full
  }
}

const srcDir = path.join(root, 'src')
for (const file of walk(srcDir, ['.ts', '.tsx'])) {
  const content = fs.readFileSync(file, 'utf8')
  for (const re of headerFallbackPatterns) {
    if (re.test(content)) {
      console.error(`FAIL: tenantless fallback in X-Customer-Id header in ${path.relative(root, file)}`)
      fail++
      break
    }
  }
}

if (fail > 0) {
  process.exit(1)
}
console.log('OK tenant API guard self-test passed')
