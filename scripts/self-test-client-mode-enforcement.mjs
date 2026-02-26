#!/usr/bin/env node
/**
 * Static self-test: client mode v1 enforcement.
 * Asserts: server has /api/me, frontend uses /api/me, api sets X-Customer-Id from fixedCustomerId in client mode, App blocks when fixedCustomerId missing.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const serverSrc = path.join(root, 'server', 'src')
const src = path.join(root, 'src')

function readFile(p) {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

const errors = []

// 1) Server code contains "/api/me"
const serverIndex = readFile(path.join(serverSrc, 'index.ts'))
const serverMeRoute = readFile(path.join(serverSrc, 'routes', 'me.ts'))
if (!serverIndex.includes('/api/me') && !serverMeRoute.includes('/api/me')) {
  errors.push('Server code must contain "/api/me" (index.ts or routes/me.ts)')
}
if (!serverMeRoute.includes('uiMode') || !serverMeRoute.includes('fixedCustomerId')) {
  errors.push('Server routes/me.ts must return uiMode and fixedCustomerId')
}

// 2) Frontend code references /api/me
const platformMe = readFile(path.join(src, 'platform', 'me.ts'))
if (!platformMe.includes('/api/me')) {
  errors.push('Frontend src/platform/me.ts must reference /api/me')
}
if (!platformMe.includes('getMe') || !platformMe.includes('getFixedCustomerIdOrNull')) {
  errors.push('Frontend platform/me.ts must export getMe and getFixedCustomerIdOrNull')
}

// 3) API layer sets header from fixedCustomerId in client mode
const apiTs = readFile(path.join(src, 'utils', 'api.ts'))
if (!apiTs.includes('getFixedCustomerIdOrNull') || !apiTs.includes('isClientUI')) {
  errors.push('Frontend utils/api.ts must set X-Customer-Id from fixedCustomerId in client mode (use getFixedCustomerIdOrNull and isClientUI)')
}

// 4) App blocks rendering in client mode when fixedCustomerId missing
const appTsx = readFile(path.join(src, 'App.tsx'))
if (!appTsx.includes('getMe') || !appTsx.includes('isClientUI')) {
  errors.push('App.tsx must call getMe when isClientUI and gate rendering')
}
if (!appTsx.includes('fixedCustomerId') && !appTsx.includes('Client mode is not configured')) {
  errors.push('App must block with message when client mode and fixedCustomerId missing')
}

if (errors.length) {
  console.error('self-test-client-mode-enforcement failed:')
  errors.forEach((e) => console.error('  -', e))
  process.exit(1)
}

console.log('self-test-client-mode-enforcement: OK')
process.exit(0)
