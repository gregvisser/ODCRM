/**
 * Database-Powered Accounts Tab
 * 
 * This component wraps the existing AccountsTab with database-first architecture.
 * It loads data from Azure PostgreSQL (via /api/customers) instead of localStorage.
 * 
 * ARCHITECTURE:
 * - Data Source: Azure PostgreSQL database (single source of truth)
 * - Data Flow: Database → API → React Hook → Mapper → AccountsTab UI
 * - Saves: AccountsTab localStorage changes → auto-sync → Database
 * 
 * TRANSITIONAL APPROACH:
 * The existing AccountsTab is 6000+ lines with localStorage deeply integrated.
 * Rather than rewriting everything at once, we use a hybrid approach:
 * 1. Load fresh data from database on mount
 * 2. Hydrate localStorage with database data
 * 3. Monitor localStorage for changes
 * 4. Sync changes back to database
 * 
 * This ensures database is ALWAYS the source of truth, while allowing
 * the existing AccountsTab UI to continue working during the transition.
 * 
 * See ARCHITECTURE.md for full details.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { Box, Spinner, Alert, AlertIcon, AlertTitle, AlertDescription, Button, VStack, Text, useToast } from '@chakra-ui/react'
import { useCustomersFromDatabase } from '../hooks/useCustomersFromDatabase'
import { databaseCustomersToAccounts, databaseCustomerToAccount, accountToDatabaseCustomer, type Account } from '../utils/customerAccountMapper'
import { setJson, getJson } from '../platform/storage'
import { OdcrmStorageKeys } from '../platform/keys'
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

    console.log('🔄 Hydrating localStorage from database...', customers.length, 'customers')
    
    // Convert database customers to Account format
    const accounts = databaseCustomersToAccounts(customers)
    
    // Write to localStorage so AccountsTab can read it
    // This is the transitional bridge between old (localStorage) and new (database) architecture
    setJson(OdcrmStorageKeys.accounts, accounts)
    setJson(OdcrmStorageKeys.accountsLastUpdated, new Date().toISOString())
    
    // Store hash to detect changes later
    lastLocalStorageHashRef.current = JSON.stringify(accounts)
    
    console.log('✅ localStorage hydrated with', accounts.length, 'accounts from database')
    
    setIsHydrating(false)
  }, [customers, loading])

  // Monitor localStorage for changes and sync back to database
  // This ensures any changes made by AccountsTab are persisted to the database
  useEffect(() => {
    const syncToDatabase = async () => {
      if (isSyncingToDbRef.current) return
      
      // Read current accounts from localStorage
      const currentAccounts = getJson<Account[]>(OdcrmStorageKeys.accounts)
      if (!currentAccounts) return

      const currentHash = JSON.stringify(currentAccounts)
      
      // Check if localStorage has changed
      if (currentHash === lastLocalStorageHashRef.current) return
      
      console.log('🔄 localStorage changed, syncing to database...')
      isSyncingToDbRef.current = true

      try {
        // For each account in localStorage, check if it needs to be saved to database
        for (const account of currentAccounts) {
          if (!account._databaseId) {
            // New account - create in database
            console.log('➕ Creating new account in database:', account.name)
            const dbData = accountToDatabaseCustomer(account)
            await createCustomer(dbData)
          } else {
            // Existing account - check if it changed
            const dbCustomer = customers.find(c => c.id === account._databaseId)
            if (dbCustomer) {
              const dbAccount = databaseCustomerToAccount(dbCustomer)
              // Simple change detection - if any field differs, update
              if (JSON.stringify(dbAccount) !== JSON.stringify(account)) {
                console.log('✏️ Updating account in database:', account.name)
                const dbData = accountToDatabaseCustomer(account)
                await updateCustomer(account._databaseId, dbData)
              }
            }
          }
        }

        // Update the hash
        lastLocalStorageHashRef.current = currentHash
        console.log('✅ Sync to database complete')
        
        // Refresh from database to get any server-generated fields
        await refetch()
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
    }

    // Check for changes every 2 seconds
    const interval = setInterval(syncToDatabase, 2000)

    // Also listen for storage events from other tabs
    window.addEventListener('storage', syncToDatabase)

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', syncToDatabase)
    }
  }, [customers, updateCustomer, createCustomer, refetch, toast])

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
      {/* Info banner */}
      <Alert status="success" borderRadius="lg" mb={4}>
        <AlertIcon />
        <VStack align="start" spacing={1}>
          <AlertTitle fontSize="sm">Database-Powered System Active</AlertTitle>
          <AlertDescription fontSize="xs">
            All data is loaded from Azure PostgreSQL. {customers.length} customers synced.
            <Button size="xs" ml={2} variant="ghost" onClick={() => refetch()}>
              Refresh
            </Button>
          </AlertDescription>
        </VStack>
      </Alert>

      {/* Render the existing AccountsTab - it will read from the hydrated localStorage */}
      <AccountsTab focusAccountName={focusAccountName} />
    </Box>
  )
}
