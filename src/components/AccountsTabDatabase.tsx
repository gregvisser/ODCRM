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
import { Box, Spinner, Alert, AlertIcon, AlertTitle, AlertDescription, Button, VStack, Text, Badge, HStack } from '@chakra-ui/react'
import { useCustomersFromDatabase } from '../hooks/useCustomersFromDatabase'
import { databaseCustomersToAccounts, type Account } from '../utils/customerAccountMapper'
import { setJson, getJson } from '../platform/storage'
import { OdcrmStorageKeys } from '../platform/keys'
import AccountsTab from './AccountsTab'

type Props = {
  focusAccountName?: string
}

export default function AccountsTabDatabase({ focusAccountName }: Props) {
  const { customers, loading, error, refetch } = useCustomersFromDatabase()
  const [isHydrating, setIsHydrating] = useState(true)
  const [dataReady, setDataReady] = useState(false)
  const hasHydratedRef = useRef(false)

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
      console.log('✅ localStorage hydrated with', dbAccounts.length, 'accounts from database')
    } else {
      console.log('⏭️ Skipping hydration - localStorage already has data or database is empty')
    }
    
    hasHydratedRef.current = true
    setIsHydrating(false)
    setDataReady(true)
  }, [customers, loading])

  // NO MORE localStorage monitoring - removed to fix "save then revert" bug
  // AccountsTab will save directly to database via API when user saves

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
