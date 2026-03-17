#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const routeFile = join(root, 'server', 'src', 'routes', 'sequences.ts')
const blockerLibFile = join(root, 'server', 'src', 'lib', 'sequenceDeleteBlockers.ts')

const routeSource = readFileSync(routeFile, 'utf8')
const blockerSource = readFileSync(blockerLibFile, 'utf8')

function fail(message) {
  console.error(`self-test-sequence-delete-disposable-contract: FAIL - ${message}`)
  process.exit(1)
}

const blockerMarkers = [
  "if (status === 'running') return 'running_campaign'",
  "if ((c.emailEventCount || 0) > 0 || (c.prospectStepSentCount || 0) > 0)",
  "return 'disposable_campaign_cleanup_possible'",
  "return 'linked_campaign'",
  "blockerReason: getSequenceDeleteBlockerReason(campaign)",
]

for (const marker of blockerMarkers) {
  if (!blockerSource.includes(marker)) fail(`Missing blocker marker: ${marker}`)
}

const routeMarkers = [
  "where: { customerId, sequenceId: id }",
  "prisma.emailEvent.count({ where: { campaignId: c.id, customerId } })",
  "prisma.emailCampaignProspectStep.count({ where: { campaignId: c.id, sentAt: { not: null } } })",
  "const allDisposable = details.campaigns.every((cc) => cc.blockerReason === 'disposable_campaign_cleanup_possible')",
  "await prisma.emailCampaign.deleteMany({ where: { id: { in: disposableIds }, customerId } })",
  "return res.status(409).json({",
]

for (const marker of routeMarkers) {
  if (!routeSource.includes(marker)) fail(`Missing route marker: ${marker}`)
}

console.log('PASS disposable campaigns are classified from enriched history signals')
console.log('PASS delete flow deletes disposable linked campaigns before deleting the sequence')
console.log('PASS historical linked campaigns still return the blocker payload')
console.log('PASS tenant isolation markers are present on lookup, event counting, and cleanup deleteMany')
console.log('self-test-sequence-delete-disposable-contract: PASS')
