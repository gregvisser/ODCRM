import { emit } from '../platform/events'
import { OdcrmStorageKeys } from '../platform/keys'
import { getJson, setJson } from '../platform/storage'

type LeadLike = {
  accountName: string
  [key: string]: any
}

type AccountLike = {
  name: string
  leads?: number
  [key: string]: any
}

/**
 * Syncs `account.leads` from an array of leads (by lead.accountName -> account.name).
 * This is intentionally lightweight: it avoids touching weekly/monthly actuals logic.
 *
 * Returns the number of accounts updated.
 */
export function syncAccountLeadCountsFromLeads(leads: LeadLike[]): number {
  const accounts = getJson<AccountLike[]>(OdcrmStorageKeys.accounts)
  if (!accounts || !Array.isArray(accounts)) return 0

  const counts = new Map<string, number>()
  for (const lead of leads) {
    const key = (lead.accountName || '').trim().toLowerCase()
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  let updated = 0
  const next = accounts.map((acc) => {
    const key = (acc.name || '').trim().toLowerCase()
    const count = counts.get(key) || 0
    if ((acc.leads || 0) === count) return acc
    updated++
    return { ...acc, leads: count }
  })

  if (updated > 0) {
    setJson(OdcrmStorageKeys.accounts, next)
    emit('accountsUpdated', next)
  }

  return updated
}


