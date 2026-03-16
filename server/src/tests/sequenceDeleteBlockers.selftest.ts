import assert from 'node:assert/strict'
import { buildSequenceDeleteBlockerDetails, getSequenceDeleteBlockerReason } from '../lib/sequenceDeleteBlockers.js'

assert.equal(getSequenceDeleteBlockerReason('running'), 'running_campaign')
assert.equal(getSequenceDeleteBlockerReason('completed'), 'historical_campaign')
assert.equal(getSequenceDeleteBlockerReason('paused'), 'historical_campaign')
assert.equal(getSequenceDeleteBlockerReason('draft'), 'linked_campaign')

const details = buildSequenceDeleteBlockerDetails([
  { id: 'camp_run', name: 'Live Outreach', status: 'running' },
  { id: 'camp_done', name: 'March Test', status: 'completed' },
  { id: 'camp_draft', name: 'April Draft', status: 'draft' },
])

assert.equal(details.code, 'sequence_linked_campaign')
assert.equal(details.totalCampaigns, 3)
assert.equal(details.summary.runningCampaigns, 1)
assert.equal(details.summary.historicalCampaigns, 1)
assert.equal(details.summary.linkedDraftCampaigns, 1)
assert.deepEqual(
  details.campaigns.map((campaign) => campaign.blockerReason),
  ['running_campaign', 'historical_campaign', 'linked_campaign']
)

console.log('sequenceDeleteBlockers.selftest: PASS')
