/**
 * Migration Utility: Sync localStorage Accounts to Database Customers
 * 
 * This utility migrates accounts from the old localStorage system
 * to the new database-backed Customer model via the /api/customers API.
 * 
 * Usage:
 * 1. Open browser console on http://localhost:5173 (or production site)
 * 2. Run: await window.migrateAccountsToDatabase()
 * 3. Check results in console
 */

import { api } from './api'
import { getJson } from '../platform/storage'
import { OdcrmStorageKeys } from '../platform/keys'

// Account type from localStorage (AccountsTab)
export type Account = {
  name: string
  domain?: string
  website?: string
  whatTheyDo?: string
  accreditations?: string
  keyLeaders?: string
  companyProfile?: string
  recentNews?: string
  companySize?: string
  headquarters?: string
  foundingYear?: string
  socialPresence?: Array<{ label: string; url: string }>
  
  // Business details
  leadsReportingUrl?: string
  sector?: string
  status?: 'active' | 'inactive' | 'onboarding' | 'win_back'
  targetJobTitle?: string
  prospectingLocation?: string
  
  // Financial & performance
  monthlySpendGBP?: number
  defcon?: number
  
  // Lead targets & actuals
  weeklyTarget?: number
  weeklyActual?: number
  monthlyTarget?: number
  monthlyActual?: number
  
  // Other fields
  logoUrl?: string
  accountData?: any
}

// Customer type for API
type CustomerPayload = {
  name: string
  domain?: string | null
  accountData?: any
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
  leadsReportingUrl?: string | null
  sector?: string | null
  clientStatus?: 'active' | 'inactive' | 'onboarding' | 'win_back'
  targetJobTitle?: string | null
  prospectingLocation?: string | null
  monthlyIntakeGBP?: number | null
  defcon?: number | null
  weeklyLeadTarget?: number | null
  weeklyLeadActual?: number | null
  monthlyLeadTarget?: number | null
  monthlyLeadActual?: number | null
}

function mapAccountToCustomer(account: Account): CustomerPayload {
  return {
    name: account.name,
    domain: account.domain || account.website || null,
    accountData: account.accountData || null,
    website: account.website || account.domain || null,
    whatTheyDo: account.whatTheyDo || null,
    accreditations: account.accreditations || null,
    keyLeaders: account.keyLeaders || null,
    companyProfile: account.companyProfile || null,
    recentNews: account.recentNews || null,
    companySize: account.companySize || null,
    headquarters: account.headquarters || null,
    foundingYear: account.foundingYear || null,
    socialPresence: account.socialPresence || null,
    leadsReportingUrl: account.leadsReportingUrl || null,
    sector: account.sector || null,
    clientStatus: account.status || 'active',
    targetJobTitle: account.targetJobTitle || null,
    prospectingLocation: account.prospectingLocation || null,
    monthlyIntakeGBP: account.monthlySpendGBP || null,
    defcon: account.defcon || null,
    weeklyLeadTarget: account.weeklyTarget || null,
    weeklyLeadActual: account.weeklyActual || null,
    monthlyLeadTarget: account.monthlyTarget || null,
    monthlyLeadActual: account.monthlyActual || null,
  }
}

export async function migrateAccountsToDatabase(options?: { 
  dryRun?: boolean 
  verbose?: boolean 
}): Promise<{ success: number; failed: number; skipped: number; errors: string[] }> {
  const dryRun = options?.dryRun ?? false
  const verbose = options?.verbose ?? true
  
  console.log('🔄 Starting migration: localStorage Accounts → Database Customers')
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`)
  console.log('─'.repeat(60))
  
  // Load accounts from localStorage
  const accounts = getJson<Account[]>(OdcrmStorageKeys.accounts)
  
  if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
    console.log('❌ No accounts found in localStorage')
    console.log(`Checked key: ${OdcrmStorageKeys.accounts}`)
    return { success: 0, failed: 0, skipped: 0, errors: ['No accounts in localStorage'] }
  }
  
  console.log(`📦 Found ${accounts.length} accounts in localStorage`)
  console.log('─'.repeat(60))
  
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  }
  
  // Get existing customers from database
  const { data: existingCustomers, error: fetchError } = await api.get<Array<{ id: string; name: string }>>('/api/customers')
  
  if (fetchError) {
    console.error('❌ Failed to fetch existing customers:', fetchError)
    return { ...results, errors: [`Failed to fetch customers: ${fetchError}`] }
  }
  
  const existingNames = new Set(existingCustomers?.map(c => c.name.toLowerCase()) || [])
  if (verbose) {
    console.log(`📊 Database currently has ${existingCustomers?.length || 0} customers`)
    console.log('─'.repeat(60))
  }
  
  // Migrate each account
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i]
    const num = `[${i + 1}/${accounts.length}]`
    
    if (!account.name) {
      if (verbose) console.log(`${num} ⏭️  Skipped: Account has no name`)
      results.skipped++
      continue
    }
    
    // Check if customer already exists
    if (existingNames.has(account.name.toLowerCase())) {
      if (verbose) console.log(`${num} ⏭️  Skipped: "${account.name}" already exists in database`)
      results.skipped++
      continue
    }
    
    if (dryRun) {
      console.log(`${num} ✓ Would create: "${account.name}"`)
      results.success++
      continue
    }
    
    // Create customer in database
    const customerPayload = mapAccountToCustomer(account)
    const { error } = await api.post('/api/customers', customerPayload)
    
    if (error) {
      console.error(`${num} ❌ Failed: "${account.name}" - ${error}`)
      results.failed++
      results.errors.push(`${account.name}: ${error}`)
    } else {
      if (verbose) console.log(`${num} ✅ Created: "${account.name}"`)
      results.success++
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log('─'.repeat(60))
  console.log('📊 Migration Summary:')
  console.log(`   ✅ Success: ${results.success}`)
  console.log(`   ⏭️  Skipped: ${results.skipped} (already exist or invalid)`)
  console.log(`   ❌ Failed:  ${results.failed}`)
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  Errors:')
    results.errors.forEach(err => console.log(`   - ${err}`))
  }
  
  if (dryRun) {
    console.log('\n💡 This was a DRY RUN. Run with { dryRun: false } to apply changes.')
  } else if (results.success > 0) {
    console.log('\n✅ Migration complete! Refresh the Clients page to see your data.')
  }
  
  return results
}

// Make available on window for browser console access
if (typeof window !== 'undefined') {
  (window as any).migrateAccountsToDatabase = migrateAccountsToDatabase
}
