import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Heading,
  HStack,
  Input,
  Select,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react'
import { api } from '../utils/api'

type InboxReplyItem = {
  prospectId: string
  campaignId: string
  campaignName?: string
  senderEmail?: string
  senderName?: string
  contact: {
    id: string
    firstName: string
    lastName: string
    companyName: string
    email: string
  }
  replyDetectedAt: string
  replyCount: number
  lastReplySnippet?: string | null
}

type InboxRepliesResponse = {
  range: { start: string; end: string }
  items: InboxReplyItem[]
}

type CampaignListItem = { id: string; name: string }

export default function MarketingInboxTab() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<InboxReplyItem[]>([])
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([])
  const [q, setQ] = useState('')
  const [campaignId, setCampaignId] = useState<string>('')

  const fetchData = async () => {
    setLoading(true)
    const [replies, campaignsRes] = await Promise.all([
      api.get<InboxRepliesResponse>(`/api/inbox/replies${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ''}`),
      api.get<any[]>('/api/campaigns'),
    ])
    setItems(replies.data?.items || [])
    setCampaigns((campaignsRes.data || []).map((c: any) => ({ id: c.id, name: c.name })))
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return items
    return items.filter((r) =>
      [
        r.campaignName,
        r.senderEmail,
        r.senderName,
        r.contact.firstName,
        r.contact.lastName,
        r.contact.email,
        r.contact.companyName,
        r.lastReplySnippet,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [items, q])

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
          <Heading size="lg">Inbox</Heading>
          <Text fontSize="sm" color="gray.600">
            Reply-detected prospects (Reply.io “Inbox” style).
          </Text>
        </Box>
        <HStack spacing={3}>
          <Select
            size="sm"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            placeholder="All campaigns"
            minW="240px"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search replies..." size="sm" />
        </HStack>
      </HStack>

      {filtered.length === 0 ? (
        <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" p={6}>
          <Text color="gray.600">No replies detected in the selected range.</Text>
        </Box>
      ) : (
        <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
          <Table size="sm">
            <Thead bg="gray.50">
              <Tr>
                <Th>Contact</Th>
                <Th>Company</Th>
                <Th>Campaign</Th>
                <Th>Sender</Th>
                <Th>Reply</Th>
                <Th>When</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.slice(0, 500).map((r) => (
                <Tr key={r.prospectId}>
                  <Td>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm">
                        {r.contact.firstName} {r.contact.lastName}
                      </Text>
                      <Text fontSize="xs" color="gray.600">
                        {r.contact.email}
                      </Text>
                    </VStack>
                  </Td>
                  <Td>{r.contact.companyName}</Td>
                  <Td>{r.campaignName || r.campaignId}</Td>
                  <Td>
                    <Text fontSize="sm">{r.senderEmail || '-'}</Text>
                  </Td>
                  <Td>
                    <VStack align="start" spacing={1}>
                      <Badge colorScheme="green">replied</Badge>
                      {r.lastReplySnippet && (
                        <Text fontSize="xs" color="gray.700" noOfLines={3} maxW="520px">
                          {r.lastReplySnippet}
                        </Text>
                      )}
                    </VStack>
                  </Td>
                  <Td>
                    <Text fontSize="sm">{new Date(r.replyDetectedAt).toLocaleString()}</Text>
                    <Text fontSize="xs" color="gray.500">
                      {r.replyCount} total
                    </Text>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  )
}

