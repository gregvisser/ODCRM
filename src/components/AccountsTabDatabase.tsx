/**
 * Database-Powered Accounts Tab
 *
 * This component wraps AccountsTab with database-first architecture.
 * It loads data from Azure PostgreSQL (via /api/customers) and overlays
 * live lead metrics for sheet-backed clients without hydrating localStorage.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Spinner, Alert, AlertIcon, AlertTitle, AlertDescription, Button, VStack, Text } from '@chakra-ui/react'
import { useCustomersFromDatabase } from '../hooks/useCustomersFromDatabase'
import { databaseCustomersToAccounts } from '../utils/customerAccountMapper'
import { fetchLiveMetricsForCustomers } from '../utils/liveLeadsApi'
import AccountsTab from './AccountsTab'
import { on } from '../platform/events'

type Props = {
  focusAccountName?: string
}

export default function AccountsTabDatabase({ focusAccountName }: Props) {
  const { customers, loading, error, refetch } = useCustomersFromDatabase()
  const [metricsByCustomerId, setMetricsByCustomerId] = useState<Record<string, { week: number; month: number; total: number }>>({})

  const refreshMetrics = useCallback(async () => {
    if (loading) return

    const scoped = customers
      .filter((customer) => customer.id && customer.name)
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        leadsReportingUrl: customer.leadsReportingUrl || null,
      }))

    if (scoped.length === 0) {
      setMetricsByCustomerId({})
      return
    }

    try {
      const summary = await fetchLiveMetricsForCustomers(scoped)
      const next = summary.perCustomer.reduce<Record<string, { week: number; month: number; total: number }>>((acc, customer) => {
        acc[customer.customerId] = {
          week: customer.counts.week,
          month: customer.counts.month,
          total: customer.counts.total,
        }
        return acc
      }, {})
      setMetricsByCustomerId(next)
    } catch {
      setMetricsByCustomerId({})
    }
  }, [customers, loading])

  const dbAccounts = useMemo(() => {
    const mapped = databaseCustomersToAccounts(customers)
    const customerById = new Map(customers.map((customer) => [customer.id, customer] as const))
    return mapped.map((account) => {
      const customerId = typeof account.id === 'string' ? account.id : ''
      const customer = customerById.get(customerId)
      const isSheetBacked = Boolean(customer?.leadsReportingUrl?.trim())
      const metrics = metricsByCustomerId[customerId]
      if (metrics) {
        return {
          ...account,
          leads: metrics.total,
          weeklyActual: metrics.week,
          monthlyActual: metrics.month,
          sheetMetricsUnavailable: false,
        }
      }

      if (!isSheetBacked) {
        return {
          ...account,
          sheetMetricsUnavailable: false,
        }
      }

      return {
        ...account,
        leads: 0,
        weeklyActual: 0,
        monthlyActual: 0,
        sheetMetricsUnavailable: true,
      }
    })
  }, [customers, metricsByCustomerId])

  useEffect(() => {
    void refreshMetrics()
  }, [refreshMetrics])

  useEffect(() => {
    if (loading) return
    const poll = window.setInterval(() => {
      void refreshMetrics()
    }, 30_000)
    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshMetrics()
      }
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => {
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [loading, refreshMetrics])

  useEffect(() => {
    const offLeadsUpdated = on('leadsUpdated', () => {
      void refreshMetrics()
    })
    const offCustomerUpdated = on('customerUpdated', () => {
      void refreshMetrics()
    })
    return () => {
      offLeadsUpdated()
      offCustomerUpdated()
    }
  }, [refreshMetrics])

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
      <AccountsTab
        focusAccountName={focusAccountName}
        dbAccounts={dbAccounts}
        dbCustomers={customers}
        dataSource="DB"
        refetchCustomers={refetch}
      />
    </Box>
  )
}
