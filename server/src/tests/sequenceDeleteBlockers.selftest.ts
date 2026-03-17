import assert from 'node:assert/strict'
import { buildSequenceDeleteBlockerDetails, getSequenceDeleteBlockerReason } from '../lib/sequenceDeleteBlockers.js'

assert.equal(getSequenceDeleteBlockerReason('running'), 'running_campaign')
assert.equal(getSequenceDeleteBlockerReason('completed'), 'historical_campaign')
assert.equal(getSequenceDeleteBlockerReason('paused'), 'historical_campaign')
assert.equal(getSequenceDeleteBlockerReason('draft'), 'linked_campaign')

assert.equal(
  getSequenceDeleteBlockerReason({
    id: 'camp_disposable_done',
    status: 'completed',
    emailEventCount: 0,
    prospectStepSentCount: 0,
  }),
  'disposable_campaign_cleanup_possible'
)
assert.equal(
  getSequenceDeleteBlockerReason({
    id: 'camp_historical_done',
    status: 'completed',
    emailEventCount: 2,
    prospectStepSentCount: 0,
  }),
  'historical_campaign'
)

const details = buildSequenceDeleteBlockerDetails([
  { id: 'camp_run', name: 'Live Outreach', status: 'running' },
  { id: 'camp_done', name: 'March Test', status: 'completed', emailEventCount: 1 },
  { id: 'camp_draft', name: 'April Draft', status: 'draft' },
])

assert.equal(details.code, 'sequence_linked_campaign')
assert.equal(details.totalCampaigns, 3)
assert.equal(details.summary.runningCampaigns, 1)
assert.equal(details.summary.historicalCampaigns, 1)
assert.equal(details.summary.linkedDraftCampaigns, 0)
assert.equal(details.summary.disposableCampaigns, 1)
assert.deepEqual(
  details.campaigns.map((campaign) => campaign.blockerReason),
  ['running_campaign', 'historical_campaign', 'disposable_campaign_cleanup_possible']
)

const disposableOnly = buildSequenceDeleteBlockerDetails([
  { id: 'camp_test_completed', name: 'Completed Test Wrapper', status: 'completed', emailEventCount: 0, prospectStepSentCount: 0 },
  { id: 'camp_test_paused', name: 'Paused Test Wrapper', status: 'paused', emailEventCount: 0, prospectStepSentCount: 0 },
])

assert.equal(disposableOnly.summary.disposableCampaigns, 2)
assert.equal(disposableOnly.summary.historicalCampaigns, 0)
assert.deepEqual(
  disposableOnly.campaigns.map((campaign) => campaign.blockerReason),
  ['disposable_campaign_cleanup_possible', 'disposable_campaign_cleanup_possible']
)

console.log('sequenceDeleteBlockers.selftest: PASS')
