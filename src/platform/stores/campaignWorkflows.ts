import { emit, on } from '../events'
import { OdcrmStorageKeys } from '../keys'
import { getJson, setItem, setJson } from '../storage'

export type CampaignWorkflow = Record<string, unknown>

export function getCampaignWorkflows<T = CampaignWorkflow>(): T[] {
  const data = getJson<unknown>(OdcrmStorageKeys.campaignWorkflows)
  return Array.isArray(data) ? (data as T[]) : []
}

export function setCampaignWorkflows<T = CampaignWorkflow>(items: T[]): void {
  setJson(OdcrmStorageKeys.campaignWorkflows, items)
  setItem(OdcrmStorageKeys.campaignWorkflowsLastUpdated, new Date().toISOString())
  emit('campaignWorkflowsUpdated', items)
}

export function onCampaignWorkflowsUpdated<T = CampaignWorkflow>(handler: (items: T[]) => void): () => void {
  return on<T[]>('campaignWorkflowsUpdated', (detail) => handler(Array.isArray(detail) ? detail : []))
}


