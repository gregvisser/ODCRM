import {
  Badge,
  Box,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { useCustomerPerformanceData } from './useCustomerPerformanceData'

const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 0,
})

function getDefconColor(defcon: number): string {
  if (defcon >= 5) return 'green'
  if (defcon === 4) return 'teal'
  if (defcon === 3) return 'yellow'
  if (defcon === 2) return 'orange'
  return 'red'
}

export default function CustomersReportingTab() {
  const { rows, totals, meta } = useCustomerPerformanceData()

  const sortedRows = [...rows].sort((a, b) => b.spend - a.spend)
  const totalPercent = totals.monthlyTarget > 0 ? totals.monthlyActual / totals.monthlyTarget : 0

  return (
    <Stack spacing={8}>
      <Box borderRadius="3xl" p={{ base: 6, md: 8 }} bg="gray.900" color="white" boxShadow="2xl">
        <Stack spacing={4}>
          <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap={4}>
            <Box>
              <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.35em" color="whiteAlpha.700">
                Reporting Layer
              </Text>
              <Heading size="lg" mt={2}>
                Client Lead Generation Dashboard
              </Heading>
              <HStack spacing={3} mt={3} flexWrap="wrap">
                <Badge colorScheme="purple" px={3} py={1}>
                  Current Month: {meta.currentMonthLabel}
                </Badge>
                <Badge colorScheme="cyan" px={3} py={1}>
                  {meta.currentWeekLabel}
                </Badge>
              </HStack>
            </Box>
            <Box textAlign={{ base: 'left', md: 'right' }}>
              <Text fontSize="xs" color="whiteAlpha.700" textTransform="uppercase" letterSpacing="0.2em">
                Data Sync
              </Text>
              <Heading size="md">
                {meta.lastSyncedAt
                  ? meta.lastSyncedAt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Awaiting first sync'}
              </Heading>
              <Text fontSize="sm" color="whiteAlpha.600">
                Source • Marketing Leads Tab
              </Text>
            </Box>
          </HStack>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={5}>
            <Box bg="whiteAlpha.100" borderRadius="2xl" p={5} border="1px solid" borderColor="whiteAlpha.300">
              <Text fontSize="xs" textTransform="uppercase" color="whiteAlpha.700" letterSpacing="0.2em">
                Total Leads This Week
              </Text>
              <Heading size="xl" mt={2}>
                {numberFormatter.format(totals.weeklyActual)}
              </Heading>
              <Text fontSize="sm" color="whiteAlpha.700">
                Target {numberFormatter.format(totals.weeklyTarget)}
              </Text>
            </Box>
            <Box bg="whiteAlpha.100" borderRadius="2xl" p={5} border="1px solid" borderColor="whiteAlpha.300">
              <Text fontSize="xs" textTransform="uppercase" color="whiteAlpha.700" letterSpacing="0.2em">
                Month-to-Date Leads
              </Text>
              <Heading size="xl" mt={2}>
                {numberFormatter.format(totals.monthlyActual)}
              </Heading>
              <Text fontSize="sm" color="whiteAlpha.700">
                Target {numberFormatter.format(totals.monthlyTarget)}
              </Text>
            </Box>
            <Box bg="whiteAlpha.100" borderRadius="2xl" p={5} border="1px solid" borderColor="whiteAlpha.300">
              <Text fontSize="xs" textTransform="uppercase" color="whiteAlpha.700" letterSpacing="0.2em">
                % of Target
              </Text>
              <Heading size="xl" mt={2}>
                {percentFormatter.format(totalPercent)}
              </Heading>
              <Text fontSize="sm" color="whiteAlpha.700">
                {rows.length} accounts tracked
              </Text>
            </Box>
          </SimpleGrid>
        </Stack>
      </Box>

      <Box borderRadius="2xl" border="1px solid" borderColor="gray.100" bg="white" boxShadow="xl" overflowX="auto">
        <Table variant="simple" size="sm">
          <Thead bg="gray.50">
            <Tr>
              <Th>Client</Th>
              <Th isNumeric>Spend (£)</Th>
              <Th isNumeric>Current Week Actual</Th>
              <Th isNumeric>Current Week Target</Th>
              <Th isNumeric>Month Actual</Th>
              <Th isNumeric>Month Target</Th>
              <Th isNumeric>% of Target</Th>
              <Th isNumeric>DEFCON</Th>
            </Tr>
          </Thead>
          <Tbody>
            {sortedRows.map((row) => (
              <Tr key={row.account.name} _hover={{ bg: 'gray.50' }}>
                <Td>
                  <Text fontWeight="semibold">{row.account.name}</Text>
                  <Text fontSize="xs" color="gray.500">
                    Leads this week {numberFormatter.format(row.weeklyActual)}
                  </Text>
                </Td>
                <Td isNumeric>{currencyFormatter.format(row.spend)}</Td>
                <Td isNumeric>{numberFormatter.format(row.weeklyActual)}</Td>
                <Td isNumeric>{numberFormatter.format(row.weeklyTarget)}</Td>
                <Td isNumeric>{numberFormatter.format(row.monthlyActual)}</Td>
                <Td isNumeric>{numberFormatter.format(row.monthlyTarget)}</Td>
                <Td isNumeric color={row.percentToTarget >= 1 ? 'teal.600' : 'gray.800'}>
                  {percentFormatter.format(row.percentToTarget)}
                </Td>
                <Td isNumeric>
                  <Badge colorScheme={getDefconColor(row.account.defcon)}>{row.account.defcon}</Badge>
                </Td>
              </Tr>
            ))}
            <Tr bg="gray.900" color="white" fontWeight="bold">
              <Td>Total</Td>
              <Td isNumeric>{currencyFormatter.format(totals.spend)}</Td>
              <Td isNumeric>{numberFormatter.format(totals.weeklyActual)}</Td>
              <Td isNumeric>{numberFormatter.format(totals.weeklyTarget)}</Td>
              <Td isNumeric>{numberFormatter.format(totals.monthlyActual)}</Td>
              <Td isNumeric>{numberFormatter.format(totals.monthlyTarget)}</Td>
              <Td isNumeric>{percentFormatter.format(totalPercent)}</Td>
              <Td isNumeric>-</Td>
            </Tr>
          </Tbody>
        </Table>
      </Box>
    </Stack>
  )
}


