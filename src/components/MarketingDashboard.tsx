/**
 * Marketing Dashboard
 * Ported from OpensDoorsV2 dashboard/page.tsx
 * Shows overview metrics for marketing/outreach activities
 */

import { useEffect, useState } from 'react'
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Card,
  CardBody,
  VStack,
  HStack,
  Badge,
  Spinner,
  useToast,
} from '@chakra-ui/react'
import { getCurrentCustomerId } from '../platform/stores/settings'
import { api } from '../utils/api'

type DashboardMetrics = {
  totalCustomers: number
  totalContacts: number
  totalLists: number
  totalSequences: number
  totalCampaigns: number
  activeCampaigns: number
  emailsSentToday: number
  emailsSentThisWeek: number
  emailsSentThisMonth: number
}

export default function MarketingDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const fetchMetrics = async () => {
    setLoading(true)

    // Fetch data from multiple endpoints
    const customerId = getCurrentCustomerId('prod-customer-1')
    const [customersRes, contactsRes, listsRes, sequencesRes, campaignsRes] = await Promise.all([
      api.get<any[]>('/api/customers'),
      api.get<any[]>('/api/contacts'),
      api.get<any[]>(`/api/lists?customerId=${customerId}`),
      api.get<any[]>(`/api/sequences?customerId=${customerId}`),
      api.get<any[]>('/api/campaigns'),
    ])

    const metrics: DashboardMetrics = {
      totalCustomers: customersRes.data?.length || 0,
      totalContacts: contactsRes.data?.length || 0,
      totalLists: listsRes.data?.length || 0,
      totalSequences: sequencesRes.data?.length || 0,
      totalCampaigns: campaignsRes.data?.length || 0,
      activeCampaigns: campaignsRes.data?.filter((c) => c.status === 'running').length || 0,
      emailsSentToday: 0, // Would need events API
      emailsSentThisWeek: 0,
      emailsSentThisMonth: 0,
    }

    setMetrics(metrics)
    setLoading(false)
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
      </Box>
    )
  }

  return (
    <Box>
      <VStack align="stretch" spacing={6}>
        <Box>
          <Heading size="lg">Marketing Dashboard</Heading>
          <Text fontSize="sm" color="gray.600" mt={1}>
            Overview of your outreach activities and performance
          </Text>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Customers</StatLabel>
                <StatNumber>{metrics?.totalCustomers || 0}</StatNumber>
                <StatHelpText>Client accounts</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Contacts</StatLabel>
                <StatNumber>{metrics?.totalContacts || 0}</StatNumber>
                <StatHelpText>Imported from Cognism</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Lists</StatLabel>
                <StatNumber>{metrics?.totalLists || 0}</StatNumber>
                <StatHelpText>Contact segments</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Sequences</StatLabel>
                <StatNumber>{metrics?.totalSequences || 0}</StatNumber>
                <StatHelpText>Email workflows</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          <Card bg="teal.50" borderColor="teal.200">
            <CardBody>
              <Stat>
                <StatLabel color="teal.700">Campaigns</StatLabel>
                <StatNumber color="teal.900">{metrics?.totalCampaigns || 0}</StatNumber>
                <StatHelpText color="teal.600">
                  <Badge colorScheme="green" mr={2}>
                    {metrics?.activeCampaigns || 0} active
                  </Badge>
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg="blue.50" borderColor="blue.200">
            <CardBody>
              <Stat>
                <StatLabel color="blue.700">Emails Today</StatLabel>
                <StatNumber color="blue.900">{metrics?.emailsSentToday || 0}</StatNumber>
                <StatHelpText color="blue.600">Sent successfully</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg="purple.50" borderColor="purple.200">
            <CardBody>
              <Stat>
                <StatLabel color="purple.700">Emails This Month</StatLabel>
                <StatNumber color="purple.900">{metrics?.emailsSentThisMonth || 0}</StatNumber>
                <StatHelpText color="purple.600">Total sent</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        <Card>
          <CardBody>
            <Heading size="md" mb={4}>
              Quick Actions
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <Box p={4} border="1px solid" borderColor="gray.200" borderRadius="md">
                <Text fontWeight="bold" mb={2}>
                  Import Contacts
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Upload CSV file to add contacts to your database
                </Text>
              </Box>
              <Box p={4} border="1px solid" borderColor="gray.200" borderRadius="md">
                <Text fontWeight="bold" mb={2}>
                  Create Campaign
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Launch a new sequence to a target list
                </Text>
              </Box>
              <Box p={4} border="1px solid" borderColor="gray.200" borderRadius="md">
                <Text fontWeight="bold" mb={2}>
                  Build Sequence
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Create multi-step email workflows
                </Text>
              </Box>
              <Box p={4} border="1px solid" borderColor="gray.200" borderRadius="md">
                <Text fontWeight="bold" mb={2}>
                  Manage Lists
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Organize contacts into targetable segments
                </Text>
              </Box>
            </SimpleGrid>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  )
}
