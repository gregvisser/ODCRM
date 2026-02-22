import React, { useEffect, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  HStack,
  Select,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
  Spinner,
  Progress,
  FormControl,
  FormLabel,
  Badge,
} from '@chakra-ui/react'
import {
  EmailIcon,
  CheckCircleIcon,
  WarningIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

// Customer and report response types
type CustomerOption = {
  id: string
  name: string
  totalEvents: number
}

type CustomerReportResponse = {
  customerId: string
  dateRange: string
  startDate: string
  endDate: string
  timezone: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  optedOut: number
  spamComplaints: number
  failed: number
  notReached: number
  sequencesCompleted: number
  deliveryRate: number
  openRate: number
  clickRate: number
  replyRate: number
  bounceRate: number
  optOutRate: number
  notReachedRate: number
  uniqueSenders: number
  senders: Array<{
    identityId: string | null
    email: string | null
    name: string | null
  }>
  generatedAt: string
}

type DateRange = 'today' | 'week' | 'month'

const ReportsTab: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [dateRange, setDateRange] = useState<DateRange>('today')
  const [report, setReport] = useState<CustomerReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load customers on mount
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const response = await api.get('/api/reports/customers')
        setCustomers(response.data.customers || [])

        // Auto-select first customer if available
        if (response.data.customers?.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(response.data.customers[0].id)
        }
      } catch (err) {
        console.error('Failed to load customers:', err)
        setError('Failed to load customer list')
      }
    }

    loadCustomers()
  }, [])

  // Load report when customer or date range changes
  useEffect(() => {
    if (selectedCustomerId) {
      loadReport()
    }
  }, [selectedCustomerId, dateRange])

  const loadReport = async () => {
    if (!selectedCustomerId) return

    setLoading(true)
    setError(null)

    try {
      const response = await api.get(`/api/reports/customer?customerId=${selectedCustomerId}&dateRange=${dateRange}`)
      setReport(response.data)
    } catch (err) {
      console.error('Failed to load report:', err)
      setError('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

  if (loading && customers.length === 0) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="lg" />
        <Text mt={4}>Loading customer reports...</Text>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Customer Email Reports</Heading>
          <Text color="gray.600">
            Detailed analytics for individual OpenDoors customers
          </Text>
        </VStack>
      </Flex>

      {/* Customer and Date Range Selection */}
      <Card mb={6}>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <FormControl>
              <FormLabel>Select Customer</FormLabel>
              <Select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                placeholder="Choose a customer"
              >
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.totalEvents} events)
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>Date Range</FormLabel>
              <Select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </Select>
            </FormControl>
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>Failed to load reports</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
          <Button size="sm" onClick={() => loadReport()} ml={4}>
            Retry
          </Button>
        </Alert>
      )}

      {/* Customer Info */}
      {selectedCustomer && report && (
        <Card mb={6}>
          <CardBody>
            <HStack justify="space-between">
              <Box>
                <Heading size="md">{selectedCustomer.name}</Heading>
                <Text color="gray.600" fontSize="sm">
                  Report for {report.dateRange} • {report.timezone} timezone
                </Text>
                <Text color="gray.500" fontSize="xs">
                  {new Date(report.startDate).toLocaleDateString()} - {new Date(report.endDate).toLocaleDateString()}
                </Text>
              </Box>
              <VStack align="end" spacing={1}>
                <Badge colorScheme="blue" fontSize="xs">
                  {report.uniqueSenders} active sender{report.uniqueSenders !== 1 ? 's' : ''}
                </Badge>
                <Text fontSize="xs" color="gray.500">
                  Generated {new Date(report.generatedAt).toLocaleTimeString()}
                </Text>
              </VStack>
            </HStack>
          </CardBody>
        </Card>
      )}

      {/* Loading State */}
      {loading && selectedCustomerId && (
        <Card mb={6}>
          <CardBody textAlign="center" py={8}>
            <Spinner size="lg" mb={4} />
            <Text>Loading report data for {selectedCustomer?.name}...</Text>
          </CardBody>
        </Card>
      )}

      {/* Key Metrics */}
      {report && !loading && (
        <>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4} mb={6}>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel fontSize="sm" color="gray.600">Total Sequences Completed</StatLabel>
                  <StatNumber fontSize="3xl" color="blue.600">
                    {report.sequencesCompleted.toLocaleString()}
                  </StatNumber>
                </Stat>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Stat>
                  <StatLabel fontSize="sm" color="gray.600">Emails Sent</StatLabel>
                  <StatNumber fontSize="3xl" color="purple.600">
                    {report.sent.toLocaleString()}
                  </StatNumber>
                </Stat>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Stat>
                  <StatLabel fontSize="sm" color="gray.600">Delivery Rate</StatLabel>
                  <StatNumber fontSize="3xl" color="green.600">
                    {report.deliveryRate}%
                  </StatNumber>
                  <Text fontSize="sm" color="gray.500">
                    {report.delivered}/{report.sent} delivered
                  </Text>
                </Stat>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Stat>
                  <StatLabel fontSize="sm" color="gray.600">Reply Rate</StatLabel>
                  <StatNumber fontSize="3xl" color="orange.600">
                    {report.replyRate}%
                  </StatNumber>
                  <Text fontSize="sm" color="gray.500">
                    {report.replied} replies
                  </Text>
                </Stat>
              </CardBody>
            </Card>
          </SimpleGrid>

          {/* Detailed Metrics */}
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
            <Card>
              <CardHeader>
                <Heading size="md">Email Performance</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Flex justify="space-between" mb={2}>
                      <Text fontSize="sm" fontWeight="medium">Open Rate</Text>
                      <Text fontSize="sm" color="gray.600">{report.openRate}%</Text>
                    </Flex>
                    <Progress value={report.openRate} colorScheme="blue" size="lg" borderRadius="md" />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      {report.opened} opened of {report.delivered} delivered
                    </Text>
                  </Box>

                  <Box>
                    <Flex justify="space-between" mb={2}>
                      <Text fontSize="sm" fontWeight="medium">Click Rate</Text>
                      <Text fontSize="sm" color="gray.600">{report.clickRate}%</Text>
                    </Flex>
                    <Progress value={report.clickRate} colorScheme="green" size="lg" borderRadius="md" />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      {report.clicked} clicks of {report.delivered} delivered
                    </Text>
                  </Box>

                  <Box>
                    <Flex justify="space-between" mb={2}>
                      <Text fontSize="sm" fontWeight="medium">Bounce Rate</Text>
                      <Text fontSize="sm" color="gray.600">{report.bounceRate}%</Text>
                    </Flex>
                    <Progress value={report.bounceRate} colorScheme="red" size="lg" borderRadius="md" />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      {report.bounced} bounces of {report.sent} sent
                    </Text>
                  </Box>
                </VStack>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <Heading size="md">Issues & Compliance</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Flex justify="space-between" mb={2}>
                      <Text fontSize="sm" fontWeight="medium">Opt-out Rate</Text>
                      <Text fontSize="sm" color="gray.600">{report.optOutRate}%</Text>
                    </Flex>
                    <Progress value={report.optOutRate} colorScheme="orange" size="lg" borderRadius="md" />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      {report.optedOut} unsubscribes
                    </Text>
                  </Box>

                  <Box>
                    <Flex justify="space-between" mb={2}>
                      <Text fontSize="sm" fontWeight="medium">Spam Complaints</Text>
                      <Text fontSize="sm" color="gray.600">{report.spamComplaints}</Text>
                    </Flex>
                    <Text fontSize="xs" color="gray.500">
                      Reported as spam
                    </Text>
                  </Box>

                  <Box>
                    <Flex justify="space-between" mb={2}>
                      <Text fontSize="sm" fontWeight="medium">Not Reached Rate</Text>
                      <Text fontSize="sm" color="gray.600">{report.notReachedRate}%</Text>
                    </Flex>
                    <Progress value={report.notReachedRate} colorScheme="gray" size="lg" borderRadius="md" />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      {report.failed + report.notReached} failures of {report.sent} sent
                    </Text>
                  </Box>
                </VStack>
              </CardBody>
            </Card>
          </SimpleGrid>

          {/* Raw Event Counts */}
          <Card>
            <CardHeader>
              <Heading size="md">Raw Event Counts</Heading>
              <Text fontSize="sm" color="gray.600">
                Detailed breakdown of all email events for this period
              </Text>
            </CardHeader>
            <CardBody>
              <SimpleGrid columns={{ base: 2, md: 4, lg: 6 }} spacing={4}>
                <Box textAlign="center">
                  <Text fontSize="2xl" fontWeight="bold" color="blue.600">{report.sent}</Text>
                  <Text fontSize="sm" color="gray.600">Sent</Text>
                </Box>
                <Box textAlign="center">
                  <Text fontSize="2xl" fontWeight="bold" color="green.600">{report.delivered}</Text>
                  <Text fontSize="sm" color="gray.600">Delivered</Text>
                </Box>
                <Box textAlign="center">
                  <Text fontSize="2xl" fontWeight="bold" color="cyan.600">{report.opened}</Text>
                  <Text fontSize="sm" color="gray.600">Opened</Text>
                </Box>
                <Box textAlign="center">
                  <Text fontSize="2xl" fontWeight="bold" color="purple.600">{report.clicked}</Text>
                  <Text fontSize="sm" color="gray.600">Clicked</Text>
                </Box>
                <Box textAlign="center">
                  <Text fontSize="2xl" fontWeight="bold" color="orange.600">{report.replied}</Text>
                  <Text fontSize="sm" color="gray.600">Replied</Text>
                </Box>
                <Box textAlign="center">
                  <Text fontSize="2xl" fontWeight="bold" color="red.600">{report.bounced}</Text>
                  <Text fontSize="sm" color="gray.600">Bounced</Text>
                </Box>
              </SimpleGrid>
            </CardBody>
          </Card>
        </>
      )}

      {/* No customer selected */}
      {!selectedCustomerId && customers.length > 0 && (
        <Card>
          <CardBody textAlign="center" py={12}>
            <Text fontSize="lg" color="gray.600">
              Select a customer from the dropdown above to view their email reports
            </Text>
          </CardBody>
        </Card>
      )}
    </Box>
  )
}

export default ReportsTab