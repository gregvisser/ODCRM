/**
 * Database-Powered Accounts Tab
 * 
 * This component wraps the existing AccountsTab with database-first architecture.
 * It loads data from Azure PostgreSQL (via /api/customers) instead of localStorage.
 * 
 * ARCHITECTURE (Fixed - 2026-02-05):
 * - Data Source: Azure PostgreSQL database (SINGLE source of truth)
 * - Data Flow: Database → API → React Hook → Mapper → AccountsTab UI
 * - NO localStorage sync loops - removed to fix "save then revert" bug
 * 
 * IMPORTANT: localStorage hydration happens ONCE on mount only.
 * After initial load, AccountsTab changes go directly to database via API.
 * 
 * See ARCHITECTURE.md for full details.
 */

import { useEffect, useState, useRef } from 'react'
import { Box, Spinner, Alert, AlertIcon, AlertTitle, AlertDescription, Button, VStack, Text, Badge, HStack, useToast } from '@chakra-ui/react'
import { useCustomersFromDatabase } from '../hooks/useCustomersFromDatabase'
import { databaseCustomersToAccounts, type Account } from '../utils/customerAccountMapper'
import type { DatabaseCustomer } from '../hooks/useCustomersFromDatabase'
import { setJson, getJson } from '../platform/storage'
import { OdcrmStorageKeys } from '../platform/keys'
import AccountsTab from './AccountsTab'

// Migration flag key - used to show toast only once
const MIGRATION_TOAST_SHOWN_KEY = 'odcrm_id_migration_toast_shown'

/**
 * Normalize domain for comparison (lowercase, trim whitespace)
 */
function normalizeDomain(domain: string | undefined): string {
  if (!domain) return ''
  return domain.toLowerCase().trim()
}

/**
 * Check if an ID is a canonical database ID (starts with "cust_")
 */
function isCanonicalId(id: string | undefined): boolean {
  return typeof id === 'string' && id.startsWith('cust_')
}

/**
 * Migrate localStorage accounts to use canonical database IDs.
 * Returns the migrated accounts array and whether migration occurred.
 */
function migrateAccountIds(
  cachedAccounts: Account[],
  dbCustomers: DatabaseCustomer[]
): { migrated: Account[]; didMigrate: boolean } {
  // If all accounts already have canonical IDs, no migration needed
  const allHaveCanonicalIds = cachedAccounts.every(acc => isCanonicalId(acc.id))
  if (allHaveCanonicalIds) {
    return { migrated: cachedAccounts, didMigrate: false }
  }

  // Build indexes from DB customers
  const byNormalizedDomain = new Map<string, DatabaseCustomer[]>()
  const byExactName = new Map<string, DatabaseCustomer[]>()

  for (const customer of dbCustomers) {
    // Index by normalized domain
    const domain = normalizeDomain(customer.domain)
    if (domain) {
      const existing = byNormalizedDomain.get(domain) || []
      existing.push(customer)
      byNormalizedDomain.set(domain, existing)
    }

    // Index by exact name
    const name = customer.name?.trim()
    if (name) {
      const existing = byExactName.get(name) || []
      existing.push(customer)
      byExactName.set(name, existing)
    }
  }

  let didMigrate = false
  const migrated = cachedAccounts.map(account => {
    // Already has canonical ID - keep as is
    if (isCanonicalId(account.id)) {
      return account
    }

    // Has _databaseId that is canonical - use it
    if (isCanonicalId(account._databaseId)) {
      didMigrate = true
      return { ...account, id: account._databaseId }
    }

    // Try to match by domain/website (exact normalized match)
    const accountDomain = normalizeDomain(account.website)
    if (accountDomain) {
      const domainMatches = byNormalizedDomain.get(accountDomain) || []
      if (domainMatches.length === 1) {
        didMigrate = true
        if (process.env.NODE_ENV === 'development') {
          console.log('[Migration] Matched by domain:', account.name, '->', domainMatches[0].id)
        }
        return { ...account, id: domainMatches[0].id, _databaseId: domainMatches[0].id }
      }
    }

    // Try to match by exact name (only if unique)
    const accountName = account.name?.trim()
    if (accountName) {
      const nameMatches = byExactName.get(accountName) || []
      if (nameMatches.length === 1) {
        didMigrate = true
        if (process.env.NODE_ENV === 'development') {
          console.log('[Migration] Matched by name:', account.name, '->', nameMatches[0].id)
        }
        return { ...account, id: nameMatches[0].id, _databaseId: nameMatches[0].id }
      }
    }

    // Ambiguous or no match - mark as invalid
    if (process.env.NODE_ENV === 'development') {
      console.log('[Migration] No unique match for:', account.name, '- marking invalid')
    }
    return { ...account, __invalidId: true }
  })

  return { migrated, didMigrate }
}

