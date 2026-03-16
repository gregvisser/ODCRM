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

export type SequenceDeleteBlockerSummary = {
  runningCampaigns: number
  historicalCampaigns: number
  linkedDraftCampaigns: number
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

export function getSequenceDeleteBlockerReason(status: SequenceDeleteCampaignStatus): SequenceDeleteBlockerReason {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : ''

  if (normalized === 'running') {
    return 'running_campaign'
  }

  // Completed and paused campaigns may still be referenced by reporting/history
  // through campaign.sequenceId, so keep them as hard blockers.
  if (normalized === 'completed' || normalized === 'paused') {
    return 'historical_campaign'
  }

  return 'linked_campaign'
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
      else acc.linkedDraftCampaigns += 1
      return acc
    },
    {
      runningCampaigns: 0,
      historicalCampaigns: 0,
      linkedDraftCampaigns: 0,
    }
  )

  return {
    code: 'sequence_linked_campaign',
    totalCampaigns: blockers.length,
    summary,
    campaigns: blockers,
  }
}
