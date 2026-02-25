/**
 * Regression: require-active-client wrapper — no inline active-client guards.
 * Run: npm run test:require-active-client (from repo root)
 * Fails if any file in src/** (except RequireActiveClient.tsx) contains the
 * inline guard pattern: if (!getCurrentCustomerId()) { return <NoActiveClientEmptyState
 * Prints "OK require-active-client wrapper self-test passed" on success.
 */
import fs from 'fs'
import path from 'path'

const root = path.resolve(process.cwd())
const srcDir = path.join(root, 'src')
const wrapperPath = path.join(root, 'src', 'components', 'RequireActiveClient.tsx')

// Pattern: inline guard that returns NoActiveClientEmptyState (allow optional whitespace/newlines)
const inlineGuardPattern = /if\s*\(\s*!\s*getCurrentCustomerId\s*\(\s*\)\s*\)\s*\{\s*return\s*<NoActiveClientEmptyState/

function* walk(dir, ext) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(full, ext)
    else if (ext.some((x) => e.name.endsWith(x))) yield full
  }
}

const matches = []
for (const file of walk(srcDir, ['.ts', '.tsx'])) {
  const normalized = path.normalize(file)
  if (normalized === path.normalize(wrapperPath)) continue
  const content = fs.readFileSync(file, 'utf8')
  const onOneLine = content.replace(/\s+/g, ' ')
  if (inlineGuardPattern.test(onOneLine)) {
    matches.push(path.relative(root, file))
  }
}

if (matches.length > 0) {
  console.error('FAIL: inline active-client guard found (use RequireActiveClient wrapper instead):')
  matches.forEach((m) => console.error('  ', m))
  process.exit(1)
}

console.log('OK require-active-client wrapper self-test passed')
