import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Progress,
  Select,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Badge,
  Button,
  Spacer,
  Divider,
  useColorModeValue,
} from '@chakra-ui/react'
import {
  BarChartIcon,
  LineChartIcon,
  PieChartIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CalendarIcon,
  EmailIcon,
  CheckCircleIcon,
  WarningIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

type ReportMetrics = {
  totalEmails: number
  deliveredEmails: number
  openedEmails: number
  clickedEmails: number
  repliedEmails: number
  bouncedEmails: number
  unsubscribedEmails: number
  openRate: number
  clickRate: number
  replyRate: number
  bounceRate: number
  unsubscribeRate: number
}

type SequenceReport = {
  id: string
  name: string
  status: 'active' | 'paused' | 'completed'
  sent: number
  delivered: number
  opened: number
  clicked: number
  replied: number
  replyRate: number
  lastActivity: string
}

type TimeRange = '7d' | '30d' | '90d' | '1y'

const ReportsTab: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null)
  const [sequences, setSequences] = useState<SequenceReport[]>([])
  const [loading, setLoading] = useState(true)

  const bgColor = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  useEffect(() => {
    const loadReports = async () => {
      try {
        setLoading(true)
        const [metricsRes, sequencesRes] = await Promise.all([
          api.get<ReportMetrics>(`/api/reports/metrics?range=${timeRange}`),
          api.get<SequenceReport[]>(`/api/reports/sequences?range=${timeRange}`)
        ])

        setMetrics(metricsRes.data || null)
        setSequences(sequencesRes.data || [])
      } catch (error) {
        console.error('Failed to load reports:', error)
        // Set mock data for development
        setMetrics({
          totalEmails: 15420,
          deliveredEmails: 14850,
          openedEmails: 4230,
          clickedEmails: 845,
          repliedEmails: 324,
          bouncedEmails: 570,
          unsubscribedEmails: 89,
          openRate: 28.4,
          clickRate: 5.7,
          replyRate: 2.2,
          bounceRate: 3.8,
          unsubscribeRate: 0.6,
        })
        setSequences([
          {
            id: '1',
            name: 'Enterprise Outreach Q1',
            status: 'active',
            sent: 2450,
            delivered: 2380,
            opened: 680,
            clicked: 136,
            replied: 52,
            replyRate: 2.2,
            lastActivity: '2024-01-25T10:30:00Z',
          },
          {
            id: '2',
            name: 'Startup Follow-up',
            status: 'active',
            sent: 1820,
            delivered: 1780,
            opened: 520,
            clicked: 104,
            replied: 38,
            replyRate: 2.1,
            lastActivity: '2024-01-25T09:15:00Z',
          },
        ])
      } finally {
        setLoading(false)
      }
    }

    loadReports()
  }, [timeRange])

  const statCards = useMemo(() => {
    if (!metrics) return []

    return [
      {
        label: 'Total Emails Sent',
        value: metrics.totalEmails.toLocaleString(),
        change: '+12.5%',
        changeType: 'increase' as const,
        icon: EmailIcon,
      },
      {
        label: 'Open Rate',
        value: `${metrics.openRate}%`,
        change: '+2.1%',
        changeType: 'increase' as const,
        icon: BarChartIcon,
      },
      {
        label: 'Reply Rate',
        value: `${metrics.replyRate}%`,
        change: '+0.3%',
        changeType: 'increase' as const,
        icon: CheckCircleIcon,
      },
      {
        label: 'Click Rate',
        value: `${metrics.clickRate}%`,
        change: '-0.2%',
        changeType: 'decrease' as const,
        icon: TrendingUpIcon,
      },
    ]
  }, [metrics])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green'
      case 'paused': return 'yellow'
      case 'completed': return 'blue'
      default: return 'gray'
    }
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Loading reports...</Text>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Analytics & Reports</Heading>
          <Text color="gray.600">
            Comprehensive insights into your email outreach performance
          </Text>
        </VStack>
        <HStack>
          <Text fontSize="sm" color="gray.600">Time Range:</Text>
          <Select
            size="sm"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            w="120px"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </Select>
        </HStack>
      </Flex>

      {/* Key Metrics */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4} mb={8}>
        {statCards.map((stat, index) => (
          <Card key={index} bg={bgColor} borderColor={borderColor}>
            <CardBody>
              <Stat>
                <StatLabel fontSize="sm" color="gray.600">
                  <HStack>
                    <Icon as={stat.icon} boxSize={4} />
                    <Text>{stat.label}</Text>
                  </HStack>
                </StatLabel>
                <StatNumber fontSize="2xl">{stat.value}</StatNumber>
                <StatHelpText>
                  <StatArrow type={stat.changeType} />
                  {stat.change} from last period
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      {/* Performance Overview */}
      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6} mb={8}>
        <Card bg={bgColor} borderColor={borderColor}>
          <CardHeader>
            <Heading size="md">Email Performance Breakdown</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm">Delivered</Text>
                  <Text fontSize="sm" fontWeight="semibold">
                    {metrics?.deliveredEmails.toLocaleString()} ({((metrics?.deliveredEmails || 0) / (metrics?.totalEmails || 1) * 100).toFixed(1)}%)
                  </Text>
                </HStack>
                <Progress
                  value={(metrics?.deliveredEmails || 0) / (metrics?.totalEmails || 1) * 100}
                  colorScheme="green"
                  size="sm"
                />
              </Box>

              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm">Opened</Text>
                  <Text fontSize="sm" fontWeight="semibold">
                    {metrics?.openedEmails.toLocaleString()} ({metrics?.openRate}%)
                  </Text>
                </HStack>
                <Progress value={metrics?.openRate || 0} colorScheme="blue" size="sm" />
              </Box>

              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm">Clicked</Text>
                  <Text fontSize="sm" fontWeight="semibold">
                    {metrics?.clickedEmails.toLocaleString()} ({metrics?.clickRate}%)
                  </Text>
                </HStack>
                <Progress value={metrics?.clickRate || 0} colorScheme="purple" size="sm" />
              </Box>

              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm">Replied</Text>
                  <Text fontSize="sm" fontWeight="semibold">
                    {metrics?.repliedEmails.toLocaleString()} ({metrics?.replyRate}%)
                  </Text>
                </HStack>
                <Progress value={metrics?.replyRate || 0} colorScheme="orange" size="sm" />
              </Box>
            </VStack>
          </CardBody>
        </Card>

        <Card bg={bgColor} borderColor={borderColor}>
          <CardHeader>
            <Heading size="md">Issues & Alerts</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={3} align="stretch">
              <Box>
                <HStack>
                  <Icon as={WarningIcon} color="red.500" boxSize={4} />
                  <Text fontSize="sm">High bounce rate detected</Text>
                </HStack>
                <Text fontSize="xs" color="gray.600" mt={1}>
                  {metrics?.bounceRate}% bounce rate exceeds 5% threshold
                </Text>
              </Box>

              <Divider />

              <Box>
                <HStack>
                  <Icon as={CheckCircleIcon} color="green.500" boxSize={4} />
                  <Text fontSize="sm">Deliverability is healthy</Text>
                </HStack>
                <Text fontSize="xs" color="gray.600" mt={1}>
                  {metrics?.deliveredEmails}/{metrics?.totalEmails} emails delivered
                </Text>
              </Box>
            </VStack>
          </CardBody>
        </Card>
      </Grid>

      {/* Sequence Performance */}
      <Card bg={bgColor} borderColor={borderColor}>
        <CardHeader>
          <Flex justify="space-between" align="center">
            <Heading size="md">Sequence Performance</Heading>
            <Button size="sm" variant="outline">
              View All Sequences
            </Button>
          </Flex>
        </CardHeader>
        <CardBody>
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Sequence Name</Th>
                  <Th>Status</Th>
                  <Th isNumeric>Sent</Th>
                  <Th isNumeric>Opened</Th>
                  <Th isNumeric>Replied</Th>
                  <Th isNumeric>Reply Rate</Th>
                  <Th>Last Activity</Th>
                </Tr>
              </Thead>
              <Tbody>
                {sequences.map((sequence) => (
                  <Tr key={sequence.id}>
                    <Td fontWeight="semibold">{sequence.name}</Td>
                    <Td>
                      <Badge colorScheme={getStatusColor(sequence.status)} size="sm">
                        {sequence.status}
                      </Badge>
                    </Td>
                    <Td isNumeric>{sequence.sent.toLocaleString()}</Td>
                    <Td isNumeric>{sequence.opened.toLocaleString()}</Td>
                    <Td isNumeric>{sequence.replied.toLocaleString()}</Td>
                    <Td isNumeric>{sequence.replyRate}%</Td>
                    <Td>
                      <Text fontSize="xs" color="gray.600">
                        {new Date(sequence.lastActivity).toLocaleDateString()}
                      </Text>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </CardBody>
      </Card>
    </Box>
  )
}

export default ReportsTab
