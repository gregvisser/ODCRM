// Lightweight app-wide event helpers.
// We intentionally keep these as DOM CustomEvents for compatibility with existing code.

export type OdcrmEventName =
  | 'accountsUpdated'
  | 'contactsUpdated'
  | 'leadsUpdated'
  | 'navigateToAccount'
  | 'navigateToLeads'

export function emit<TDetail = unknown>(name: OdcrmEventName, detail?: TDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name, { detail }))
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
  return () => window.removeEventListener(name, wrapped)
}


