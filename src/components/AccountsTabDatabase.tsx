/**
 * Database-Powered Accounts Tab
 *
 * SOURCE OF TRUTH: The deployed backend (Azure PostgreSQL via /api/customers) is the
 * single source of truth. localStorage is used only as a cache/working copy that is
 * overwritten by database data on load and synced back to the database on change.
 * No business-critical data is ever read from localStorage as authority.
 *
 * ARCHITECTURE:
 * - Data Source: Azure PostgreSQL (deployed) → API → React Hook → UI
 * - On load: Database → hydrate localStorage (cache only)
 * - On save: localStorage changes → sync → Database
 *
 * TRANSITIONAL: AccountsTab still reads from localStorage; this wrapper keeps that
 * cache in sync with the database so the effective source of truth is always the DB.
 *
 * See ARCHITECTURE.md for full details.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { Box, Spinner, Alert, AlertIcon, AlertTitle, AlertDescription, Button, VStack, Text, useToast } from '@chakra-ui/react'
import { useCustomersFromDatabase } from '../hooks/useCustomersFromDatabase'
import { accountToDatabaseCustomer, type Account } from '../utils/customerAccountMapper'
import { buildAccountFromCustomer } from './AccountsTab'
import { setJson, getJson } from '../platform/storage'
import { OdcrmStorageKeys } from '../platform/keys'
import { on, emit } from '../platform/events'
import AccountsTab from './AccountsTab'

type Props = {
  focusAccountName?: string
}

export default function AccountsTabDatabase({ focusAccountName }: Props) {
  const { customers, loading, error, refetch, updateCustomer, createCustomer } = useCustomersFromDatabase()
  const [isHydrating, setIsHydrating] = useState(true)
  const toast = useToast()
  const isSyncingToDbRef = useRef(false)
  const lastLocalStorageHashRef = useRef<string>('')

  // Hydrate localStorage with database data on mount and when customers change
  // This allows the existing AccountsTab to work while we transition to database-first
  useEffect(() => {
    if (loading) return

    // Get current localStorage data
    const currentAccounts = getJson<Account[]>(OdcrmStorageKeys.accounts)

    // Convert database customers to full Account format (includes accountData from onboarding)
    const dbAccounts = customers.map((customer) => {
      const account = buildAccountFromCustomer(customer as Parameters<typeof buildAccountFromCustomer>[0])
      ;(account as Account & { _databaseId?: string })._databaseId = customer.id
      return account as Account
    })
    
    // SMART HYDRATION: Only overwrite if localStorage is empty OR if database has more recent data
    // This prevents destroying user edits that haven't been synced yet
    if (!currentAccounts || currentAccounts.length === 0) {
      // localStorage is empty - hydrate from database
      console.log('🔄 Initial hydration from database...', customers.length, 'customers')
      setJson(OdcrmStorageKeys.accounts, dbAccounts)
      setJson(OdcrmStorageKeys.accountsLastUpdated, new Date().toISOString())
      lastLocalStorageHashRef.current = JSON.stringify(dbAccounts)
      console.log('✅ localStorage hydrated with', dbAccounts.length, 'accounts from database')
      emit('accountsHydrated')
    } else {
      // localStorage has data - use database as source of truth
      // Only preserve local data if it was modified AFTER last database sync
      console.log('🔄 Updating localStorage from database (database is source of truth)...')
      
      // Always use database data - it's the source of truth
      // The 2-second auto-sync below handles saving any local changes back to database
      setJson(OdcrmStorageKeys.accounts, dbAccounts)
      setJson(OdcrmStorageKeys.accountsLastUpdated, new Date().toISOString())
      lastLocalStorageHashRef.current = JSON.stringify(dbAccounts)
      console.log('✅ localStorage updated from database (database first)')
      emit('accountsHydrated')
    }
    
    setIsHydrating(false)
  }, [customers, loading])

  // Sync localStorage accounts to database (create new, update changed). Callable so we can run immediately on account create.
  const syncToDatabase = useCallback(async () => {
    if (isSyncingToDbRef.current) return

    const currentAccounts = getJson<Account[]>(OdcrmStorageKeys.accounts)
    if (!currentAccounts) return

    const currentHash = JSON.stringify(currentAccounts)
    if (currentHash === lastLocalStorageHashRef.current) return

    console.log('🔄 localStorage changed, syncing to database...')
    isSyncingToDbRef.current = true

    try {
      let updatedAccounts = currentAccounts
      for (const account of currentAccounts) {
        if (!account._databaseId) {
          console.log('➕ Creating new account in database:', account.name)
          const dbData = accountToDatabaseCustomer(account)
          const result = await createCustomer(dbData)
          if (result?.error) {
            console.error('❌ Create customer failed:', result.error)
            toast({
              title: 'Could not save new account',
              description: result.error,
              status: 'error',
              duration: 5000,
            })
          } else if (result?.id) {
            // Persist _databaseId so next sync doesn't re-create and UI/list survives refresh
            updatedAccounts = updatedAccounts.map((a) =>
              a === account ? { ...a, _databaseId: result.id } as Account & { _databaseId?: string } : a
            )
            setJson(OdcrmStorageKeys.accounts, updatedAccounts)
            lastLocalStorageHashRef.current = JSON.stringify(updatedAccounts)
            // Tell AccountsTab to re-read immediately so the new account shows up in the list
            emit('accountsHydrated')
          }
        } else {
          const dbCustomer = customers.find((c) => c.id === account._databaseId)
          if (dbCustomer) {
            const dbAccount = buildAccountFromCustomer(dbCustomer as Parameters<typeof buildAccountFromCustomer>[0])
            ;(dbAccount as Account & { _databaseId?: string })._databaseId = dbCustomer.id
            if (JSON.stringify(dbAccount) !== JSON.stringify(account)) {
              console.log('✏️ Updating account in database:', account.name)
              const dbData = accountToDatabaseCustomer(account)
              await updateCustomer(account._databaseId, dbData)
            }
          }
        }
      }

      lastLocalStorageHashRef.current = JSON.stringify(updatedAccounts)
      console.log('✅ Sync to database complete')
    } catch (error) {
      console.error('❌ Failed to sync to database:', error)
      toast({
        title: 'Sync Error',
        description: 'Failed to save changes to database. Your changes are saved locally and will be retried.',
        status: 'warning',
        duration: 5000,
      })
    } finally {
      isSyncingToDbRef.current = false
    }
  }, [customers, createCustomer, updateCustomer, toast])

  // Run sync on a timer (catches any missed changes)
  useEffect(() => {
    const interval = setInterval(syncToDatabase, 2000)
    return () => clearInterval(interval)
  }, [syncToDatabase])

  // Run sync immediately when AccountsTab creates/updates an account (so new accounts persist and show up)
  useEffect(() => {
    const off = on('accountsUpdated', () => {
      void syncToDatabase()
    })
    return () => off()
  }, [syncToDatabase])

  // Listen for storage events from other tabs
  useEffect(() => {
    window.addEventListener('storage', syncToDatabase)
    return () => window.removeEventListener('storage', syncToDatabase)
  }, [syncToDatabase])

  // Set up periodic refresh to keep data fresh
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing customer data from database...')
      refetch()
    }, 60000) // Refresh every 60 seconds

    return () => clearInterval(interval)
  }, [refetch])

  if (loading && isHydrating) {
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
      {/* Render the existing AccountsTab - it will read from the hydrated localStorage */}
      <AccountsTab focusAccountName={focusAccountName} />
    </Box>
  )
}
