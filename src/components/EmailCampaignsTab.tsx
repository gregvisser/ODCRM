import { useState, useEffect, useRef } from 'react'
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
  useToast,
  Spinner,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure as useAlertDisclosure
} from '@chakra-ui/react'
import { AddIcon, EditIcon, ViewIcon, DeleteIcon } from '@chakra-ui/icons'
import { api } from '../utils/api'
import CampaignWizard from './CampaignWizard'
import CampaignDetail from './CampaignDetail'

interface EmailCampaign {
  id: string
  name: string
  description?: string
  status: 'draft' | 'running' | 'paused' | 'completed'
  senderIdentity: {
    emailAddress: string
    displayName?: string
  }
  createdAt: string
  metrics: {
    totalProspects: number
    emailsSent: number
    opened: number
    bounced: number
    unsubscribed: number
    replied: number
    openRate: number
    bounceRate: number
    unsubscribeRate: number
    replyRate: number
  }
}

export default function EmailCampaignsTab() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [campaignToDelete, setCampaignToDelete] = useState<EmailCampaign | null>(null)
  const { isOpen: isWizardOpen, onOpen: onWizardOpen, onClose: onWizardClose } = useDisclosure()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useAlertDisclosure()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const toast = useToast()

  const fetchCampaigns = async () => {
    setLoading(true)
    const { data, error } = await api.get<EmailCampaign[]>('/api/campaigns')
    if (error) {
      toast({
        title: 'Error',
        description: error,
        status: 'error',
        duration: 3000
      })
    } else if (data) {
      setCampaigns(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const handleStartCampaign = async (id: string) => {
    const { error } = await api.post(`/api/campaigns/${id}/start`, {})
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'Campaign started', status: 'success' })
      fetchCampaigns()
    }
  }

  const handlePauseCampaign = async (id: string) => {
    const { error } = await api.post(`/api/campaigns/${id}/pause`, {})
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'Campaign paused', status: 'success' })
      fetchCampaigns()
    }
  }

  const handleCompleteCampaign = async (id: string) => {
    const { error } = await api.post(`/api/campaigns/${id}/complete`, {})
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'Campaign completed', status: 'success' })
      fetchCampaigns()
    }
  }

  const handleDeleteClick = (campaign: EmailCampaign) => {
    setCampaignToDelete(campaign)
    onDeleteOpen()
  }

  const handleDeleteConfirm = async () => {
    if (!campaignToDelete) return

    const { error } = await api.delete(`/api/campaigns/${campaignToDelete.id}`)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ 
        title: 'Success', 
        description: `Campaign "${campaignToDelete.name}" deleted successfully`, 
        status: 'success' 
      })
      fetchCampaigns()
      setCampaignToDelete(null)
    }
    onDeleteClose()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'green'
      case 'paused': return 'yellow'
      case 'completed': return 'blue'
      case 'draft': return 'gray'
      default: return 'gray'
    }
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
      </Box>
    )
  }

  if (selectedCampaign) {
    return (
      <CampaignDetail
        campaignId={selectedCampaign}
        onBack={() => setSelectedCampaign(null)}
      />
    )
  }

  return (
    <Box>
      <HStack justify="space-between" mb={6}>
        <Heading size="lg">Email Campaigns</Heading>
        <Button
          leftIcon={<AddIcon />}
          colorScheme="gray"
          onClick={() => {
            setEditingCampaignId(null)
            onWizardOpen()
          }}
        >
          New Campaign
        </Button>
      </HStack>

      {campaigns.length === 0 ? (
        <Box textAlign="center" py={10}>
          <Text color="gray.500" mb={4}>No campaigns yet. Create your first campaign to get started.</Text>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="gray"
            onClick={() => {
              setEditingCampaignId(null)
              onWizardOpen()
            }}
          >
            Create Campaign
          </Button>
        </Box>
      ) : (
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>Sender</Th>
              <Th>Metrics</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {campaigns.map((campaign) => (
              <Tr key={campaign.id}>
                <Td>
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="medium">{campaign.name}</Text>
                    {campaign.description && (
                      <Text fontSize="sm" color="gray.500">{campaign.description}</Text>
                    )}
                  </VStack>
                </Td>
                <Td>
                  <Badge colorScheme={getStatusColor(campaign.status)}>
                    {campaign.status}
                  </Badge>
                </Td>
                <Td>
                  <Text fontSize="sm">{campaign.senderIdentity.emailAddress}</Text>
                </Td>
                <Td>
                  <VStack align="start" spacing={1} fontSize="sm">
                    <Text><strong>{campaign.metrics.emailsSent}</strong> sent</Text>
                    <Text><strong>{campaign.metrics.replied}</strong> replied ({campaign.metrics.replyRate.toFixed(1)}%)</Text>
                    <Text><strong>{campaign.metrics.opened}</strong> opened ({campaign.metrics.openRate.toFixed(1)}%)</Text>
                  </VStack>
                </Td>
                <Td>
                  <Text fontSize="sm">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </Text>
                </Td>
                <Td>
                  <HStack spacing={2}>
                    <IconButton
                      aria-label="View"
                      icon={<ViewIcon />}
                      size="sm"
                      onClick={() => setSelectedCampaign(campaign.id)}
                    />
                    {campaign.status === 'draft' && (
                      <IconButton
                        aria-label="Edit"
                        icon={<EditIcon />}
                        size="sm"
                        onClick={() => {
                          setEditingCampaignId(campaign.id)
                          onWizardOpen()
                        }}
                      />
                    )}
                    {campaign.status === 'draft' && (
                      <Button size="sm" colorScheme="gray" onClick={() => handleStartCampaign(campaign.id)}>
                        Start
                      </Button>
                    )}
                    {campaign.status === 'running' && (
                      <Button size="sm" colorScheme="gray" onClick={() => handlePauseCampaign(campaign.id)}>
                        Pause
                      </Button>
                    )}
                    {campaign.status === 'paused' && (
                      <Button size="sm" colorScheme="gray" onClick={() => handleStartCampaign(campaign.id)}>
                        Resume
                      </Button>
                    )}
                    {campaign.status === 'running' && (
                      <Button size="sm" onClick={() => handleCompleteCampaign(campaign.id)}>
                        Complete
                      </Button>
                    )}
                    <IconButton
                      aria-label="Delete"
                      icon={<DeleteIcon />}
                      size="sm"
                      colorScheme="gray"
                      onClick={() => handleDeleteClick(campaign)}
                    />
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Modal isOpen={isWizardOpen} onClose={onWizardClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingCampaignId ? 'Edit Email Campaign' : 'Create Email Campaign'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <CampaignWizard
              key={editingCampaignId ?? 'new-campaign'}
              onSuccess={() => {
                onWizardClose()
                setEditingCampaignId(null)
                fetchCampaigns()
              }}
              onCancel={() => {
                onWizardClose()
                setEditingCampaignId(null)
              }}
              campaignId={editingCampaignId ?? undefined}
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Campaign
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete <strong>{campaignToDelete?.name}</strong>?
              <br />
              <br />
              This will permanently delete:
              <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                <li>The campaign and all its settings</li>
                <li>All email templates</li>
                <li>All prospect data and status</li>
                <li>All email events and tracking data</li>
              </ul>
              <br />
              This action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="gray" onClick={handleDeleteConfirm} ml={3}>
                Delete Campaign
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}
