import React from 'react'
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
} from '@chakra-ui/react'
import {
  EmailIcon,
  RepeatIcon,
  AtSignIcon,
  CheckCircleIcon,
  WarningIcon,
  TimeIcon,
  TrendingUpIcon,
  AddIcon,
} from '@chakra-ui/icons'

const OverviewDashboard: React.FC = () => {
  // Mock data - in real implementation, this would come from API calls
  const stats = {
    totalContacts: 33519,
    activeSequences: 12,
    emailsSentToday: 2340,
    replyRate: 2.1,
    openRate: 24.5,
    sequencesRunning: 8,
    pendingTasks: 15,
    deliverability: 98.2,
  }

  const recentActivity = [
    { type: 'sequence_started', message: 'Welcome sequence started for 150 contacts', time: '2 min ago' },
    { type: 'email_sent', message: 'Follow-up emails sent to 89 prospects', time: '15 min ago' },
    { type: 'reply_received', message: 'New reply from john@techcorp.com', time: '1 hour ago' },
    { type: 'sequence_completed', message: 'Product demo sequence completed for 23 contacts', time: '2 hours ago' },
  ]

  return (
    <Box p={6} maxW="1200px" mx="auto">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="lg" mb={2}>Email Outreach Overview</Heading>
          <Text color="gray.600">
            Monitor your email campaigns, sequences, and contact engagement in real-time
          </Text>
        </Box>

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
                          TrendingUpIcon
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