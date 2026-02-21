/**
 * Shared customer types used by API normalizers, hooks, and mappers.
 * Lives in a leaf module to avoid circular imports (e.g. normalizeApiResponse ↔ useCustomersFromDatabase).
 */

export type DatabaseCustomer = {
  id: string
  name: string
  domain?: string | null
  leadsReportingUrl?: string | null
  leadsGoogleSheetLabel?: string | null
  sector?: string | null
  clientStatus: string
  targetJobTitle?: string | null
  prospectingLocation?: string | null
  monthlyIntakeGBP?: string | null
  monthlyRevenueFromCustomer?: string | null
  defcon?: number | null
  weeklyLeadTarget?: number | null
  weeklyLeadActual?: number | null
  monthlyLeadTarget?: number | null
  monthlyLeadActual?: number | null
  website?: string | null
  whatTheyDo?: string | null
  accreditations?: string | null
  keyLeaders?: string | null
  companyProfile?: string | null
  recentNews?: string | null
  companySize?: string | null
  headquarters?: string | null
  foundingYear?: string | null
  socialPresence?: Array<{ label: string; url: string }> | null
  accountData?: any | null
  createdAt: string
  updatedAt: string
  customerContacts: Array<{
    id: string
    customerId: string
    name: string
    email?: string | null
    phone?: string | null
    title?: string | null
    isPrimary: boolean
    notes?: string | null
    createdAt: string
    updatedAt: string
  }>
}
