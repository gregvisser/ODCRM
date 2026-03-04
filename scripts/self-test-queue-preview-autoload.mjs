#!/usr/bin/env node
/**
 * Static regression: Queue preview panel auto-load when opened.
 * Ensures SequencesTab has a useEffect that runs loadSendQueuePreview when isQueuePreviewPanelOpen is true.
 * No network. Exit 0 = PASS, 1 = FAIL.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const file = join(root, 'src/tabs/marketing/components/SequencesTab.tsx')
const content = readFileSync(file, 'utf8')

const loadIdx = content.indexOf('loadSendQueuePreview()')
if (loadIdx === -1) {
  console.error('self-test-queue-preview-autoload: FAIL — loadSendQueuePreview() not found')
  process.exit(1)
}
const window = content.slice(Math.max(0, loadIdx - 350), loadIdx + 120)
if (!window.includes('useEffect')) {
  console.error('self-test-queue-preview-autoload: FAIL — loadSendQueuePreview not inside a useEffect')
  process.exit(1)
}
if (!window.includes('isQueuePreviewPanelOpen')) {
  console.error('self-test-queue-preview-autoload: FAIL — isQueuePreviewPanelOpen not in same useEffect as loadSendQueuePreview')
  process.exit(1)
}
console.log('self-test-queue-preview-autoload: PASS')
process.exit(0)
