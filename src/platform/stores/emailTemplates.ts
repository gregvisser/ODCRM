import { OdcrmStorageKeys } from '../keys'
import { getJson, setJson } from '../storage'

export type OdcrmEmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  stepNumber: 1 | 2
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
}


