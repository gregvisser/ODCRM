#!/usr/bin/env node
/**
 * Static regression: Greg-only destructive sequence authority + live-outreach UI emphasis.
 * No network. Exit 0 = PASS, 1 = FAIL.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const routeFile = join(root, 'server/src/routes/sequences.ts')
const uiFile = join(root, 'src/tabs/marketing/components/SequencesTab.tsx')

const routeContent = readFileSync(routeFile, 'utf8')
const uiContent = readFileSync(uiFile, 'utf8')

const requiredRouteMarkers = [
  'greg@opensdoor.co.uk',
  'greg@bidlow.co.uk',
  'Only greg@opensdoor.co.uk or greg@bidlow.co.uk may delete, archive, or unarchive sequences.',
  'const canDelete = await requireSequenceDestructiveAuthority(req, res)',
  'const canArchive = await requireSequenceDestructiveAuthority(req, res)',
  'const canUnarchive = await requireSequenceDestructiveAuthority(req, res)',
]

const requiredUiMarkers = [
  'Delete, archive, and unarchive are restricted to greg@opensdoor.co.uk and greg@bidlow.co.uk.',
  'sequence-destructive-actions-restricted-note',
  'Delete restricted to Greg',
  'Live outreach view',
  'Show troubleshooting tools',
  'Next operator action',
  'Open sequence',
  'The main workflow keeps live audience, readiness, latest result, and the next operator action in focus.',
]

const missingRoute = requiredRouteMarkers.filter((marker) => !routeContent.includes(marker))
const missingUi = requiredUiMarkers.filter((marker) => !uiContent.includes(marker))

if (missingRoute.length > 0) {
  console.error('self-test-sequences-greg-authority-contract: FAIL — missing route markers:', missingRoute.join(', '))
  process.exit(1)
}

if (missingUi.length > 0) {
  console.error('self-test-sequences-greg-authority-contract: FAIL — missing UI markers:', missingUi.join(', '))
  process.exit(1)
}

console.log('self-test-sequences-greg-authority-contract: PASS')
