/**
 * Guardrail: Cognism connect must validate token with Cognism before encrypting/storing.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')
const src = readFileSync(path.join(repoRoot, 'server/src/routes/leadSources.ts'), 'utf8')

const connectBlock = src.split("router.post('/cognism/connect'")[1] ?? ''
const tryBody = connectBlock.split('} catch')[0] ?? ''

const validateIdx = tryBody.indexOf('cognismValidateApiKey')
const encryptIdx = tryBody.indexOf('encryptLeadSourceSecret')
const buildIdx = tryBody.indexOf('buildCognismSearchBody')
assert.ok(validateIdx >= 0, 'connect route must call cognismValidateApiKey')
assert.ok(encryptIdx >= 0, 'connect route must call encryptLeadSourceSecret')
assert.ok(validateIdx < encryptIdx, 'validate must run before encrypt/store')
assert.ok(buildIdx >= 0 && buildIdx < validateIdx, 'build search body must precede validate call')

console.log('PASS cognism-connect-secret-order.test.ts')
