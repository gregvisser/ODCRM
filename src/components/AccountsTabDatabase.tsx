/**
 * Database-Powered Accounts Tab
 * 
 * This component wraps the existing AccountsTab with database-first architecture.
 * It loads data from Azure PostgreSQL (via /api/customers) instead of localStorage.
 * 
 * ARCHITECTURE (Fixed - 2026-02-05):
 * - Data Source: Azure PostgreSQL database (SINGLE source of truth)
 * - Data Flow: Database → API → React Hook → Mapper → AccountsTab UI
 * - Sync: Listen for 'accountsUpdated' events and persist to database via API
 * 
 * IMPORTANT: 
 * - localStorage hydration happens ONCE on mount only
 * - All account changes are synced to database via 'accountsUpdated' event listener
 * - NO optimistic updates - database is always the source of truth
 * 
 * See ARCHITECTURE.md for full details.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { Box, Spinner, Alert, AlertIcon, AlertTitle, AlertDescription, Button, VStack, Text, Badge, HStack, useToast } from '@chakra-ui/react'
import { useCustomersFromDatabase } from '../hooks/useCustomersFromDatabase'
import { databaseCustomersToAccounts, accountToDatabaseCustomer, type Account } from '../utils/customerAccountMapper'
import { setJson, getJson } from '../platform/storage'
import { OdcrmStorageKeys } from '../platform/keys'
import { on } from '../platform/events'
import AccountsTab from './AccountsTab'

type Props = {
  focusAccountName?: string
}

export default function AccountsTabDatabase({ focusAccountName }: Props) {
  const { customers, loading, error, refetch, updateCustomer, createCustomer } = useCustomersFromDatabase()
  const [isHydrating, setIsHydrating] = useState(true)
  const [dataReady, setDataReady] = useState(false)
  const hasHydratedRef = useRef(false)
  const isSyncingRef = useRef(false)
  const lastSyncedHashRef = useRef<string>('')
  const toast = useToast()

  // ONE-TIME hydration: Load database data into localStorage on mount
  // This runs ONCE and then stops - no more sync loops
  useEffect(() => {
    if (loading) return
    if (hasHydratedRef.current) return // Already hydrated - don't overwrite user changes
    
    // Convert database customers to Account format
    const dbAccounts = databaseCustomersToAccounts(customers)
    
    // Get current localStorage data
    const currentAccounts = getJson<Account[]>(OdcrmStorageKeys.accounts)
    
    // ONLY hydrate if localStorage is empty or has fewer accounts than database
    // This prevents overwriting user changes with stale database data
    const shouldHydrate = !currentAccounts || 
                          currentAccounts.length === 0 || 
                          currentAccounts.length < dbAccounts.length
    
    if (shouldHydrate && dbAccounts.length > 0) {
      console.log('🔄 ONE-TIME hydration from database...', dbAccounts.length, 'accounts')
      setJson(OdcrmStorageKeys.accounts, dbAccounts)
      setJson(OdcrmStorageKeys.accountsLastUpdated, new Date().toISOString())
      lastSyncedHashRef.current = JSON.stringify(dbAccounts)
      console.log('✅ localStorage hydrated with', dbAccounts.length, 'accounts from database')
    } else {
      console.log('⏭️ Skipping hydration - localStorage already has data or database is empty')
      if (currentAccounts) {
        lastSyncedHashRef.current = JSON.stringify(currentAccounts)
      }
    }
    
    hasHydratedRef.current = true
    setIsHydrating(false)
    setDataReady(true)
  }, [customers, loading])

  // Sync account to database - called when accountsUpdated event is received
  const syncAccountToDatabase = useCallback(async (account: Account) => {
    if (!account._databaseId) {
      // New account - create in database
      console.log('➕ Creating new account in database:', account.name)
      const dbData = accountToDatabaseCustomer(account)
      const result = await createCustomer(dbData)
      if (result.error) {
        console.error('❌ Failed to create account:', result.error)
        toast({
          title: 'Save Failed',
          description: `Failed to save ${account.name}: ${result.error}`,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        return false
      }
      console.log('✅ Account created in database:', account.name)
      return true
    } else {
      // Existing account - update in database
      console.log('✏️ Updating account in database:', account.name)
      const dbData = accountToDatabaseCustomer(account)
      const result = await updateCustomer(account._databaseId, dbData)
      if (result.error) {
        console.error('❌ Failed to update account:', result.error)
        toast({
          title: 'Save Failed',
          description: `Failed to save ${account.name}: ${result.error}`,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        return false
      }
      console.log('✅ Account updated in database:', account.name)
      return true
    }
  }, [createCustomer, updateCustomer, toast])

  // Listen for 'accountsUpdated' events from AccountsTab and sync to database
  useEffect(() => {
    if (!dataReady) return
    
    const handleAccountsUpdated = async (updatedAccounts: Account[]) => {
      if (isSyncingRef.current) return
      
      const currentHash = JSON.stringify(updatedAccounts)
      if (currentHash === lastSyncedHashRef.current) {
        console.log('⏭️ No changes to sync')
        return
      }
      
      isSyncingRef.current = true
      console.log('🔄 Syncing account changes to database...')
      
      try {
        // Find accounts that changed by comparing with database customers
        for (const account of updatedAccounts) {
          // Find matching database customer
          const dbCustomer = customers.find(c => 
            c.id === account._databaseId || c.name === account.name
          )
          
          if (!dbCustomer) {
            // New account - create
            await syncAccountToDatabase(account)
          } else {
            // Check if account data changed
            const dbAccount = databaseCustomersToAccounts([dbCustomer])[0]
            if (dbAccount && JSON.stringify(dbAccount) !== JSON.stringify(account)) {
              // Account changed - update
              await syncAccountToDatabase({ ...account, _databaseId: dbCustomer.id })
            }
          }
        }
        
        lastSyncedHashRef.current = currentHash
        console.log('✅ Database sync complete')
      } catch (err) {
        console.error('❌ Database sync failed:', err)
        toast({
          title: 'Sync Error',
          description: 'Failed to sync changes to database. Please try again.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      } finally {
        isSyncingRef.current = false
      }
    }
    
    // Subscribe to accountsUpdated events
    const unsubscribe = on<Account[]>('accountsUpdated', handleAccountsUpdated)
    
    return () => unsubscribe()
  }, [dataReady, customers, syncAccountToDatabase, toast])

  if (loading && !dataReady) {
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
          Data source: Database
        </Badge>
      </HStack>
      
      {/* Render AccountsTab - disable until data is ready */}
      {dataReady ? (
        <AccountsTab focusAccountName={focusAccountName} />
      ) : (
        <Box textAlign="center" py={10}>
          <Spinner size="lg" />
          <Text mt={2} color="gray.500">Preparing data...</Text>
        </Box>
      )}
    </Box>
  )
}
