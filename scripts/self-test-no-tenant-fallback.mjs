/**
 * Regression: no silent tenant fallback (PR2).
 * Run: npm run test:no-tenant-fallback (from repo root)
 * Fails if:
 * 1) Repo (src/ or server/) contains the literal "prod-customer-1"
 * 2) Code uses DEFAULT_*CUSTOMER or DEFAULT_*CLIENT as fallback tenant selection
 * Prints "OK no-tenant-fallback self-test passed" on success.
 */
import fs from 'fs'
import path from 'path'

const root = path.resolve(process.cwd())
const dirs = [
  path.join(root, 'src'),
  path.join(root, 'server', 'src'),
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

let fail = 0

// 1) No literal prod-customer-1 in code
const forbidden = 'prod-customer-1'
for (const dir of dirs) {
  for (const file of walk(dir, ['.ts', '.tsx', '.js', '.mjs', '.cjs'])) {
    const content = fs.readFileSync(file, 'utf8')
    if (content.includes(forbidden)) {
      console.error(`FAIL: "${forbidden}" found in ${path.relative(root, file)}`)
      fail++
    }
  }
}

// 2) No DEFAULT_*CUSTOMER or DEFAULT_*CLIENT used for fallback tenant selection
// (e.g. getCurrentCustomerId(DEFAULT_CUSTOMER_ID) or similar)
const defaultFallbackRe = /\b(getCurrentCustomerId|getActiveClientId)\s*\(\s*(DEFAULT_[A-Z_]*CUSTOMER|DEFAULT_[A-Z_]*CLIENT)/
for (const dir of dirs) {
  for (const file of walk(dir, ['.ts', '.tsx'])) {
    const content = fs.readFileSync(file, 'utf8')
    if (defaultFallbackRe.test(content)) {
      console.error(`FAIL: default tenant fallback constant in ${path.relative(root, file)}`)
      fail++
    }
  }
}

if (fail > 0) {
  process.exit(1)
}
console.log('OK no-tenant-fallback self-test passed')
