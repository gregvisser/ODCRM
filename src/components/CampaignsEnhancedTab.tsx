/**
 * Enhanced Campaigns Tab
 * Integrates Lists + Sequences workflow from OpensDoorsV2
 * Adapted to Chakra UI and ODCRM database schema
 */

import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  HStack,
  VStack,
  Text,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  FormControl,
  FormLabel,
  Input,
  Select,
  useToast,
  Spinner,
  Grid,
} from '@chakra-ui/react'
import { AddIcon, ViewIcon } from '@chakra-ui/icons'
import { api } from '../utils/api'

type Campaign = {
  id: string
  customerId: string
  name: string
  description?: string
  status: string
  listId?: string
  sequenceId?: string
  senderIdentityId: string
  createdAt: string
}

type CampaignFormState = {
  customerId: string
  name: string
  description: string
  listId: string
  sequenceId: string
  senderIdentityId: string
}

export default function CampaignsEnhancedTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [lists, setLists] = useState<any[]>([])
  const [sequences, setSequences] = useState<any[]>([])
  const [emailIdentities, setEmailIdentities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState<CampaignFormState>({
    customerId: '',
    name: '',
    description: '',
    listId: '',
    sequenceId: '',
    senderIdentityId: '',
  })

  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure()
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    
    // Fetch all necessary data
    const [customersRes, campaignsRes] = await Promise.all([
      api.get<any[]>('/api/customers'),
      api.get<Campaign[]>('/api/campaigns'),
    ])

    if (customersRes.data) {
      setCustomers(customersRes.data)
      if (customersRes.data.length > 0 && !form.customerId) {
        setForm((f) => ({ ...f, customerId: customersRes.data[0].id }))
      }
    }

    if (campaignsRes.data) {
      setCampaigns(campaignsRes.data)
    }

    setLoading(false)
  }

  // Load lists and sequences when customer changes
  useEffect(() => {
    if (form.customerId) {
      Promise.all([
        api.get<any[]>(`/api/lists?customerId=${form.customerId}`),
        api.get<any[]>(`/api/sequences?customerId=${form.customerId}`),
        api.get<any[]>(`/api/outlook/identities?customerId=${form.customerId}`),
      ]).then(([listsRes, seqsRes, identitiesRes]) => {
        if (listsRes.data) setLists(listsRes.data)
        if (seqsRes.data) setSequences(seqsRes.data)
        if (identitiesRes.data) setEmailIdentities(identitiesRes.data)
      })
    }
  }, [form.customerId])

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreateCampaign = async () => {
    if (!form.name || !form.customerId || !form.listId || !form.sequenceId || !form.senderIdentityId) {
      toast({
        title: 'Validation Error',
        description: 'All fields are required',
        status: 'error',
      })
      return
    }

    const { error } = await api.post('/api/campaigns', {
      customerId: form.customerId,
      name: form.name,
      description: form.description,
      listId: form.listId,
      sequenceId: form.sequenceId,
      senderIdentityId: form.senderIdentityId,
      status: 'draft',
    })

    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'Campaign created (DRAFT)', status: 'success' })
      onCreateClose()
      fetchData()
      setForm({
        customerId: form.customerId,
        name: '',
        description: '',
        listId: '',
        sequenceId: '',
        senderIdentityId: '',
      })
    }
  }

  const handleStartCampaign = async (campaignId: string) => {
    const { error } = await api.post(`/api/campaigns/${campaignId}/start`, {})
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'Campaign started', status: 'success' })
      fetchData()
    }
  }

  const handlePauseCampaign = async (campaignId: string) => {
    const { error } = await api.post(`/api/campaigns/${campaignId}/pause`, {})
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'Campaign paused', status: 'success' })
      fetchData()
    }
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
      </Box>
    )
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Box>
          <Heading size="lg">Campaigns</Heading>
          <Text fontSize="sm" color="gray.600">
            Launch sequences to lists using email accounts
          </Text>
        </Box>
        <Button leftIcon={<AddIcon />} colorScheme="teal" onClick={onCreateOpen}>
          Create Campaign
        </Button>
      </HStack>

      <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
        <Table size="sm">
          <Thead bg="gray.50">
            <Tr>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>List</Th>
              <Th>Sequence</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {campaigns.length === 0 ? (
              <Tr>
                <Td colSpan={6} textAlign="center" py={8}>
                  <Text color="gray.500">No campaigns yet. Create your first campaign to get started.</Text>
                </Td>
              </Tr>
            ) : (
              campaigns.map((campaign) => (
                <Tr key={campaign.id}>
                  <Td fontWeight="medium">{campaign.name}</Td>
                  <Td>
                    <Badge
                      colorScheme={
                        campaign.status === 'running'
                          ? 'green'
                          : campaign.status === 'paused'
                            ? 'yellow'
                            : campaign.status === 'completed'
                              ? 'blue'
                              : 'gray'
                      }
                    >
                      {campaign.status.toUpperCase()}
                    </Badge>
                  </Td>
                  <Td fontSize="sm">List name here</Td>
                  <Td fontSize="sm">Sequence name here</Td>
                  <Td fontSize="sm" color="gray.600">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </Td>
                  <Td>
                    <HStack spacing={1}>
                      {campaign.status === 'draft' && (
                        <Button size="xs" colorScheme="green" onClick={() => handleStartCampaign(campaign.id)}>
                          Start
                        </Button>
                      )}
                      {campaign.status === 'running' && (
                        <Button size="xs" colorScheme="yellow" onClick={() => handlePauseCampaign(campaign.id)}>
                          Pause
                        </Button>
                      )}
                      <IconButton
                        aria-label="View details"
                        icon={<ViewIcon />}
                        size="xs"
                        variant="ghost"
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Box>

      {/* Create Campaign Modal */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create Campaign</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel fontSize="sm">Customer</FormLabel>
                <Select
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.domain})
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm">Campaign Name</FormLabel>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="January Outreach 2026"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Description</FormLabel>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm">List (Target Audience)</FormLabel>
                <Select value={form.listId} onChange={(e) => setForm({ ...form, listId: e.target.value })}>
                  <option value="">Select list...</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.contactCount || 0} contacts)
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm">Sequence (Email Workflow)</FormLabel>
                <Select value={form.sequenceId} onChange={(e) => setForm({ ...form, sequenceId: e.target.value })}>
                  <option value="">Select sequence...</option>
                  {sequences.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.stepCount || 0} steps)
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm">Email Account (Sender)</FormLabel>
                <Select
                  value={form.senderIdentityId}
                  onChange={(e) => setForm({ ...form, senderIdentityId: e.target.value })}
                >
                  <option value="">Select email account...</option>
                  {emailIdentities.map((identity) => (
                    <option key={identity.id} value={identity.id}>
                      {identity.emailAddress} ({identity.displayName || 'No name'})
                    </option>
                  ))}
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateClose}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={handleCreateCampaign}>
              Create Campaign (Draft)
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
