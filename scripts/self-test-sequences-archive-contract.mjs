#!/usr/bin/env node
/**
 * Self-test to ensure sequence archive/delete contract code is present.
 * Passes if required strings exist in server routes and UI.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const routesFile = join(root, 'server', 'src', 'routes', 'sequences.ts')
const uiFile = join(root, 'src', 'components', 'MarketingSequencesTab.tsx')

const routes = readFileSync(routesFile, 'utf8')
const ui = readFileSync(uiFile, 'utf8')

const requiredInRoutes = [
  'includeArchived',
  '/api/sequences/:id/archive',
  '/api/sequences/:id/unarchive',
  'disposable_campaign_cleanup_possible',
]
const requiredInUI = [
  'Show archived',
  'Archive',
  'Unarchive',
]

const missingRoutes = requiredInRoutes.filter((s) => !routes.includes(s))
const missingUI = requiredInUI.filter((s) => !ui.includes(s))

if (missingRoutes.length > 0) {
  console.error('self-test-sequences-archive-contract: FAIL - missing route/UI strings:', missingRoutes)
  process.exit(1)
}
if (missingUI.length > 0) {
  console.error('self-test-sequences-archive-contract: FAIL - missing UI strings:', missingUI)
  process.exit(1)
}

console.log('self-test-sequences-archive-contract: PASS')
process.exit(0)
