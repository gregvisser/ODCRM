/**
 * Mapper between database Customer format and AccountsTab Account format
 * This allows AccountsTab to use its existing Account type while loading from database
 */

import type { DatabaseCustomer } from '../hooks/useCustomersFromDatabase'
import type { Account } from '../components/AccountsTab'

function mapClientStatusToAccountStatus(
  clientStatus: unknown
): Account['status'] {
  if (clientStatus === 'inactive') return 'Inactive'
  if (clientStatus === 'onboarding') return 'On Hold'
  // active | win_back | unknown
  return 'Active'
}

function coerceObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function splitCommaList(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Convert database Customer to AccountsTab Account format
 */
export function databaseCustomerToAccount(customer: DatabaseCustomer): Account {
  // accountData is our canonical snapshot for AccountsTab UI (database-first).
  // Onboarding writes onboarding-specific fields into accountData.accountDetails/clientProfile as well.
  const raw = coerceObject(customer.accountData) || {}
  const accountDetails = coerceObject(raw.accountDetails) || {}

  const targetLocationFromDb = splitCommaList(customer.prospectingLocation)

  const monthlyRevenue = toNumber(customer.monthlyRevenueFromCustomer)
  const monthlyIntake = toNumber(customer.monthlyIntakeGBP)
  const monthlySpendGBP =
    toNumber(raw.monthlySpendGBP) ??
    monthlyRevenue ??
    monthlyIntake ??
    0

  const days =
    toNumber(raw.days) ??
    toNumber(accountDetails.daysPerWeek) ??
    1

  const emailAccounts =
    (Array.isArray(raw.emailAccounts) ? raw.emailAccounts : null) ??
    (Array.isArray(accountDetails.emailAccounts) ? accountDetails.emailAccounts : null) ??
    []

  const emailAccountsSetUp =
    typeof raw.emailAccountsSetUp === 'boolean'
      ? raw.emailAccountsSetUp
      : Array.isArray(emailAccounts) && emailAccounts.some((v) => String(v || '').trim())

  const contactCount = Array.isArray(customer.customerContacts) ? customer.customerContacts.length : 0

  const account: Account = {
    // IDs
    id: customer.id,
    _databaseId: customer.id,

    // Core
    name: customer.name,
    website: String((raw.website ?? customer.website ?? customer.domain ?? '') || ''),

    // AccountData-first fields (if present)
    aboutSections: (raw.aboutSections as any) ?? {
      whatTheyDo: customer.whatTheyDo || '',
      accreditations: customer.accreditations || '',
      keyLeaders: customer.keyLeaders || '',
      companyProfile: customer.companyProfile || '',
      recentNews: customer.recentNews || '',
      companySize: customer.companySize || '',
      headquarters: customer.headquarters || '',
      foundingYear: customer.foundingYear || '',
    },
    sector: String((raw.sector ?? customer.sector ?? '') || ''),
    socialMedia: (raw.socialMedia as any) ?? (Array.isArray(customer.socialPresence) ? customer.socialPresence : []),

    // Onboarding/contact convenience fields (stored in accountData by onboarding)
    contactPersons: raw.contactPersons as any,
    contactNumber: raw.contactNumber as any,
    contactEmail: raw.contactEmail as any,
    primaryContact: raw.primaryContact as any,
    contactRoleId: raw.contactRoleId as any,
    contactRoleLabel: raw.contactRoleLabel as any,
    contactActive: raw.contactActive as any,

    headOfficeAddress: (raw.headOfficeAddress as any) ?? (accountDetails.headOfficeAddress as any),
    headOfficePlaceId: (raw.headOfficePlaceId as any) ?? (accountDetails.headOfficePlaceId as any),
    headOfficePostcode: (raw.headOfficePostcode as any) ?? (accountDetails.headOfficePostcode as any),

    assignedAccountManager: (raw.assignedAccountManager as any) ?? (accountDetails.assignedAccountManagerName as any),
    assignedAccountManagerId: (raw.assignedAccountManagerId as any) ?? (accountDetails.assignedAccountManagerId as any),
    assignedClientDdiNumber: (raw.assignedClientDdiNumber as any) ?? (accountDetails.assignedClientDdiNumber as any),

    emailAccounts,
    emailAccountsSetUp,

    logoUrl: raw.logoUrl as any,
    aboutSource: raw.aboutSource as any,
    aboutLocked: raw.aboutLocked as any,

    // Required fields with sane defaults (Account Card must render consistently)
    status: (raw.status as any) ?? mapClientStatusToAccountStatus(customer.clientStatus),
    targetLocation: (raw.targetLocation as any) ?? targetLocationFromDb,
    targetTitle: String((raw.targetTitle ?? customer.targetJobTitle ?? '') || ''),
    clientProfile: (raw.clientProfile as any) ?? (raw.clientProfile as any) ?? undefined,
    monthlySpendGBP,
    agreements: (raw.agreements as any) ?? [],
    defcon: (toNumber(raw.defcon) ?? customer.defcon ?? 3) as any,
    contractStart: String((raw.contractStart ?? '') || ''),
    contractEnd: String((raw.contractEnd ?? '') || ''),
    days,
    contacts: (toNumber(raw.contacts) ?? contactCount ?? 0) as any,
    leads: (toNumber(raw.leads) ?? 0) as any,
    // Targets/actuals must be database-first (leadsSync writes weekly/monthly actuals to Customer columns).
    // Keep accountData fallbacks for legacy snapshots only.
    weeklyTarget: (customer.weeklyLeadTarget ?? toNumber(raw.weeklyTarget) ?? 0) as any,
    weeklyActual: (customer.weeklyLeadActual ?? toNumber(raw.weeklyActual) ?? 0) as any,
    monthlyTarget: (customer.monthlyLeadTarget ?? toNumber(raw.monthlyTarget) ?? 0) as any,
    monthlyActual: (customer.monthlyLeadActual ?? toNumber(raw.monthlyActual) ?? 0) as any,
    weeklyReport: String((raw.weeklyReport ?? '') || ''),
    users: (raw.users as any) ?? [],

    // Lead sheet URL is stored as top-level Customer scalar
    clientLeadsSheetUrl: customer.leadsReportingUrl || undefined,
    notes: raw.notes as any,
  }

  return account
}

/**
 * Convert AccountsTab Account to database Customer format (for updates)
 */
export function accountToDatabaseCustomer(account: Account): Partial<DatabaseCustomer> {
  // Join target locations back to comma-separated string (DB stores string)
  const prospectingLocation = Array.isArray(account.targetLocation) ? account.targetLocation.join(', ') : null

  return {
    name: account.name,
    domain: account.website ? account.website : null,
    website: account.website || null,
    leadsReportingUrl: account.clientLeadsSheetUrl || null,
    sector: account.sector || null,
    prospectingLocation,
    targetJobTitle: account.targetTitle || null,
    weeklyLeadTarget: account.weeklyTarget || null,
    weeklyLeadActual: account.weeklyActual || null,
    monthlyLeadTarget: account.monthlyTarget || null,
    monthlyLeadActual: account.monthlyActual || null,
    monthlyIntakeGBP: account.monthlySpendGBP?.toString() || null,
    // Keep account snapshot in accountData (single source of truth for Account Card)
    accountData: account as unknown as any,
    defcon: account.defcon || null,
  }
}

/**
 * Batch convert database customers to accounts
 */
export function databaseCustomersToAccounts(customers: DatabaseCustomer[]): Account[] {
  return customers.map(databaseCustomerToAccount)
}
