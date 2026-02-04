/**
 * Mapper between database Customer format and AccountsTab Account format
 * This allows AccountsTab to use its existing Account type while loading from database
 */

import type { DatabaseCustomer } from '../hooks/useCustomersFromDatabase'

// AccountsTab Account type (keeping for backward compatibility with UI)
export type Account = {
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
  _databaseId?: string // Store database ID for updates
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
    
    // Internal tracking
    _databaseId: customer.id,
    _lastSyncedAt: customer.updatedAt,
  }
}

/**
 * Account shape that may include onboarding data (from localStorage / AccountsTab).
 * Used when syncing back to database so accountData is preserved.
 */
type AccountWithOnboarding = Account & {
  clientProfile?: unknown
  primaryContact?: unknown
  headOfficeAddress?: string
  headOfficePlaceId?: string
  headOfficePostcode?: string
  contactPersons?: string
  contactEmail?: string
  contactNumber?: string
  contactRoleId?: string
  contactRoleLabel?: string
  contactActive?: boolean
  assignedAccountManager?: string
  assignedAccountManagerId?: string
  assignedClientDdiNumber?: string
  emailAccountsSetUp?: boolean
  emailAccounts?: string[]
  days?: number
}

/**
 * Build accountData JSON for API from account (onboarding / account-details fields).
 * Matches shape saved by Onboarding tab so DB is single source of truth.
 */
function buildAccountDataFromAccount(account: AccountWithOnboarding): Record<string, unknown> | null {
  const hasOnboarding =
    account.clientProfile != null ||
    account.primaryContact != null ||
    (account.headOfficeAddress != null && account.headOfficeAddress !== '') ||
    (account.contactPersons != null && account.contactPersons !== '') ||
    (account.contactEmail != null && account.contactEmail !== '') ||
    (account.days != null && account.days !== 0)
  if (!hasOnboarding) return null

  return {
    clientProfile: account.clientProfile ?? undefined,
    primaryContact: account.primaryContact ?? undefined,
    headOfficeAddress: account.headOfficeAddress ?? undefined,
    headOfficePlaceId: account.headOfficePlaceId ?? undefined,
    headOfficePostcode: account.headOfficePostcode ?? undefined,
    contactPersons: account.contactPersons ?? undefined,
    contactEmail: account.contactEmail ?? undefined,
    contactNumber: account.contactNumber ?? undefined,
    contactRoleId: account.contactRoleId ?? undefined,
    contactRoleLabel: account.contactRoleLabel ?? undefined,
    contactActive: account.contactActive ?? undefined,
    assignedAccountManager: account.assignedAccountManager ?? undefined,
    assignedAccountManagerId: account.assignedAccountManagerId ?? undefined,
    assignedClientDdiNumber: account.assignedClientDdiNumber ?? undefined,
    emailAccountsSetUp: account.emailAccountsSetUp ?? undefined,
    emailAccounts: account.emailAccounts ?? undefined,
    days: account.days ?? undefined,
    accountDetails:
      account.primaryContact != null || account.headOfficeAddress != null || account.days != null
        ? {
            primaryContact: account.primaryContact,
            headOfficeAddress: account.headOfficeAddress,
            headOfficePlaceId: account.headOfficePlaceId,
            headOfficePostcode: account.headOfficePostcode,
            assignedAccountManagerId: account.assignedAccountManagerId,
            assignedAccountManagerName: account.assignedAccountManager,
            assignedClientDdiNumber: account.assignedClientDdiNumber,
            emailAccounts: account.emailAccounts,
            daysPerWeek: account.days,
          }
        : undefined,
  }
}

/**
 * Convert AccountsTab Account to database Customer format (for updates).
 * Includes accountData so onboarding/client profile data is persisted.
 */
export function accountToDatabaseCustomer(account: AccountWithOnboarding): Partial<DatabaseCustomer> {
  // Join target locations back to comma-separated string
  const prospectingLocation = account.targetLocation?.join(', ') || null
  const accountData = buildAccountDataFromAccount(account)

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

    // Onboarding / account details (single source of truth in DB)
    accountData: accountData ?? null,
  }
}

/**
 * Batch convert database customers to accounts
 */
export function databaseCustomersToAccounts(customers: DatabaseCustomer[]): Account[] {
  return customers.map(databaseCustomerToAccount)
}
