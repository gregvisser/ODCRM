import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Heading,
  VStack,
  HStack,
  Text,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useToast,
  Spinner,
  Divider
} from '@chakra-ui/react'
import { ArrowBackIcon } from '@chakra-ui/icons'
import { api } from '../utils/api'

interface CampaignDetail {
  id: string
  name: string
  description?: string
  status: string
  senderIdentity: {
    emailAddress: string
    displayName?: string
  }
  prospects: Array<{
    id: string
    contact: {
      firstName: string
      lastName: string
      companyName: string
      email: string
    }
    lastStatus: string
    step1SentAt?: string
    step2SentAt?: string
    openCount: number
    lastOpenedAt?: string
    replyDetectedAt?: string
    lastReplySnippet?: string
    unsubscribedAt?: string
    bouncedAt?: string
  }>
}

export default function CampaignDetail({
  campaignId,
  onBack
}: {
  campaignId: string
  onBack: () => void
}) {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    fetchCampaign()
    // Refresh every 30 seconds to get latest stats
    const interval = setInterval(fetchCampaign, 30000)
    return () => clearInterval(interval)
  }, [campaignId])

  const fetchCampaign = async () => {
    const { data, error } = await api.get<CampaignDetail>(`/api/campaigns/${campaignId}`)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else if (data) {
      setCampaign(data)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
      </Box>
    )
  }

  if (!campaign) {
    return (
      <Box>
        <Button leftIcon={<ArrowBackIcon />} onClick={onBack} mb={4}>
          Back
        </Button>
        <Text>Campaign not found</Text>
      </Box>
    )
  }

  const totalProspects = campaign.prospects.length
  const step1Sent = campaign.prospects.filter(p => p.step1SentAt).length
  const step2Sent = campaign.prospects.filter(p => p.step2SentAt).length
  const totalSent = step1Sent + step2Sent
  const opened = campaign.prospects.filter(p => p.openCount > 0).length
  const bounced = campaign.prospects.filter(p => p.bouncedAt).length
  const unsubscribed = campaign.prospects.filter(p => p.unsubscribedAt).length
  const replied = campaign.prospects.filter(p => p.replyDetectedAt).length

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'replied': return 'green'
      case 'step1_sent': return 'blue'
      case 'step2_sent': return 'purple'
      case 'bounced': return 'red'
      case 'unsubscribed': return 'orange'
      case 'pending': return 'gray'
      default: return 'gray'
    }
  }

  return (
    <Box>
      <HStack mb={6}>
        <Button leftIcon={<ArrowBackIcon />} onClick={onBack}>
          Back
        </Button>
        <Heading size="lg">{campaign.name}</Heading>
        <Badge colorScheme={getStatusColor(campaign.status)}>
          {campaign.status}
        </Badge>
      </HStack>

      <Tabs>
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Prospects</Tab>
          <Tab>Templates</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <VStack spacing={6} align="stretch">
              <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                <Stat>
                  <StatLabel>Total Prospects</StatLabel>
                  <StatNumber>{totalProspects}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Emails Sent</StatLabel>
                  <StatNumber>{totalSent}</StatNumber>
                  <StatHelpText>Step 1: {step1Sent}, Step 2: {step2Sent}</StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Replied</StatLabel>
                  <StatNumber>{replied}</StatNumber>
                  <StatHelpText>{(totalSent > 0 ? (replied / totalSent) * 100 : 0).toFixed(1)}% reply rate</StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Opened</StatLabel>
                  <StatNumber>{opened}</StatNumber>
                  <StatHelpText>{(totalSent > 0 ? (opened / totalSent) * 100 : 0).toFixed(1)}% open rate</StatHelpText>
                </Stat>
              </SimpleGrid>

              <Divider />

              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                <Stat>
                  <StatLabel>Bounced</StatLabel>
                  <StatNumber>{bounced}</StatNumber>
                  <StatHelpText>{(totalSent > 0 ? (bounced / totalSent) * 100 : 0).toFixed(1)}% bounce rate</StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Unsubscribed</StatLabel>
                  <StatNumber>{unsubscribed}</StatNumber>
                  <StatHelpText>{(totalSent > 0 ? (unsubscribed / totalSent) * 100 : 0).toFixed(1)}% unsubscribe rate</StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Sender</StatLabel>
                  <StatNumber fontSize="md">{campaign.senderIdentity.emailAddress}</StatNumber>
                </Stat>
              </SimpleGrid>

              {campaign.description && (
                <Box p={4} bg="gray.50" borderRadius="md">
                  <Text><strong>Description:</strong> {campaign.description}</Text>
                </Box>
              )}
            </VStack>
          </TabPanel>

          <TabPanel>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Contact</Th>
                  <Th>Company</Th>
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th>Activity</Th>
                  <Th>Reply</Th>
                </Tr>
              </Thead>
              <Tbody>
                {campaign.prospects.map((prospect) => (
                  <Tr key={prospect.id}>
                    <Td>
                      {prospect.contact.firstName} {prospect.contact.lastName}
                    </Td>
                    <Td>{prospect.contact.companyName}</Td>
                    <Td>{prospect.contact.email}</Td>
                    <Td>
                      <Badge colorScheme={getStatusColor(prospect.lastStatus)}>
                        {prospect.lastStatus}
                      </Badge>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={0} fontSize="sm">
                        {prospect.step1SentAt && (
                          <Text>Step 1: {new Date(prospect.step1SentAt).toLocaleDateString()}</Text>
                        )}
                        {prospect.step2SentAt && (
                          <Text>Step 2: {new Date(prospect.step2SentAt).toLocaleDateString()}</Text>
                        )}
                        {prospect.lastOpenedAt && (
                          <Text color="blue.500">Opened: {new Date(prospect.lastOpenedAt).toLocaleDateString()}</Text>
                        )}
                        {prospect.replyDetectedAt && (
                          <Text color="green.500">Replied: {new Date(prospect.replyDetectedAt).toLocaleDateString()}</Text>
                        )}
                      </VStack>
                    </Td>
                    <Td>
                      {prospect.lastReplySnippet && (
                        <Box maxW="300px">
                          <Text fontSize="sm" noOfLines={3}>
                            {prospect.lastReplySnippet}
                          </Text>
                        </Box>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TabPanel>

          <TabPanel>
            <Text>Templates view coming soon</Text>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}
