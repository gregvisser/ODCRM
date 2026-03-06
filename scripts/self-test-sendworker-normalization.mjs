#!/usr/bin/env node
/**
 * Static regression: sendWorker normalization must remain in place.
 * - suppression domain derived from normalized (lowercased) email domain
 * - suppression reason check uses normalizedEmail (not raw recipientEmail)
 * - enrollmentRecipient lookup uses normalizedEmail
 * No network. Exit 0 = PASS, 1 = FAIL.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
 
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const file = join(root, 'server', 'src', 'routes', 'sendWorker.ts')
const content = readFileSync(file, 'utf8')
 
function fail(msg) {
  console.error(`self-test-sendworker-normalization: FAIL — ${msg}`)
  process.exit(1)
}
 
// 1) Domain lowercasing from normalized email
// We accept either explicit domain .toLowerCase() or `split('@')[1]?.toLowerCase()` patterns.
const hasLowercasedDomain =
  /split\(['"]@['"]\)\[1\][^;\n]*\.toLowerCase\(\)/.test(content) ||
  /domain\s*=\s*\([^)]*split\(['"]@['"]\)\[1\][^)]*\)\.toLowerCase\(\)/.test(content)
 
if (!hasLowercasedDomain) fail('expected lowercased domain derived from normalized email (missing .toLowerCase() on domain)')
 
// 2) Suppression reason check should use normalizedEmail (or normalized variable), not raw recipientEmail.
// We check for `getSuppressionReason(..., normalizedEmail)` at least once.
if (!/getSuppressionReason\([^,]+,\s*normalizedEmail\s*\)/.test(content)) {
  fail('expected getSuppressionReason(..., normalizedEmail)')
}
 
// 3) EnrollmentRecipient lookup should use normalizedEmail directly.
if (!/enrollmentRecipient\.findFirst\([\s\S]*?email:\s*normalizedEmail[\s\S]*?\)/.test(content)) {
  fail('expected enrollmentRecipient.findFirst where email: normalizedEmail')
}
 
console.log('self-test-sendworker-normalization: PASS')
process.exit(0)
