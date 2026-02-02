import React, { useState, useEffect } from 'react'
import {
  Box,
  Grid,
  GridItem,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  SimpleGrid,
  VStack,
  HStack,
  Icon,
  Progress,
  Badge,
  Button,
  Flex,
  Spacer,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react'
import {
  EmailIcon,
  RepeatIcon,
  AtSignIcon,
  CheckCircleIcon,
  WarningIcon,
  TimeIcon,
  ArrowUpIcon,
  AddIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

// Helper function to format relative time
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) {
    return diffMins <= 1 ? '1 min ago' : `${diffMins} min ago`
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  } else {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
  }
}

// Helper function to parse time ago for sorting
function parseTimeAgo(timeStr: string): number {
  const now = new Date().getTime()
  const match = timeStr.match(/(\d+)\s+(min|hour|day)/)
  if (!match) return now

  const value = parseInt(match[1])
  const unit = match[2]

  let multiplier = 1000 * 60 // minutes
  if (unit === 'hour') multiplier *= 60
  if (unit === 'day') multiplier *= 60 * 24

  return now - (value * multiplier)
}

interface DashboardStats {
  totalContacts: number
  activeSequences: number
  emailsSentToday: number
  replyRate: number
  openRate: number
  sequencesRunning: number
  pendingTasks: number
  deliverability: number
}

interface RecentActivity {
  type: 'sequence_started' | 'email_sent' | 'reply_received' | 'sequence_completed' | 'campaign_sent'
  message: string
  time: string
}

const OverviewDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    activeSequences: 0,
    emailsSentToday: 0,
    replyRate: 0,
    openRate: 0,
    sequencesRunning: 0,
    pendingTasks: 0,
    deliverability: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])

  useEffect(() => {
    const fetchDashboardStats = async (showLoading = true) => {
      if (showLoading) {
        setLoading(true)
      }
      try {
        setLoading(true)
        setError(null)

        // Fetch data from multiple API endpoints
        const [sequencesRes, campaignsRes, contactsRes, reportsRes, inboxRes] = await Promise.allSettled([
          api.get('/api/sequences'),
          api.get('/api/campaigns'),
          api.get('/api/contacts'),
          api.get('/api/reports/emails'),
          api.get('/api/inbox?limit=10'),
        ])

        // Process sequences data
        let totalContacts = 0
        let activeSequences = 0
        let sequencesRunning = 0

        if (sequencesRes.status === 'fulfilled') {
          const sequences = sequencesRes.value?.data || []
          activeSequences = sequences.length
          sequencesRunning = sequences.filter((s: any) => s.status === 'active').length
        }

        // Process contacts data
        if (contactsRes.status === 'fulfilled') {
          const contacts = contactsRes.value?.data || []
          totalContacts = contacts.length
        }

        // Process email reports for today's stats
        let emailsSentToday = 0
        let replyRate = 0
        let openRate = 0
        let deliverability = 98.2 // Default deliverability

        if (reportsRes.status === 'fulfilled') {
          const reportData = reportsRes.value?.data || {}
          const totals = reportData.totals || {}

          // Calculate today's sent emails
          emailsSentToday = totals.sent || 0

          // Calculate rates
          const totalSent = totals.sent || 1 // Avoid division by zero
          const replies = totals.replied || 0
          const opens = totals.opened || 0

          replyRate = (replies / totalSent) * 100
          openRate = (opens / totalSent) * 100

          // Calculate deliverability (sent vs bounced)
          const bounced = totals.bounced || 0
          if (totalSent > 0) {
            deliverability = ((totalSent - bounced) / totalSent) * 100
          }
        }

        // Mock pending tasks for now (could be calculated from campaigns/tasks)
        const pendingTasks = 0

        setStats({
          totalContacts,
          activeSequences,
          emailsSentToday,
          replyRate: Math.round(replyRate * 10) / 10, // Round to 1 decimal
          openRate: Math.round(openRate * 10) / 10,
          sequencesRunning,
          pendingTasks,
          deliverability: Math.round(deliverability * 10) / 10,
        })

        // Process recent activity from inbox and campaigns
        const activity: RecentActivity[] = []

        // Add campaign activity
        if (campaignsRes.status === 'fulfilled') {
          const campaigns = campaignsRes.value?.data || []
          campaigns.slice(0, 3).forEach((campaign: any) => {
            if (campaign.createdAt) {
              const timeAgo = getTimeAgo(new Date(campaign.createdAt))
              activity.push({
                type: 'campaign_sent',
                message: `Campaign "${campaign.name}" was created`,
                time: timeAgo,
              })
            }
          })
        }

        // Add inbox/reply activity
        if (inboxRes.status === 'fulfilled') {
          const inboxItems = inboxRes.value?.data || []
          inboxItems.slice(0, 3).forEach((item: any) => {
            if (item.receivedAt) {
              const timeAgo = getTimeAgo(new Date(item.receivedAt))
              activity.push({
                type: 'reply_received',
                message: `New reply from ${item.from || 'contact'}`,
                time: timeAgo,
              })
            }
          })
        }

        // Add sequence activity
        if (sequencesRes.status === 'fulfilled') {
          const sequences = sequencesRes.value?.data || []
          sequences.slice(0, 2).forEach((sequence: any) => {
            if (sequence.createdAt) {
              const timeAgo = getTimeAgo(new Date(sequence.createdAt))
              activity.push({
                type: 'sequence_started',
                message: `Sequence "${sequence.name}" was created`,
                time: timeAgo,
              })
            }
          })
        }

        // Sort by time and take top 5
        activity.sort((a, b) => {
          const timeA = parseTimeAgo(a.time)
          const timeB = parseTimeAgo(b.time)
          return timeA - timeB
        })

        setRecentActivity(activity.slice(0, 5))

      } catch (err) {
        console.error('Error fetching dashboard stats:', err)
        setError('Failed to load dashboard statistics')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardStats()

    // Set up automatic refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchDashboardStats(false) // Don't show loading spinner for auto-refresh
    }, 30000) // 30 seconds

    // Cleanup interval on unmount
    return () => clearInterval(refreshInterval)
  }, [])

  // Manual refresh function
  const handleManualRefresh = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch data from multiple API endpoints
      const [sequencesRes, campaignsRes, contactsRes, reportsRes, inboxRes] = await Promise.allSettled([
        api.get('/api/sequences'),
        api.get('/api/campaigns'),
        api.get('/api/contacts'),
        api.get('/api/reports/emails'),
        api.get('/api/inbox?limit=10'),
      ])

      // Process sequences data
      let totalContacts = 0
      let activeSequences = 0
      let sequencesRunning = 0

      if (sequencesRes.status === 'fulfilled') {
        const sequences = sequencesRes.value?.data || []
        activeSequences = sequences.length
        sequencesRunning = sequences.filter((s: any) => s.status === 'active').length
      }

      // Process contacts data
      if (contactsRes.status === 'fulfilled') {
        const contacts = contactsRes.value?.data || []
        totalContacts = contacts.length
      }

      // Process email reports for today's stats
      let emailsSentToday = 0
      let replyRate = 0
      let openRate = 0
      let deliverability = 98.2 // Default deliverability

      if (reportsRes.status === 'fulfilled') {
        const reportData = reportsRes.value?.data || {}
        const totals = reportData.totals || {}

        // Calculate today's sent emails
        emailsSentToday = totals.sent || 0

        // Calculate rates
        const totalSent = totals.sent || 1 // Avoid division by zero
        const replies = totals.replied || 0
        const opens = totals.opened || 0

        replyRate = (replies / totalSent) * 100
        openRate = (opens / totalSent) * 100

        // Calculate deliverability (sent vs bounced)
        const bounced = totals.bounced || 0
        if (totalSent > 0) {
          deliverability = ((totalSent - bounced) / totalSent) * 100
        }
      }

      // Mock pending tasks for now (could be calculated from campaigns/tasks)
      const pendingTasks = 0

      setStats({
        totalContacts,
        activeSequences,
        emailsSentToday,
        replyRate: Math.round(replyRate * 10) / 10, // Round to 1 decimal
        openRate: Math.round(openRate * 10) / 10,
        sequencesRunning,
        pendingTasks,
        deliverability: Math.round(deliverability * 10) / 10,
      })

      // Process recent activity from inbox and campaigns
      const activity: RecentActivity[] = []

      // Add campaign activity
      if (campaignsRes.status === 'fulfilled') {
        const campaigns = campaignsRes.value?.data || []
        campaigns.slice(0, 3).forEach((campaign: any) => {
          if (campaign.createdAt) {
            const timeAgo = getTimeAgo(new Date(campaign.createdAt))
            activity.push({
              type: 'campaign_sent',
              message: `Campaign "${campaign.name}" was created`,
              time: timeAgo,
            })
          }
        })
      }

      // Add inbox/reply activity
      if (inboxRes.status === 'fulfilled') {
        const inboxItems = inboxRes.value?.data || []
        inboxItems.slice(0, 3).forEach((item: any) => {
          if (item.receivedAt) {
            const timeAgo = getTimeAgo(new Date(item.receivedAt))
            activity.push({
              type: 'reply_received',
              message: `New reply from ${item.from || 'contact'}`,
              time: timeAgo,
            })
          }
        })
      }

      // Add sequence activity
      if (sequencesRes.status === 'fulfilled') {
        const sequences = sequencesRes.value?.data || []
        sequences.slice(0, 2).forEach((sequence: any) => {
          if (sequence.createdAt) {
            const timeAgo = getTimeAgo(new Date(sequence.createdAt))
            activity.push({
              type: 'sequence_started',
              message: `Sequence "${sequence.name}" was created`,
              time: timeAgo,
            })
          }
        })
      }

      // Sort by time and take top 5
      activity.sort((a, b) => {
        const timeA = parseTimeAgo(a.time)
        const timeB = parseTimeAgo(b.time)
        return timeA - timeB
      })

      setRecentActivity(activity.slice(0, 5))

      // Show success message
      toast({
        title: 'Dashboard refreshed',
        description: 'Latest data loaded successfully',
        status: 'success',
        duration: 2000,
        isClosable: true,
      })
    } catch (err) {
      console.error('Error refreshing dashboard:', err)
      toast({
        title: 'Refresh failed',
        description: 'Could not update dashboard data',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Box p={6} maxW="1200px" mx="auto" textAlign="center">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" thickness="4px" />
          <Text fontSize="lg" color="gray.600">Loading dashboard statistics...</Text>
        </VStack>
      </Box>
    )
  }

  if (error) {
    return (
      <Box p={6} maxW="1200px" mx="auto">
        <Alert status="error" borderRadius="lg">
          <AlertIcon />
          <AlertTitle>Error loading dashboard!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </Box>
    )
  }

  return (
    <Box p={6} maxW="1200px" mx="auto">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="flex-start" flexWrap="wrap" gap={4}>
          <Box flex="1">
            <Heading size="lg" mb={2}>Email Outreach Overview</Heading>
            <Text color="gray.600">
              Monitor your email campaigns, sequences, and contact engagement in real-time
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Auto-refreshes every 30 seconds • Last updated: {new Date().toLocaleTimeString()}
            </Text>
          </Box>
          <Button
            leftIcon={<RepeatIcon />}
            colorScheme="blue"
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            isLoading={loading}
            loadingText="Refreshing..."
            alignSelf="flex-start"
          >
            Refresh Data
          </Button>
        </Flex>

        {/* Key Metrics Grid */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel fontSize="sm" color="gray.600">Total Contacts</StatLabel>
                <StatNumber fontSize="3xl" color="blue.600">
                  {stats.totalContacts.toLocaleString()}
                </StatNumber>
                <StatHelpText>
                  <StatArrow type="increase" />
                  +12% this month
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel fontSize="sm" color="gray.600">Active Sequences</StatLabel>
                <StatNumber fontSize="3xl" color="green.600">
                  {stats.activeSequences}
                </StatNumber>
                <StatHelpText>
                  {stats.sequencesRunning} currently running
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel fontSize="sm" color="gray.600">Emails Sent Today</StatLabel>
                <StatNumber fontSize="3xl" color="purple.600">
                  {stats.emailsSentToday.toLocaleString()}
                </StatNumber>
                <StatHelpText>
                  Within daily limits
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel fontSize="sm" color="gray.600">Overall Reply Rate</StatLabel>
                <StatNumber fontSize="3xl" color="orange.600">
                  {stats.replyRate}%
                </StatNumber>
                <StatHelpText>
                  <StatArrow type="increase" />
                  +0.3% from last week
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Performance Overview */}
        <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
          <GridItem>
            <Card>
              <CardHeader>
                <Heading size="md">Performance Metrics</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Flex justify="space-between" mb={2}>
                      <Text fontSize="sm" fontWeight="medium">Open Rate</Text>
                      <Text fontSize="sm" color="gray.600">{stats.openRate}%</Text>
                    </Flex>
                    <Progress value={stats.openRate} colorScheme="blue" size="lg" borderRadius="md" />
                  </Box>

                  <Box>
                    <Flex justify="space-between" mb={2}>
                      <Text fontSize="sm" fontWeight="medium">Reply Rate</Text>
                      <Text fontSize="sm" color="gray.600">{stats.replyRate}%</Text>
                    </Flex>
                    <Progress value={stats.replyRate * 10} colorScheme="green" size="lg" borderRadius="md" />
                  </Box>

                  <Box>
                    <Flex justify="space-between" mb={2}>
                      <Text fontSize="sm" fontWeight="medium">Deliverability</Text>
                      <Text fontSize="sm" color="gray.600">{stats.deliverability}%</Text>
                    </Flex>
                    <Progress value={stats.deliverability} colorScheme="purple" size="lg" borderRadius="md" />
                  </Box>
                </VStack>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem>
            <Card>
              <CardHeader>
                <Heading size="md">Quick Actions</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={3} align="stretch">
                  <Button leftIcon={<AddIcon />} colorScheme="blue" size="sm" justifyContent="flex-start">
                    Create New Sequence
                  </Button>
                  <Button leftIcon={<AtSignIcon />} variant="outline" size="sm" justifyContent="flex-start">
                    Import Contacts
                  </Button>
                  <Button leftIcon={<EmailIcon />} variant="outline" size="sm" justifyContent="flex-start">
                    Send Campaign
                  </Button>
                  <Button leftIcon={<RepeatIcon />} variant="outline" size="sm" justifyContent="flex-start">
                    View Reports
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        {/* Status Overview & Recent Activity */}
        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
          <GridItem>
            <Card>
              <CardHeader>
                <Heading size="md">System Status</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <HStack justify="space-between">
                    <HStack>
                      <Icon as={CheckCircleIcon} color="green.500" />
                      <Text>Email Accounts</Text>
                    </HStack>
                    <Badge colorScheme="green">3 Active</Badge>
                  </HStack>

                  <HStack justify="space-between">
                    <HStack>
                      <Icon as={RepeatIcon} color="blue.500" />
                      <Text>Running Sequences</Text>
                    </HStack>
                    <Badge colorScheme="blue">{stats.sequencesRunning} Active</Badge>
                  </HStack>

                  <HStack justify="space-between">
                    <HStack>
                      <Icon as={TimeIcon} color="orange.500" />
                      <Text>Pending Tasks</Text>
                    </HStack>
                    <Badge colorScheme="orange">{stats.pendingTasks} Waiting</Badge>
                  </HStack>

                  <HStack justify="space-between">
                    <HStack>
                      <Icon as={WarningIcon} color="red.500" />
                      <Text>Issues</Text>
                    </HStack>
                    <Badge colorScheme="red">0 Critical</Badge>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem>
            <Card>
              <CardHeader>
                <Heading size="md">Recent Activity</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={3} align="stretch">
                  {recentActivity.map((activity, index) => (
                    <HStack key={index} align="start" spacing={3}>
                      <Icon
                        as={
                          activity.type === 'sequence_started' ? RepeatIcon :
                          activity.type === 'email_sent' ? EmailIcon :
                          activity.type === 'reply_received' ? CheckCircleIcon :
                          ArrowUpIcon
                        }
                        color={
                          activity.type === 'sequence_started' ? 'blue.500' :
                          activity.type === 'email_sent' ? 'green.500' :
                          activity.type === 'reply_received' ? 'orange.500' :
                          'purple.500'
                        }
                        mt={1}
                      />
                      <Box flex={1}>
                        <Text fontSize="sm">{activity.message}</Text>
                        <Text fontSize="xs" color="gray.500">{activity.time}</Text>
                      </Box>
                    </HStack>
                  ))}
                </VStack>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        {/* Footer */}
        <Box textAlign="center" py={4}>
          <Text fontSize="sm" color="gray.500">
            OpenDoors Email Outreach System - Powered by Reply.io Architecture Insights
          </Text>
        </Box>
      </VStack>
    </Box>
  )
}

export default OverviewDashboard