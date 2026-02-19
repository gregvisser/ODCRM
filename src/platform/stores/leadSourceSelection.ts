/**
 * In-session selection for "Use in sequence" from Lead Sources.
 * Not persisted; used to pass batch selection to Sequences tab for preview/send.
 */

import { emit, on } from '../events'

export type LeadSourceType = 'COGNISM' | 'APOLLO' | 'SOCIAL' | 'BLACKBOOK'

export interface LeadSourceBatchSelection {
  sourceType: LeadSourceType
  batchKey: string
}

let selection: LeadSourceBatchSelection | null = null

export function getLeadSourceBatchSelection(): LeadSourceBatchSelection | null {
  return selection
}

export function setLeadSourceBatchSelection(value: LeadSourceBatchSelection | null): void {
  selection = value
  emit('leadSourceBatchSelectionChanged', selection)
}

export function clearLeadSourceBatchSelection(): void {
  setLeadSourceBatchSelection(null)
}

export function onLeadSourceBatchSelectionChanged(
  handler: (value: LeadSourceBatchSelection | null) => void
): () => void {
  return on<LeadSourceBatchSelection | null>('leadSourceBatchSelectionChanged', (detail) => handler(detail))
}
