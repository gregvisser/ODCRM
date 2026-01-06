// Lightweight app-wide event helpers.
// We intentionally keep these as DOM CustomEvents for compatibility with existing code.

import { publishCrossTab, subscribeCrossTab } from './crossTab'

export type OdcrmEventName =
  | 'accountsUpdated'
  | 'contactsUpdated'
  | 'leadsUpdated'
  | 'emailTemplatesUpdated'
  | 'cognismProspectsUpdated'
  | 'campaignWorkflowsUpdated'
  | 'usersUpdated'
  | 'settingsUpdated'
  | 'headerImageUpdated'
  | 'navigateToAccount'
  | 'navigateToLeads'

export function emit<TDetail = unknown>(name: OdcrmEventName, detail?: TDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name, { detail }))
  publishCrossTab(name, detail)
}

export function on<TDetail = unknown>(
  name: OdcrmEventName,
  handler: (detail: TDetail, event: CustomEvent<TDetail>) => void
): () => void {
  if (typeof window === 'undefined') return () => {}
  const wrapped = ((evt: Event) => {
    handler((evt as CustomEvent<TDetail>).detail, evt as CustomEvent<TDetail>)
  }) as EventListener

  window.addEventListener(name, wrapped)

  const offCrossTab = subscribeCrossTab(name, (detail) => {
    handler(detail as TDetail, new CustomEvent(name, { detail: detail as TDetail }))
  })

  return () => {
    window.removeEventListener(name, wrapped)
    offCrossTab()
  }
}


