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
import { useToast } from '@chakra-ui/react'

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

interface EmployeeStats {
  employeeId: string
  employeeName: string
  emailAddress: string
  emailsSentToday: number
  emailsSentWeek: number
  repliesToday: number
  repliesWeek: number
}

interface RecentActivity {
  type: 'sequence_started' | 'email_sent' | 'reply_received' | 'sequence_completed' | 'campaign_sent'
  message: string
  time: string
}

const OverviewDashboard: React.FC = () => {
  const toast = useToast()
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
  const [contactsBySource, setContactsBySource] = useState<Record<string, number>>({})
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([])
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

        // Fetch overview data from the new overview endpoint
        const overviewRes = await api.get('/api/overview')

        if (overviewRes.data) {
          const data = overviewRes.data

          // Update main stats
          setStats({
            totalContacts: data.totalContacts || 0,
            activeSequences: data.activeSequences || 0,
            emailsSentToday: data.emailsSentToday || 0,
            replyRate: 0, // Will calculate from employee stats
            openRate: 0, // Will calculate from employee stats
            sequencesRunning: data.activeSequences || 0, // Using active sequences as running
            pendingTasks: 0, // Not implemented yet
            deliverability: 0, // Not implemented yet
          })

          // Update contacts by source breakdown
          setContactsBySource(data.contactsBySource || {})

          // Update employee stats (guard non-array)
          setEmployeeStats(Array.isArray(data.employeeStats) ? data.employeeStats : [])

          // Calculate aggregate reply rate from employee stats
          const empStats = Array.isArray(data.employeeStats) ? data.employeeStats : []
          if (empStats.length > 0) {
            const totalReplies = empStats.reduce((sum: number, emp: any) => sum + emp.repliesToday, 0)
            const totalSent = empStats.reduce((sum: number, emp: any) => sum + emp.emailsSentToday, 0)
            const replyRate = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0

            setStats(prev => ({
              ...prev,
              replyRate: Math.round(replyRate * 10) / 10,
            }))
          }
        }

        // Fetch recent activity (keep existing logic for now)
        const [campaignsRes, inboxRes] = await Promise.allSettled([
          api.get('/api/campaigns?limit=3'),
          api.get('/api/inbox?limit=3'),
        ])

        const activity: RecentActivity[] = []

        // Add campaign activity
        if (campaignsRes.status === 'fulfilled') {
          const campaigns = Array.isArray(campaignsRes.value?.data) ? campaignsRes.value.data : []
          campaigns.forEach((campaign: any) => {
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
          const inboxItems = Array.isArray(inboxRes.value?.data) ? inboxRes.value.data : []
          inboxItems.forEach((item: any) => {
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

      // Fetch overview data from the new overview endpoint
      const overviewRes = await api.get('/api/overview')

      if (overviewRes.data) {
        const data = overviewRes.data

        // Update main stats
        setStats({
          totalContacts: data.totalContacts || 0,
          activeSequences: data.activeSequences || 0,
          emailsSentToday: data.emailsSentToday || 0,
          replyRate: 0, // Will calculate from employee stats
          openRate: 0, // Will calculate from employee stats
          sequencesRunning: data.activeSequences || 0, // Using active sequences as running
          pendingTasks: 0, // Not implemented yet
          deliverability: 0, // Not implemented yet
        })

        const empStatsArr = Array.isArray(data.employeeStats) ? data.employeeStats : []
        setEmployeeStats(empStatsArr)

        if (empStatsArr.length > 0) {
          const totalReplies = empStatsArr.reduce((sum: number, emp: any) => sum + emp.repliesToday, 0)
          const totalSent = empStatsArr.reduce((sum: number, emp: any) => sum + emp.emailsSentToday, 0)
          const replyRate = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0
          setStats(prev => ({
            ...prev,
            replyRate: Math.round(replyRate * 10) / 10,
          }))
        }
      }

      // Fetch recent activity
      const [campaignsRes, inboxRes] = await Promise.allSettled([
        api.get('/api/campaigns?limit=3'),
        api.get('/api/inbox?limit=3'),
      ])

      const activity: RecentActivity[] = []

      // Add campaign activity
      if (campaignsRes.status === 'fulfilled') {
        const campaigns = Array.isArray(campaignsRes.value?.data) ? campaignsRes.value.data : []
        campaigns.forEach((campaign: any) => {
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

      if (inboxRes.status === 'fulfilled') {
        const inboxItems = Array.isArray(inboxRes.value?.data) ? inboxRes.value.data : []
        inboxItems.forEach((item: any) => {
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
                <StatHelpText fontSize="xs" color="gray.500">
                  {contactsBySource.cognism ? `Cognism: ${contactsBySource.cognism.toLocaleString()}` : ''}
                  {contactsBySource.cognism && (contactsBySource.apollo || contactsBySource.social) ? ' | ' : ''}
                  {contactsBySource.apollo ? `Apollo: ${contactsBySource.apollo.toLocaleString()}` : ''}
                  {contactsBySource.apollo && contactsBySource.social ? ' | ' : ''}
                  {contactsBySource.social ? `Social: ${contactsBySource.social.toLocaleString()}` : ''}
                  {!contactsBySource.cognism && !contactsBySource.apollo && !contactsBySource.social ? 'No sources configured' : ''}
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

        {/* Employee Performance */}
        {employeeStats.length > 0 && (
          <Card>
            <CardHeader>
              <Heading size="md">Employee Performance</Heading>
              <Text fontSize="sm" color="gray.600">Today's email activity by team member</Text>
            </CardHeader>
            <CardBody>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                {employeeStats.map((employee) => (
                  <Card key={employee.employeeId} variant="outline">
                    <CardBody>
                      <VStack spacing={2} align="stretch">
                        <Flex justify="space-between" align="center">
                          <Text fontWeight="semibold" fontSize="sm">{employee.employeeName}</Text>
                          <Badge colorScheme="blue" fontSize="xs">{employee.emailAddress.split('@')[0]}</Badge>
                        </Flex>

                        <SimpleGrid columns={2} spacing={2} fontSize="xs">
                          <Box>
                            <Text color="gray.600">Sent Today</Text>
                            <Text fontWeight="bold" color="blue.600">{employee.emailsSentToday}</Text>
                          </Box>
                          <Box>
                            <Text color="gray.600">Sent Week</Text>
                            <Text fontWeight="bold" color="blue.600">{employee.emailsSentWeek}</Text>
                          </Box>
                          <Box>
                            <Text color="gray.600">Replies Today</Text>
                            <Text fontWeight="bold" color="green.600">{employee.repliesToday}</Text>
                          </Box>
                          <Box>
                            <Text color="gray.600">Replies Week</Text>
                            <Text fontWeight="bold" color="green.600">{employee.repliesWeek}</Text>
                          </Box>
                        </SimpleGrid>

                        {employee.emailsSentToday > 0 && (
                          <Box>
                            <Text fontSize="xs" color="gray.600" mb={1}>Reply Rate Today</Text>
                            <Progress
                              value={(employee.repliesToday / employee.emailsSentToday) * 100}
                              colorScheme="green"
                              size="sm"
                              borderRadius="md"
                            />
                          </Box>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>
                ))}
              </SimpleGrid>
            </CardBody>
          </Card>
        )}

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