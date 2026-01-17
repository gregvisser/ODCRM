import { emit, on } from '../events'
import { OdcrmStorageKeys } from '../keys'
import { getJson, setItem, setJson } from '../storage'

export type OdcrmEmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  /**
   * Optional "recommended step" for organizing templates.
   * ODCRM sequences can use templates on any step (1..10).
   */
  stepNumber: number
  /**
   * Optional account/customer name this template is associated with.
   * If omitted/empty, treat as "global".
   */
  account?: string
  createdAt: string
  updatedAt: string
}

export function getEmailTemplates(): OdcrmEmailTemplate[] {
  const parsed = getJson<OdcrmEmailTemplate[]>(OdcrmStorageKeys.emailTemplates)
  return parsed && Array.isArray(parsed) ? parsed : []
}

export function setEmailTemplates(templates: OdcrmEmailTemplate[]): void {
  setJson(OdcrmStorageKeys.emailTemplates, templates)
  setItem(OdcrmStorageKeys.emailTemplatesLastUpdated, new Date().toISOString())
  emit('emailTemplatesUpdated', templates)
}

export function onEmailTemplatesUpdated(handler: (templates: OdcrmEmailTemplate[]) => void): () => void {
  return on<OdcrmEmailTemplate[]>('emailTemplatesUpdated', (detail) => handler(Array.isArray(detail) ? detail : []))
}

export function ensureEmailTemplatesSeeded(defaultTemplates: OdcrmEmailTemplate[]): OdcrmEmailTemplate[] {
  const existing = getEmailTemplates()
  if (existing.length > 0) return existing
  setEmailTemplates(defaultTemplates)
  return defaultTemplates
}


