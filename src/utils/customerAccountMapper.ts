/**
 * Mapper between database Customer format and AccountsTab Account format
 * This allows AccountsTab to use its existing Account type while loading from database
 */

import type { DatabaseCustomer } from '../hooks/useCustomersFromDatabase'

// AccountsTab Account type (keeping for backward compatibility with UI)
export type Account = {
  // Database ID - canonical identifier from database (e.g. "cust_...")
  id?: string
  name: string
  clientLeadsSheetUrl?: string
  clientLeadsSheetStatus?: 'active' | 'inactive' | 'cleared'
  sector?: string
  targetLocation?: string[]
  targetJobTitle?: string
  weeklyLeadTarget?: number
  monthlyLeadTarget?: number
  weeklyLeadActual?: number
  monthlyLeadActual?: number
  monthlyIntake?: number
  defcon?: number
  daysPerWeek?: number
  numberOfContacts?: number
  clientStatus?: 'active' | 'inactive' | 'onboarding' | 'win_back'
  contractStart?: string
  contractEnd?: string
  logoUrl?: string
  agreementFiles?: string[]
  users?: Array<{ name: string; role: string }>
  
  // About section (enriched data)
  website?: string
  whatTheyDo?: string
  keyLeaders?: string
  companyProfile?: string
  recentNews?: string
  accreditations?: string
  socialPresence?: Array<{ label: string; url: string }>
  companySize?: string
  headquarters?: string
  foundingYear?: string
  
  // Internal tracking
  _databaseId?: string // DEPRECATED: Use `id` instead
  _lastSyncedAt?: string
}

/**
 * Convert database Customer to AccountsTab Account format
 */
export function databaseCustomerToAccount(customer: DatabaseCustomer): Account {
  // Parse target locations (stored as comma-separated string in DB)
  const targetLocation = customer.prospectingLocation
    ? customer.prospectingLocation.split(',').map(s => s.trim()).filter(Boolean)
    : undefined

  return {
    // Database ID (canonical)
    id: customer.id,
    name: customer.name,
    clientLeadsSheetUrl: customer.leadsReportingUrl || undefined,
    clientLeadsSheetStatus: customer.leadsReportingUrl ? 'active' : undefined,
    sector: customer.sector || undefined,
    targetLocation,
    targetJobTitle: customer.targetJobTitle || undefined,
    weeklyLeadTarget: customer.weeklyLeadTarget || undefined,
    monthlyLeadTarget: customer.monthlyLeadTarget || undefined,
    weeklyLeadActual: customer.weeklyLeadActual || undefined,
    monthlyLeadActual: customer.monthlyLeadActual || undefined,
    monthlyIntake: customer.monthlyIntakeGBP ? parseFloat(customer.monthlyIntakeGBP) : undefined,
    defcon: customer.defcon || undefined,
    clientStatus: customer.clientStatus as any || 'active',
    
    // About section
    website: customer.website || customer.domain || undefined,
    whatTheyDo: customer.whatTheyDo || undefined,
    keyLeaders: customer.keyLeaders || undefined,
    companyProfile: customer.companyProfile || undefined,
    recentNews: customer.recentNews || undefined,
    accreditations: customer.accreditations || undefined,
    socialPresence: customer.socialPresence || undefined,
    companySize: customer.companySize || undefined,
    headquarters: customer.headquarters || undefined,
    foundingYear: customer.foundingYear || undefined,
    
    // Number of contacts from customerContacts array
    numberOfContacts: customer.customerContacts?.length || 0,
    
    // Internal tracking (deprecated, use `id` instead)
    _databaseId: customer.id,
    _lastSyncedAt: customer.updatedAt,
  }
}

/**
 * Convert AccountsTab Account to database Customer format (for updates)
 */
export function accountToDatabaseCustomer(account: Account): Partial<DatabaseCustomer> {
  // Join target locations back to comma-separated string
  const prospectingLocation = account.targetLocation?.join(', ') || null

  return {
    name: account.name,
    leadsReportingUrl: account.clientLeadsSheetUrl || null,
    sector: account.sector || null,
    prospectingLocation,
    targetJobTitle: account.targetJobTitle || null,
    weeklyLeadTarget: account.weeklyLeadTarget || null,
    monthlyLeadTarget: account.monthlyLeadTarget || null,
    weeklyLeadActual: account.weeklyLeadActual || null,
    monthlyLeadActual: account.monthlyLeadActual || null,
    monthlyIntakeGBP: account.monthlyIntake?.toString() || null,
    defcon: account.defcon || null,
    clientStatus: account.clientStatus || 'active',
    
    // About section
    website: account.website || null,
    whatTheyDo: account.whatTheyDo || null,
    keyLeaders: account.keyLeaders || null,
    companyProfile: account.companyProfile || null,
    recentNews: account.recentNews || null,
    accreditations: account.accreditations || null,
    socialPresence: account.socialPresence || null,
    companySize: account.companySize || null,
    headquarters: account.headquarters || null,
    foundingYear: account.foundingYear || null,
  }
}

/**
 * Batch convert database customers to accounts
 */
export function databaseCustomersToAccounts(customers: DatabaseCustomer[]): Account[] {
  return customers.map(databaseCustomerToAccount)
}
