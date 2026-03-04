#!/usr/bin/env node
/**
 * Static regression: Send Queue drawer close handler resets detail state.
 * Asserts closeQueueModal (or equivalent) and setQueueDrawerDetail(null) exist.
 * No network. Exit 0 = PASS, 1 = FAIL.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const file = join(root, 'src/tabs/marketing/components/SequencesTab.tsx')
const content = readFileSync(file, 'utf8')

const hasCloseHandler = content.includes('onClose={closeQueueModal}') || content.includes('onClose={closeQueueModal ')
const hasCloseQueueModal = content.includes('closeQueueModal')
const hasResetDetail = content.includes('setQueueDrawerDetail(null)')

if (!hasCloseHandler || !hasCloseQueueModal) {
  console.error('self-test-send-queue-drawer-reset: FAIL — Drawer onClose={closeQueueModal} or closeQueueModal not found')
  process.exit(1)
}
if (!hasResetDetail) {
  console.error('self-test-send-queue-drawer-reset: FAIL — setQueueDrawerDetail(null) not found in file')
  process.exit(1)
}
console.log('self-test-send-queue-drawer-reset: PASS')
process.exit(0)
