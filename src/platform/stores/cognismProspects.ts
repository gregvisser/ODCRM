import { OdcrmStorageKeys } from '../keys'
import { getJson, setJson } from '../storage'

export type CognismProspect = {
  id: string
  firstName: string
  lastName: string
  jobTitle?: string
  companyName: string
  email: string
  phone?: string
  accountName?: string // customer account in ODCRM
  source: 'cognism'
  importedAt: string
}

export function getCognismProspects(): CognismProspect[] {
  const parsed = getJson<CognismProspect[]>(OdcrmStorageKeys.cognismProspects)
  return parsed && Array.isArray(parsed) ? parsed : []
}

export function setCognismProspects(items: CognismProspect[]): void {
  setJson(OdcrmStorageKeys.cognismProspects, items)
}


