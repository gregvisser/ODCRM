import { useCallback, useEffect, useState } from 'react'
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
  Divider,
  Alert,
  AlertIcon,
  Code,
  Flex,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  useDisclosure
} from '@chakra-ui/react'
import { ArrowBackIcon } from '@chakra-ui/icons'
import { MdEmail, MdSchedule } from 'react-icons/md'
import { api } from '../utils/api'
import CampaignWizard from './CampaignWizard'

type CampaignTemplate = {
  id: string
  stepNumber: number
  subjectTemplate: string
  bodyTemplateHtml: string
  bodyTemplateText?: string | null
}

interface CampaignDetail {
  id: string
  name: string
  description?: string
  status: string
  sendWindowHoursStart?: number
  sendWindowHoursEnd?: number
  randomizeWithinHours?: number
  followUpDelayDaysMin?: number
  followUpDelayDaysMax?: number
  senderIdentity: {
    emailAddress: string
    displayName?: string
  }
  templates?: CampaignTemplate[]
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
  const { isOpen: isWizardOpen, onOpen: onWizardOpen, onClose: onWizardClose } = useDisclosure()

  const fetchCampaign = useCallback(async () => {
    const { data, error } = await api.get<CampaignDetail>(`/api/campaigns/${campaignId}`)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else if (data) {
      setCampaign(data)
    }
    setLoading(false)
  }, [campaignId, toast])

  useEffect(() => {
    fetchCampaign()
    // Refresh every 30 seconds to get latest stats
    const interval = setInterval(fetchCampaign, 30000)
    return () => clearInterval(interval)
  }, [fetchCampaign])

