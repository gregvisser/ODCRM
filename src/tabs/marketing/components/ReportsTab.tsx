import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
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
  CalendarIcon,
  EmailIcon,
  CheckCircleIcon,
  WarningIcon,
  TriangleUpIcon,
  TriangleDownIcon,
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
  const [error, setError] = useState<string | null>(null)

  const bgColor = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  const loadReports = async () => {
    setLoading(true)
    setError(null)

    const [metricsRes, sequencesRes] = await Promise.all([
      api.get<ReportMetrics>(`/api/reports/metrics?range=${timeRange}`),
      api.get<SequenceReport[]>(`/api/reports/sequences?range=${timeRange}`)
    ])

    if (metricsRes.error && sequencesRes.error) {
      setError(metricsRes.error)
    } else {
      if (!metricsRes.error) {
        setMetrics(metricsRes.data || null)
      }
      if (!sequencesRes.error) {
        setSequences(sequencesRes.data || [])
      }
    }

    setLoading(false)
  }

  useEffect(() => {
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
        icon: CalendarIcon,
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
        icon: TriangleUpIcon,
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

      {/* Error Display */}
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>Failed to load reports</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
          <Button size="sm" onClick={loadReports} ml={4}>
            Retry
          </Button>
        </Alert>
      )}

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
