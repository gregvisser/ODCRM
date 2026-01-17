import {
  Badge,
  Box,
  Divider,
  Heading,
  HStack,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react'
import { useCustomerPerformanceData } from './useCustomerPerformanceData'

const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const numberFormatter = new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 0,
})

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper?: string
}) {
  return (
    <Box
      borderRadius="2xl"
      border="1px solid"
      borderColor="border.subtle"
      bg="bg.surface"
      p={5}
      boxShadow="sm"
    >
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.2em" color="text.muted" fontWeight="bold">
        {label}
      </Text>
      <Heading size="lg" mt={2}>
        {value}
      </Heading>
      {helper ? (
        <Text fontSize="sm" color="text.muted" mt={1}>
          {helper}
        </Text>
      ) : null}
    </Box>
  )
}

// Removed getDefconColor - using gray for all badges

export default function CustomersOverviewTab() {
  const { rows, totals, meta } = useCustomerPerformanceData()

  const sortedByPercent = [...rows].sort((a, b) => b.percentToTarget - a.percentToTarget)
  const topPerformers = sortedByPercent.slice(0, 4)
  const watchlist = rows
    .filter((row) => row.account.defcon <= 2 || row.percentToTarget < 0.25)
    .sort((a, b) => a.account.defcon - b.account.defcon || a.percentToTarget - b.percentToTarget)
    .slice(0, 4)

  const avgPercent = totals.monthlyTarget > 0 ? totals.monthlyActual / totals.monthlyTarget : 0
  const weeklyMomentum = totals.weeklyTarget > 0 ? totals.weeklyActual / totals.weeklyTarget : 0
  const formattedSync =
    meta.lastSyncedAt?.toLocaleString('en-GB', {
      hour12: false,
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }) ?? 'Awaiting first sync'

  if (rows.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Heading size="md">
          No accounts available
        </Heading>
        <Text mt={2} color="text.muted">
          Accounts will appear here as soon as they are configured in the Accounts workspace.
        </Text>
      </Box>
    )
  }

  return (
    <Stack spacing={10}>
      <Box
        borderRadius="3xl"
        px={{ base: 6, md: 10 }}
        py={{ base: 8, md: 12 }}
        bg="bg.surface"
        border="1px solid"
        borderColor="border.subtle"
        position="relative"
        overflow="hidden"
      >
        <Stack spacing={6} position="relative">
          <Box>
            <Text fontSize="xs" letterSpacing="0.35em" textTransform="uppercase" color="text.muted" fontWeight="bold">
              Client Performance Command Center
            </Text>
            <Heading size="lg" mt={2}>
              Client Lead Generation Dashboard
            </Heading>
            <HStack spacing={3} mt={3} flexWrap="wrap">
              <Badge variant="subtle" colorScheme="gray" px={3} py={1}>
                {meta.currentMonthLabel}
              </Badge>
              <Badge variant="subtle" colorScheme="gray" px={3} py={1}>
                {meta.currentWeekLabel}
              </Badge>
              <Badge variant="subtle" colorScheme="gray" px={3} py={1}>
                Last sync: {formattedSync}
              </Badge>
            </HStack>
          </Box>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={5}>
            <MetricCard label="Total Accounts" value={String(rows.length)} helper="Active client workstreams" />
            <MetricCard
              label="Leads This Week"
              value={numberFormatter.format(totals.weeklyActual)}
              helper={`Target ${numberFormatter.format(totals.weeklyTarget)}`}
            />
            <MetricCard
              label="Month-to-Date"
              value={numberFormatter.format(totals.monthlyActual)}
              helper={`Target ${numberFormatter.format(totals.monthlyTarget)}`}
            />
            <MetricCard
              label="Avg % to Target"
              value={percentFormatter.format(avgPercent)}
              helper={`Weekly momentum ${percentFormatter.format(weeklyMomentum)}`}
            />
          </SimpleGrid>
        </Stack>
      </Box>

      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={8}>
        <Box borderRadius="2xl" border="1px solid" borderColor="border.subtle" p={6} bg="bg.surface" boxShadow="lg">
          <HStack justify="space-between" align="center" mb={6}>
            <Box>
              <Text fontSize="sm" color="text.muted" textTransform="uppercase" letterSpacing="0.2em">
                Top Momentum
              </Text>
              <Heading size="md" mt={1}>
                Accounts pacing ahead of target
              </Heading>
            </Box>
            <Badge variant="subtle" colorScheme="gray">
              {topPerformers.length} spotlighted
            </Badge>
          </HStack>
          <Table variant="simple" size="sm">
            <Thead bg="bg.subtle">
              <Tr>
                <Th>Client</Th>
                <Th isNumeric>Month Actual</Th>
                <Th isNumeric>% to Target</Th>
              </Tr>
            </Thead>
            <Tbody>
              {topPerformers.map((row) => (
                <Tr key={row.account.name}>
                  <Td>
                    <Text fontWeight="semibold" color="text.primary">{row.account.name}</Text>
                    <Text fontSize="xs" color="text.muted">
                      DEFCON {row.account.defcon}
                    </Text>
                  </Td>
                  <Td isNumeric>
                    <Text fontWeight="semibold" color="text.primary">{numberFormatter.format(row.monthlyActual)}</Text>
                    <Text fontSize="xs" color="text.muted">
                      Target {numberFormatter.format(row.monthlyTarget)}
                    </Text>
                  </Td>
                  <Td isNumeric>
                    <Box>
                      <Text fontWeight="semibold" color="text.muted">
                        {percentFormatter.format(row.percentToTarget)}
                      </Text>
                      <Progress
                        value={row.percentToTarget * 100}
                        size="xs"
                        colorScheme="gray"
                        borderRadius="full"
                        mt={1}
                      />
                    </Box>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>

        <Box borderRadius="2xl" border="1px solid" borderColor="border.subtle" p={6} bg="bg.surface" boxShadow="lg">
          <HStack justify="space-between" align="center" mb={6}>
            <Box>
              <Text fontSize="sm" color="text.muted" textTransform="uppercase" letterSpacing="0.2em">
                DEFCON Watchlist
              </Text>
              <Heading size="md" mt={1}>
                Accounts requiring attention
              </Heading>
            </Box>
            <Badge variant="subtle" colorScheme="gray">
              {watchlist.length || 0} alerts
            </Badge>
          </HStack>

          {watchlist.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Text fontSize="lg" color="text.muted">
                No critical accounts right now 🎯
              </Text>
              <Text fontSize="sm" color="text.muted" mt={2}>
                Keep logging leads to maintain this trend.
              </Text>
            </Box>
          ) : (
            <Stack spacing={4}>
              {watchlist.map((row) => (
                <Box
                  key={row.account.name}
                  borderRadius="xl"
                  border="1px solid"
                  borderColor="border.subtle"
                  p={4}
                  bg="bg.subtle"
                >
                  <HStack justify="space-between" mb={2}>
                    <Text fontWeight="semibold" fontSize="lg" color="text.primary">
                      {row.account.name}
                    </Text>
                    <Badge variant="subtle" colorScheme="gray">
                      DEFCON {row.account.defcon}
                    </Badge>
                  </HStack>
                  <Text fontSize="sm" color="text.muted">
                    Month performance {percentFormatter.format(row.percentToTarget)} • {numberFormatter.format(row.monthlyActual)} /{' '}
                    {numberFormatter.format(row.monthlyTarget)} leads
                  </Text>
                  <Progress
                    value={row.percentToTarget * 100}
                    size="sm"
                    borderRadius="full"
                    mt={3}
                    colorScheme="gray"
                  />
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </SimpleGrid>

      <Box borderRadius="2xl" border="1px solid" borderColor="border.subtle" bg="bg.surface" p={6} boxShadow="md">
        <HStack justify="space-between" mb={4} flexWrap="wrap" gap={4}>
          <Box>
            <Text fontSize="sm" color="text.muted" textTransform="uppercase" letterSpacing="0.2em">
              Investment Allocation
            </Text>
            <Heading size="md" mt={1}>
              Monthly spend by account
            </Heading>
          </Box>
          <Badge variant="subtle" colorScheme="gray">
            Total budget {currencyFormatter.format(totals.spend)}
          </Badge>
        </HStack>
        <Divider mb={4} />
        <VStack align="stretch" spacing={4}>
          {[...rows]
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 6)
            .map((row) => (
              <HStack key={row.account.name} justify="space-between" align="center">
                <Box>
                  <Text fontWeight="medium" color="text.primary">{row.account.name}</Text>
                  <Text fontSize="xs" color="text.muted">
                    Leads this month: {numberFormatter.format(row.monthlyActual)}
                  </Text>
                </Box>
                <HStack spacing={6}>
                  <Text fontWeight="semibold">
                    {currencyFormatter.format(row.spend)}
                  </Text>
                  <Box minW="160px">
                    <Progress
                      value={row.percentToTarget * 100}
                      size="sm"
                      borderRadius="full"
                      colorScheme="gray"
                    />
                  </Box>
                </HStack>
              </HStack>
            ))}
        </VStack>
      </Box>
    </Stack>
  )
}