type Props = {
  focusAccountName?: string
}

export default function AccountsTabDatabase({ focusAccountName }: Props) {
  const { customers, loading, error, refetch } = useCustomersFromDatabase()
  const toast = useToast()
  const hasMigratedRef = useRef(false)

  // Convert database customers to Account format (derived state, recalculates when customers change)
  const dbAccounts = databaseCustomersToAccounts(customers)
  
  // ONE-TIME migration: Fix legacy localStorage entries
  // Uses BOTH ref (session) and localStorage flag (persistent) to ensure single execution
  useEffect(() => {
    if (loading) return
    if (hasMigratedRef.current) return
    
    // Hard stop: check persistent flag BEFORE doing anything
    const MIGRATION_COMPLETE_KEY = 'odcrm_migration_v2_complete'
    if (localStorage.getItem(MIGRATION_COMPLETE_KEY)) {
      hasMigratedRef.current = true
      return
    }
    
    hasMigratedRef.current = true
    localStorage.setItem(MIGRATION_COMPLETE_KEY, 'true')
    
    // Get current localStorage data to migrate
    const currentAccounts = getJson<Account[]>(OdcrmStorageKeys.accounts)
    
    // MIGRATION: Check if we need to fix localStorage IDs
    if (currentAccounts && currentAccounts.length > 0) {
      const { migrated, didMigrate } = migrateAccountIds(currentAccounts, customers)
      
      if (didMigrate) {
        console.log('[Migration] Updating localStorage with canonical IDs... (one-time)')
        setJson(OdcrmStorageKeys.accounts, migrated)
        
        // Show one-time toast if not already shown
        const toastShown = localStorage.getItem(MIGRATION_TOAST_SHOWN_KEY)
        if (!toastShown) {
          localStorage.setItem(MIGRATION_TOAST_SHOWN_KEY, 'true')
          toast({
            title: 'Cache Updated',
            description: 'Updated local cache to match database IDs.',
            status: 'info',
            duration: 5000,
            isClosable: true,
          })
        }
      }
    }
    
    // Sync localStorage as a passive cache ONCE
    if (customers.length > 0) {
      console.log('[Hydration] ONE-TIME localStorage sync with', customers.length, 'DB customers')
      const accountsFromDb = databaseCustomersToAccounts(customers)
      setJson(OdcrmStorageKeys.accounts, accountsFromDb)
      setJson(OdcrmStorageKeys.accountsLastUpdated, new Date().toISOString())
    }
  }, [customers, loading, toast]) // Removed dbAccounts from deps to prevent re-running

  // NO MORE localStorage monitoring - removed to fix "save then revert" bug
  // AccountsTab will save directly to database via API when user saves

  if (loading) {
    return (
      <VStack py={10} spacing={4}>
        <Spinner size="xl" color="orange.500" thickness="4px" />
        <Box textAlign="center">
          <Text fontSize="lg" fontWeight="bold">Loading customers from database...</Text>
          <Text color="gray.600">
            Fetching fresh data from Azure PostgreSQL
          </Text>
        </Box>
      </VStack>
    )
  }

  if (error) {
    return (
      <Alert status="error" borderRadius="lg">
        <AlertIcon />
        <VStack align="start" spacing={2}>
          <AlertTitle>Failed to load customers from database</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button size="sm" colorScheme="red" onClick={() => refetch()}>
            Retry
          </Button>
        </VStack>
      </Alert>
    )
  }

  return (
    <Box>
      {/* Data source indicator */}
      <HStack mb={2} justify="flex-end">
        <Badge colorScheme="green" fontSize="xs" px={2} py={1}>
          Data source: Database ({dbAccounts.length} accounts)
        </Badge>
      </HStack>
      
      {/* Render AccountsTab with DB accounts as source of truth */}
      <AccountsTab 
        focusAccountName={focusAccountName} 
        dbAccounts={dbAccounts}
        dataSource="DB"
      />
    </Box>
  )
}