  const handleWizardClose = () => {
    onWizardClose()
    // Refresh after editing steps/settings.
    fetchCampaign()
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
      case 'running': return 'green'
      case 'paused': return 'yellow'
      case 'completed': return 'blue'
      case 'draft': return 'gray'
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

              <Divider />

              <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                <Stat>
                  <StatLabel>Send window</StatLabel>
                  <StatNumber fontSize="md">
                    {(campaign.sendWindowHoursStart ?? 9).toString().padStart(2, '0')}:00–{(campaign.sendWindowHoursEnd ?? 17)
                      .toString()
                      .padStart(2, '0')}:00
                  </StatNumber>
                  <StatHelpText>Local server time</StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Randomize within</StatLabel>
                  <StatNumber fontSize="md">{campaign.randomizeWithinHours ?? 24}h</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Follow-up delay</StatLabel>
                  <StatNumber fontSize="md">
                    {campaign.followUpDelayDaysMin ?? 3}–{campaign.followUpDelayDaysMax ?? 5} days
                  </StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Sequence steps</StatLabel>
                  <StatNumber fontSize="md">{(campaign.templates || []).length || 0}</StatNumber>
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
                          <Text color="text.muted">Opened: {new Date(prospect.lastOpenedAt).toLocaleDateString()}</Text>
                        )}
                        {prospect.replyDetectedAt && (
                          <Text color="text.muted">Replied: {new Date(prospect.replyDetectedAt).toLocaleDateString()}</Text>
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
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between">
                <Box>
                  <Heading size="sm">Sequence steps</Heading>
                  <Text fontSize="sm" color="gray.600">
                    Reply.io-style step list (email + delays), backed by ODCRM’s current 2-step engine.
                  </Text>
                </Box>
                <HStack>
                  <Button size="sm" colorScheme="gray" onClick={onWizardOpen}>
                    Edit sequence
                  </Button>
                </HStack>
              </HStack>

              <Alert status="info">
                <AlertIcon />
                <Text fontSize="sm">
                  Variables supported: <Code>{'{{firstName}}'}</Code>, <Code>{'{{lastName}}'}</Code>,{' '}
                  <Code>{'{{fullName}}'}</Code>, <Code>{'{{companyName}}'}</Code>, <Code>{'{{email}}'}</Code>.{' '}
                  Aliases: <Code>{'{{contactName}}'}</Code> → full name, <Code>{'{{accountName}}'}</Code> → company.
                </Text>
              </Alert>

              {(!campaign.templates || campaign.templates.length === 0) && (
                <Alert status="warning">
                  <AlertIcon />
                  <Text fontSize="sm">No templates saved yet. Use “Edit templates” to add Step 1 and Step 2.</Text>
                </Alert>
              )}

              {/* Step list, modeled after Reply.io’s “steps list” UX */}
              <VStack align="stretch" spacing={3}>
                {(() => {
                  const templates = (campaign.templates || []).slice().sort((a, b) => a.stepNumber - b.stepNumber)

                  const StepCard = ({
                    stepNumber,
                    subject,
                    bodyHtml,
                  }: {
                    stepNumber: number
                    subject: string
                    bodyHtml: string
                  }) => (
                    <Box borderWidth="1px" borderRadius="md" p={4}>
                      <HStack justify="space-between" mb={2}>
                        <HStack>
                          <Flex
                            width="28px"
                            height="28px"
                            align="center"
                            justify="center"
                            borderRadius="md"
                            bg="gray.100"
                          >
                            <Box as={MdEmail} color="gray.700" />
                          </Flex>
                          <Box>
                            <Heading size="xs">Step {stepNumber}: Email</Heading>
                            <Text fontSize="xs" color="gray.600">
                              Subject preview: {subject || '(no subject)'}
                            </Text>
                          </Box>
                        </HStack>
                        <Button size="xs" variant="outline" colorScheme="gray" onClick={onWizardOpen}>
                          Edit
                        </Button>
                      </HStack>

                      <Box>
                        <Text fontSize="sm" color="gray.600" mb={1}>
                          <strong>Body (HTML)</strong>
                        </Text>
                        <Box
                          as="pre"
                          whiteSpace="pre-wrap"
                          fontFamily="mono"
                          fontSize="sm"
                          bg="gray.50"
                          borderRadius="md"
                          p={3}
                          maxH="220px"
                          overflow="auto"
                        >
                          {bodyHtml || '(empty)'}
                        </Box>
                      </Box>
                    </Box>
                  )

                  const WaitCard = ({ label }: { label: string }) => (
                    <Box borderWidth="1px" borderRadius="md" p={4} bg="gray.50">
                      <HStack justify="space-between">
                        <HStack>
                          <Flex
                            width="28px"
                            height="28px"
                            align="center"
                            justify="center"
                            borderRadius="md"
                            bg="white"
                            borderWidth="1px"
                          >
                            <Box as={MdSchedule} color="gray.700" />
                          </Flex>
                          <Box>
                            <Heading size="xs">Wait</Heading>
                            <Text fontSize="xs" color="gray.600">
                              {label}
                            </Text>
                          </Box>
                        </HStack>
                        <Text fontSize="xs" color="gray.600">
                          Uses campaign follow-up delay settings
                        </Text>
                      </HStack>
                    </Box>
                  )

                  return (
                    <>
                      {templates.map((t, idx) => {
                        const afterDelayMin = (t as any).delayDaysMin
                        const afterDelayMax = (t as any).delayDaysMax
                        const min = Number.isFinite(afterDelayMin) ? afterDelayMin : (campaign.followUpDelayDaysMin ?? 3)
                        const max = Number.isFinite(afterDelayMax) ? afterDelayMax : (campaign.followUpDelayDaysMax ?? 5)

                        return (
                          <Box key={t.id}>
                            <StepCard stepNumber={t.stepNumber} subject={t.subjectTemplate} bodyHtml={t.bodyTemplateHtml} />
                            {idx < templates.length - 1 && (
                              <Box mt={3}>
                                <WaitCard label={`${min}–${max} days (randomized)`} />
                              </Box>
                            )}
                          </Box>
                        )
                      })}
                    </>
                  )
                })()}
              </VStack>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <Modal isOpen={isWizardOpen} onClose={handleWizardClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Email Campaign</ModalHeader>
          <ModalCloseButton />
          <Box p={4}>
            <CampaignWizard
              campaignId={campaignId}
              onCancel={handleWizardClose}
              onSuccess={() => {
                toast({ title: 'Saved', description: 'Campaign updated', status: 'success' })
                handleWizardClose()
              }}
            />
          </Box>
        </ModalContent>
      </Modal>
    </Box>
  )
}
