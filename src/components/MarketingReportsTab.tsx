import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Tabs,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
} from '@chakra-ui/react'
import { api } from '../utils/api'

type EmailsReport = {
  range: { start: string; end: string }
  totals: Record<string, number>
  byCampaign: Array<{
    campaignId: string
    campaignName: string
    senderIdentity: { id: string; emailAddress: string; displayName?: string | null } | null
    counts: Record<string, number>
  }>
}

type TeamPerformanceReport = {
  range: { start: string; end: string }
  rows: Array<{
    identityId: string
    emailAddress: string
    displayName?: string
    sent: number
    replied: number
    replyRate: number
  }>
}

function n(v: unknown): number {
  return typeof v === 'number' ? v : 0
}

export default function MarketingReportsTab() {
  const [loading, setLoading] = useState(true)
  const [emails, setEmails] = useState<EmailsReport | null>(null)
  const [team, setTeam] = useState<TeamPerformanceReport | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [e, t] = await Promise.all([
        api.get<EmailsReport>('/api/reports/emails'),
        api.get<TeamPerformanceReport>('/api/reports/team-performance'),
      ])
      setEmails(e.data || null)
      setTeam(t.data || null)
      setLoading(false)
    })()
  }, [])

  const totals = useMemo(() => {
    const src = emails?.totals || {}
    return {
      sent: n(src.sent),
      opened: n(src.opened),
      replied: n(src.replied),
      bounced: n(src.bounced),
      unsubscribed: n(src.unsubscribed),
    }
  }, [emails])

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
      </Box>
    )
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
        <Box>
          <Heading size="lg">Reports</Heading>
          <Text fontSize="sm" color="gray.600">
            Reply.io-style reporting based on ODCRM email events (sent/opened/replied/bounced/unsubscribed).
          </Text>
        </Box>
        <Text fontSize="xs" color="gray.500">
          Range: {emails?.range?.start ? new Date(emails.range.start).toLocaleDateString() : '—'} →{' '}
          {emails?.range?.end ? new Date(emails.range.end).toLocaleDateString() : '—'}
        </Text>
      </HStack>

      <Tabs variant="enclosed" colorScheme="teal" isLazy>
        <TabList overflowX="auto" whiteSpace="nowrap">
          <Tab>Emails</Tab>
          <Tab>Team performance</Tab>
        </TabList>
        <TabPanels pt={4}>
          <TabPanel px={0}>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={4} mb={5}>
              <Stat>
                <StatLabel>Sent</StatLabel>
                <StatNumber>{totals.sent}</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Opened</StatLabel>
                <StatNumber>{totals.opened}</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Replied</StatLabel>
                <StatNumber>{totals.replied}</StatNumber>
                <StatHelpText>{totals.sent > 0 ? ((totals.replied / totals.sent) * 100).toFixed(1) : '0.0'}% reply rate</StatHelpText>
              </Stat>
              <Stat>
                <StatLabel>Bounced</StatLabel>
                <StatNumber>{totals.bounced}</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Unsubscribed</StatLabel>
                <StatNumber>{totals.unsubscribed}</StatNumber>
              </Stat>
            </SimpleGrid>

            <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
              <Table size="sm">
                <Thead bg="gray.50">
                  <Tr>
                    <Th>Campaign</Th>
                    <Th>Sender</Th>
                    <Th isNumeric>Sent</Th>
                    <Th isNumeric>Opened</Th>
                    <Th isNumeric>Replied</Th>
                    <Th isNumeric>Bounced</Th>
                    <Th isNumeric>Unsub</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {(emails?.byCampaign || []).map((row) => (
                    <Tr key={row.campaignId}>
                      <Td>{row.campaignName}</Td>
                      <Td>{row.senderIdentity?.emailAddress || '-'}</Td>
                      <Td isNumeric>{n(row.counts.sent)}</Td>
                      <Td isNumeric>{n(row.counts.opened)}</Td>
                      <Td isNumeric>{n(row.counts.replied)}</Td>
                      <Td isNumeric>{n(row.counts.bounced)}</Td>
                      <Td isNumeric>{n(row.counts.unsubscribed)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>

          <TabPanel px={0}>
            <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
              <Table size="sm">
                <Thead bg="gray.50">
                  <Tr>
                    <Th>Sender</Th>
                    <Th isNumeric>Sent</Th>
                    <Th isNumeric>Replied</Th>
                    <Th isNumeric>Reply rate</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {(team?.rows || []).map((r) => (
                    <Tr key={r.identityId}>
                      <Td>{r.emailAddress}</Td>
                      <Td isNumeric>{r.sent}</Td>
                      <Td isNumeric>{r.replied}</Td>
                      <Td isNumeric>{r.replyRate.toFixed(1)}%</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}

