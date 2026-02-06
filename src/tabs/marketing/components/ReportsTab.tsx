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
  Heading,
  HStack,
  Select,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
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
  Spinner,
  useColorModeValue,
  Progress,
} from '@chakra-ui/react'
import {
  EmailIcon,
  CheckCircleIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

// Backend response shape from /api/reports/emails
type EmailReportResponse = {
  range: {
    start: string
    end: string
  }
  totals: Record<string, number>
  byCampaign: Array<{
    campaignId: string
    campaignName: string
    senderIdentity: {
      id: string
      emailAddress: string
      displayName?: string
    } | null
    counts: Record<string, number>
  }>
}

// Backend response shape from /api/reports/team-performance
type TeamPerformanceResponse = {
  range: {
    start: string
    end: string
  }
  rows: Array<{
    identityId: string
    emailAddress: string
    displayName?: string
    sent: number
    replied: number
    replyRate: number
  }>
}

type TimeRange = '7d' | '30d' | '90d' | '1y'

const ReportsTab: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [emailReport, setEmailReport] = useState<EmailReportResponse | null>(null)
  const [teamReport, setTeamReport] = useState<TeamPerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const bgColor = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  const calculateDateRange = (range: TimeRange) => {
    const end = new Date()
    const start = new Date()
    switch (range) {
      case '7d':
        start.setDate(start.getDate() - 7)
        break
      case '30d':
        start.setDate(start.getDate() - 30)
        break
      case '90d':
        start.setDate(start.getDate() - 90)
        break
      case '1y':
        start.setFullYear(start.getFullYear() - 1)
        break
    }
    return { start: start.toISOString(), end: end.toISOString() }
  }

  const loadReports = async () => {
    setLoading(true)
    setError(null)

    const { start, end } = calculateDateRange(timeRange)

    const [emailRes, teamRes] = await Promise.all([
      api.get<EmailReportResponse>(`/api/reports/emails?start=${start}&end=${end}`),
      api.get<TeamPerformanceResponse>(`/api/reports/team-performance?start=${start}&end=${end}`)
    ])

    if (emailRes.error && teamRes.error) {
      setError(emailRes.error)
    } else {
      if (!emailRes.error) {
        setEmailReport(emailRes.data || null)
      }
      if (!teamRes.error) {
        setTeamReport(teamRes.data || null)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    loadReports()
  }, [timeRange])

  const totals = useMemo(() => {
    if (!emailReport?.totals) {
      return {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        bounced: 0,
        unsubscribed: 0,
      }
    }
    return {
      sent: emailReport.totals.sent || 0,
      delivered: emailReport.totals.delivered || 0,
      opened: emailReport.totals.opened || 0,
      clicked: emailReport.totals.clicked || 0,
      replied: emailReport.totals.replied || 0,
      bounced: emailReport.totals.bounced || 0,
      unsubscribed: emailReport.totals.unsubscribed || 0,
    }
  }, [emailReport])

  const rates = useMemo(() => {
    const sent = totals.sent || 1 // Avoid division by zero
    return {
      openRate: ((totals.opened / sent) * 100).toFixed(1),
      clickRate: ((totals.clicked / sent) * 100).toFixed(1),
      replyRate: ((totals.replied / sent) * 100).toFixed(1),
      bounceRate: ((totals.bounced / sent) * 100).toFixed(1),
    }
  }, [totals])

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="lg" />
        <Text mt={4}>Loading reports...</Text>
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
          <Button size="sm" onClick={loadReports}>
            Refresh
          </Button>
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
        <Card bg={bgColor} borderColor={borderColor}>
          <CardBody>
            <Stat>
              <StatLabel>
                <HStack>
                  <EmailIcon />
                  <Text>Total Sent</Text>
                </HStack>
              </StatLabel>
              <StatNumber>{totals.sent.toLocaleString()}</StatNumber>
            </Stat>
          </CardBody>
        </Card>

        <Card bg={bgColor} borderColor={borderColor}>
          <CardBody>
            <Stat>
              <StatLabel>Open Rate</StatLabel>
              <StatNumber>{rates.openRate}%</StatNumber>
              <Text fontSize="sm" color="gray.500">
                {totals.opened.toLocaleString()} opened
              </Text>
            </Stat>
          </CardBody>
        </Card>

        <Card bg={bgColor} borderColor={borderColor}>
          <CardBody>
            <Stat>
              <StatLabel>
                <HStack>
                  <CheckCircleIcon color="green.500" />
                  <Text>Reply Rate</Text>
                </HStack>
              </StatLabel>
              <StatNumber>{rates.replyRate}%</StatNumber>
              <Text fontSize="sm" color="gray.500">
                {totals.replied.toLocaleString()} replies
              </Text>
            </Stat>
          </CardBody>
        </Card>

        <Card bg={bgColor} borderColor={borderColor}>
          <CardBody>
            <Stat>
              <StatLabel>Click Rate</StatLabel>
              <StatNumber>{rates.clickRate}%</StatNumber>
              <Text fontSize="sm" color="gray.500">
                {totals.clicked.toLocaleString()} clicked
              </Text>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Campaign Performance */}
      <Card mb={8}>
        <CardHeader>
          <Heading size="md">Campaign Performance</Heading>
        </CardHeader>
        <CardBody pt={0}>
          {emailReport?.byCampaign && emailReport.byCampaign.length > 0 ? (
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Campaign</Th>
                  <Th>Sender</Th>
                  <Th isNumeric>Sent</Th>
                  <Th isNumeric>Opened</Th>
                  <Th isNumeric>Clicked</Th>
                  <Th isNumeric>Replied</Th>
                  <Th isNumeric>Reply Rate</Th>
                </Tr>
              </Thead>
              <Tbody>
                {emailReport.byCampaign.map((campaign) => {
                  const sent = campaign.counts.sent || 0
                  const opened = campaign.counts.opened || 0
                  const clicked = campaign.counts.clicked || 0
                  const replied = campaign.counts.replied || 0
                  const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : '0.0'

                  return (
                    <Tr key={campaign.campaignId}>
                      <Td>
                        <Text fontWeight="medium">{campaign.campaignName}</Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm" color="gray.600">
                          {campaign.senderIdentity?.displayName || campaign.senderIdentity?.emailAddress || 'Unknown'}
                        </Text>
                      </Td>
                      <Td isNumeric>{sent.toLocaleString()}</Td>
                      <Td isNumeric>{opened.toLocaleString()}</Td>
                      <Td isNumeric>{clicked.toLocaleString()}</Td>
                      <Td isNumeric>
                        <Badge colorScheme="green" variant="subtle">
                          {replied}
                        </Badge>
                      </Td>
                      <Td isNumeric>
                        <HStack justify="flex-end" spacing={2}>
                          <Progress
                            value={parseFloat(replyRate)}
                            max={10}
                            size="sm"
                            colorScheme="green"
                            w="60px"
                          />
                          <Text fontSize="sm">{replyRate}%</Text>
                        </HStack>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          ) : (
            <Text color="gray.500" textAlign="center" py={8}>
              No campaign data available for this time range
            </Text>
          )}
        </CardBody>
      </Card>

      {/* Team Performance */}
      <Card>
        <CardHeader>
          <Heading size="md">Sender Performance</Heading>
        </CardHeader>
        <CardBody pt={0}>
          {teamReport?.rows && teamReport.rows.length > 0 ? (
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Sender</Th>
                  <Th isNumeric>Emails Sent</Th>
                  <Th isNumeric>Replies</Th>
                  <Th isNumeric>Reply Rate</Th>
                </Tr>
              </Thead>
              <Tbody>
                {teamReport.rows.map((row) => (
                  <Tr key={row.identityId}>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="medium">
                          {row.displayName || row.emailAddress}
                        </Text>
                        {row.displayName && (
                          <Text fontSize="sm" color="gray.500">
                            {row.emailAddress}
                          </Text>
                        )}
                      </VStack>
                    </Td>
                    <Td isNumeric>{row.sent.toLocaleString()}</Td>
                    <Td isNumeric>
                      <Badge colorScheme="green" variant="subtle">
                        {row.replied}
                      </Badge>
                    </Td>
                    <Td isNumeric>
                      <HStack justify="flex-end" spacing={2}>
                        <Progress
                          value={row.replyRate}
                          max={10}
                          size="sm"
                          colorScheme="green"
                          w="60px"
                        />
                        <Text fontSize="sm">{row.replyRate.toFixed(1)}%</Text>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <Text color="gray.500" textAlign="center" py={8}>
              No sender performance data available for this time range
            </Text>
          )}
        </CardBody>
      </Card>
    </Box>
  )
}

export default ReportsTab
