/**
 * Migration Panel Component
 * 
 * Provides a UI to migrate accounts from localStorage to the database.
 * This component should be temporarily added to the Customers page
 * to help users migrate their data after the Azure migration.
 */

import { useState } from 'react'
import {
  Box,
  Button,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  VStack,
  HStack,
  Text,
  Badge,
  Progress,
  Code,
  List,
  ListItem,
  ListIcon,
  Collapse,
  useDisclosure,
} from '@chakra-ui/react'
import { CheckCircleIcon, WarningIcon, InfoIcon } from '@chakra-ui/icons'
import { migrateAccountsToDatabase } from '../utils/migrateAccountsToDatabase'
import { getJson } from '../platform/storage'
import { OdcrmStorageKeys } from '../platform/keys'

export default function MigrateAccountsPanel() {
  const [isChecking, setIsChecking] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [localStorageCount, setLocalStorageCount] = useState<number | null>(null)
  const [migrationResult, setMigrationResult] = useState<{
    success: number
    failed: number
    skipped: number
    errors: string[]
  } | null>(null)
  
  const { isOpen: showDetails, onToggle: toggleDetails } = useDisclosure()

  const checkLocalStorage = () => {
    setIsChecking(true)
    try {
      const accounts = getJson<any[]>(OdcrmStorageKeys.accounts)
      const count = accounts?.length || 0
      setLocalStorageCount(count)
    } catch (error) {
      console.error('Error checking localStorage:', error)
      setLocalStorageCount(0)
    } finally {
      setIsChecking(false)
    }
  }

  const runDryRun = async () => {
    setIsMigrating(true)
    setMigrationResult(null)
    try {
      const result = await migrateAccountsToDatabase({ dryRun: true, verbose: true })
      setMigrationResult(result)
    } catch (error: any) {
      console.error('Dry run error:', error)
      setMigrationResult({
        success: 0,
        failed: 1,
        skipped: 0,
        errors: [error.message || 'Unknown error'],
      })
    } finally {
      setIsMigrating(false)
    }
  }

  const runMigration = async () => {
    if (!confirm('Are you sure you want to migrate accounts to the database? This will create new customer records.')) {
      return
    }
    
    setIsMigrating(true)
    setMigrationResult(null)
    try {
      const result = await migrateAccountsToDatabase({ dryRun: false, verbose: true })
      setMigrationResult(result)
    } catch (error: any) {
      console.error('Migration error:', error)
      setMigrationResult({
        success: 0,
        failed: 1,
        skipped: 0,
        errors: [error.message || 'Unknown error'],
      })
    } finally {
      setIsMigrating(false)
    }
  }

  return (
    <Box
      bg="blue.50"
      border="2px solid"
      borderColor="blue.300"
      borderRadius="lg"
      p={6}
      mb={6}
    >
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between">
          <HStack>
            <InfoIcon color="blue.500" />
            <Text fontWeight="bold" fontSize="lg">
              Account Migration Tool
            </Text>
          </HStack>
          <Badge colorScheme="blue">Azure Migration</Badge>
        </HStack>

        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Data Migration Needed</AlertTitle>
            <AlertDescription>
              After the Azure migration, your customer accounts need to be migrated from browser storage to the database.
              This tool will help you migrate your accounts.
            </AlertDescription>
          </Box>
        </Alert>

        {localStorageCount === null ? (
          <Button
            onClick={checkLocalStorage}
            isLoading={isChecking}
            colorScheme="blue"
            variant="outline"
          >
            Check for Accounts in Browser Storage
          </Button>
        ) : (
          <VStack align="stretch" spacing={3}>
            <Alert status={localStorageCount > 0 ? 'success' : 'warning'} borderRadius="md">
              <AlertIcon />
              <AlertDescription>
                Found <strong>{localStorageCount}</strong> account{localStorageCount !== 1 ? 's' : ''} in browser storage
              </AlertDescription>
            </Alert>

            {localStorageCount > 0 && (
              <>
                <HStack spacing={3}>
                  <Button
                    onClick={runDryRun}
                    isLoading={isMigrating}
                    colorScheme="blue"
                    variant="outline"
                    flex={1}
                  >
                    Preview Migration (Dry Run)
                  </Button>
                  <Button
                    onClick={runMigration}
                    isLoading={isMigrating}
                    colorScheme="blue"
                    flex={1}
                    isDisabled={!migrationResult || migrationResult.success === 0}
                  >
                    Run Migration
                  </Button>
                </HStack>

                <Text fontSize="sm" color="gray.600">
                  <strong>Step 1:</strong> Click "Preview Migration" to see what will happen<br />
                  <strong>Step 2:</strong> If preview looks good, click "Run Migration" to import accounts
                </Text>
              </>
            )}

            {localStorageCount === 0 && (
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <Box>
                  <AlertTitle>No Accounts Found</AlertTitle>
                  <AlertDescription>
                    <VStack align="stretch" spacing={2} mt={2}>
                      <Text>Your browser storage appears to be empty. This could mean:</Text>
                      <List spacing={1} fontSize="sm">
                        <ListItem>
                          <ListIcon as={InfoIcon} color="orange.500" />
                          You're using a different browser or computer
                        </ListItem>
                        <ListItem>
                          <ListIcon as={InfoIcon} color="orange.500" />
                          Your browser storage was cleared
                        </ListItem>
                        <ListItem>
                          <ListIcon as={InfoIcon} color="orange.500" />
                          You haven't created any accounts yet
                        </ListItem>
                      </List>
                      <Text fontSize="sm" fontWeight="bold" mt={2}>
                        If you had accounts before, try opening this page on your old browser/computer
                        where you used ODCRM previously.
                      </Text>
                    </VStack>
                  </AlertDescription>
                </Box>
              </Alert>
            )}
          </VStack>
        )}

        {migrationResult && (
          <VStack align="stretch" spacing={3}>
            <Alert
              status={migrationResult.failed > 0 ? 'error' : migrationResult.success > 0 ? 'success' : 'info'}
              borderRadius="md"
            >
              <AlertIcon />
              <Box flex={1}>
                <AlertTitle>Migration Results</AlertTitle>
                <AlertDescription>
                  <HStack spacing={4} mt={2}>
                    <Badge colorScheme="green">✅ Success: {migrationResult.success}</Badge>
                    <Badge colorScheme="orange">⏭️ Skipped: {migrationResult.skipped}</Badge>
                    <Badge colorScheme="red">❌ Failed: {migrationResult.failed}</Badge>
                  </HStack>
                </AlertDescription>
              </Box>
            </Alert>

            {migrationResult.errors.length > 0 && (
              <>
                <Button onClick={toggleDetails} size="sm" variant="ghost">
                  {showDetails ? 'Hide' : 'Show'} Error Details
                </Button>
                <Collapse in={showDetails}>
                  <Box bg="red.50" p={3} borderRadius="md" border="1px solid" borderColor="red.200">
                    <Text fontWeight="bold" fontSize="sm" mb={2}>
                      Errors:
                    </Text>
                    {migrationResult.errors.map((error, i) => (
                      <Code key={i} display="block" p={2} mb={1} fontSize="xs" colorScheme="red">
                        {error}
                      </Code>
                    ))}
                  </Box>
                </Collapse>
              </>
            )}

            {migrationResult.success > 0 && (
              <Button
                onClick={() => window.location.reload()}
                colorScheme="green"
                leftIcon={<CheckCircleIcon />}
              >
                Refresh Page to See Migrated Accounts
              </Button>
            )}
          </VStack>
        )}

        {isMigrating && <Progress size="xs" isIndeterminate colorScheme="blue" />}
      </VStack>
    </Box>
  )
}
