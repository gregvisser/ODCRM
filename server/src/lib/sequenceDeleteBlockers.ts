export type SequenceDeleteCampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | string | null | undefined

export type SequenceDeleteLinkedCampaign = {
  id: string
  name: string
  status?: SequenceDeleteCampaignStatus
}

export type SequenceDeleteBlockerReason =
  | 'running_campaign'
  | 'historical_campaign'
  | 'linked_campaign'
  | 'disposable_campaign_cleanup_possible'

export type SequenceDeleteBlockerSummary = {
  runningCampaigns: number
  historicalCampaigns: number
  linkedDraftCampaigns: number
  disposableCampaigns: number
}

export type SequenceDeleteBlockerDetails = {
  code: 'sequence_linked_campaign'
  totalCampaigns: number
  summary: SequenceDeleteBlockerSummary
  campaigns: Array<
    SequenceDeleteLinkedCampaign & {
      blockerReason: SequenceDeleteBlockerReason
    }
  >
}

export type EnrichedCampaignForDelete = {
  id: string
  name?: string
  status?: SequenceDeleteCampaignStatus
  // counts used to determine historical vs disposable
  emailEventCount?: number
  prospectCount?: number
  prospectStepSentCount?: number
}

export function getSequenceDeleteBlockerReason(
  arg: SequenceDeleteCampaignStatus | EnrichedCampaignForDelete
): SequenceDeleteBlockerReason {
  // Backwards-compatible: if a status string was passed
  if (typeof arg === 'string') {
    const normalized = arg.trim().toLowerCase()
    if (normalized === 'running') return 'running_campaign'
    if (normalized === 'completed' || normalized === 'paused') return 'historical_campaign'
    return 'linked_campaign'
  }

  // Enriched campaign object: prefer concrete historical signals
  const c = arg as EnrichedCampaignForDelete
  const status = typeof c.status === 'string' ? c.status.trim().toLowerCase() : ''

  // Running is immediate blocker
  if (status === 'running') return 'running_campaign'

  // If there are any email events or any sent prospect steps, treat as historical
  if ((c.emailEventCount || 0) > 0 || (c.prospectStepSentCount || 0) > 0) {
    return 'historical_campaign'
  }

  // If status is completed or paused but no event history, err on side of historical
  if (status === 'completed' || status === 'paused') return 'historical_campaign'

  // If draft/no-status and zero counts, mark as disposable candidate
  return 'disposable_campaign_cleanup_possible'
}

export function buildSequenceDeleteBlockerDetails(
  campaigns: SequenceDeleteLinkedCampaign[]
): SequenceDeleteBlockerDetails {
  const blockers = campaigns.map((campaign) => ({
    ...campaign,
    blockerReason: getSequenceDeleteBlockerReason(campaign.status),
  }))

  const summary = blockers.reduce<SequenceDeleteBlockerSummary>(
    (acc, campaign) => {
      if (campaign.blockerReason === 'running_campaign') acc.runningCampaigns += 1
      else if (campaign.blockerReason === 'historical_campaign') acc.historicalCampaigns += 1
      else if (campaign.blockerReason === 'disposable_campaign_cleanup_possible') acc.disposableCampaigns += 1
      else acc.linkedDraftCampaigns += 1
      return acc
    },
    {
      runningCampaigns: 0,
      historicalCampaigns: 0,
      linkedDraftCampaigns: 0,
      disposableCampaigns: 0,
    }
  )

  return {
    code: 'sequence_linked_campaign',
    totalCampaigns: blockers.length,
    summary,
    campaigns: blockers,
  }
}
