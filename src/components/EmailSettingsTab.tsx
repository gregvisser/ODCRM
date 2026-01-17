import { useState, useEffect } from 'react'
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
  ModalFooter,
  ModalCloseButton,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
  FormControl,
  FormLabel,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons'
import { api } from '../utils/api'
import { settingsStore } from '../platform'

interface EmailIdentity {
  id: string
  emailAddress: string
  displayName?: string
  isActive: boolean
  dailySendLimit: number
  createdAt: string
}

export default function EmailSettingsTab() {
  const [identities, setIdentities] = useState<EmailIdentity[]>([])
  const [loading, setLoading] = useState(true)
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure()
  const [editingIdentity, setEditingIdentity] = useState<EmailIdentity | null>(null)
  const [dailyLimit, setDailyLimit] = useState(150)
  const toast = useToast()

  useEffect(() => {
    fetchIdentities()
  }, [])

  const fetchIdentities = async () => {
    setLoading(true)
    // Use the same customerId that was used for OAuth connection
    const customerId = settingsStore.getCurrentCustomerId('prod-customer-1')
    const { data, error } = await api.get<EmailIdentity[]>(`/api/outlook/identities?customerId=${customerId}`)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else if (data) {
      setIdentities(data)
    }
    setLoading(false)
  }

  const handleConnectOutlook = () => {
    const customerId = settingsStore.getCurrentCustomerId('prod-customer-1')
    const apiUrl = window.location.hostname.includes('localhost') 
      ? 'http://localhost:3001' 
      : 'https://odcrm-api.onrender.com'
    window.location.href = `${apiUrl}/api/outlook/auth?customerId=${customerId}`
  }

  const handleEdit = (identity: EmailIdentity) => {
    setEditingIdentity(identity)
    setDailyLimit(identity.dailySendLimit)
    onEditOpen()
  }

  const handleSaveEdit = async () => {
    if (!editingIdentity) return

    const { error } = await api.patch(`/api/outlook/identities/${editingIdentity.id}`, {
      dailySendLimit: dailyLimit
    })

    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'Settings updated', status: 'success' })
      onEditClose()
      fetchIdentities()
    }
  }

  const handleDisconnect = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this email account?')) return

    const { error } = await api.delete(`/api/outlook/identities/${id}`)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'Account disconnected', status: 'success' })
      fetchIdentities()
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
      <HStack justify="space-between" mb={6}>
        <Heading size="lg">Email Accounts</Heading>
        <Button leftIcon={<AddIcon />} colorScheme="gray" onClick={handleConnectOutlook}>
          Connect Outlook Account
        </Button>
      </HStack>

      <Alert status="info" mb={6}>
        <AlertIcon />
        <AlertDescription>
          <strong>Deliverability Tips:</strong> Configure SPF, DKIM, and DMARC on your domain. Use multiple real inboxes (2-5) for outbound. Keep daily send limits reasonable (150-200 emails per account).
        </AlertDescription>
      </Alert>

      {identities.length === 0 ? (
        <Box textAlign="center" py={10}>
          <Text color="gray.500" mb={4}>No email accounts connected yet.</Text>
          <Button leftIcon={<AddIcon />} colorScheme="gray" onClick={handleConnectOutlook}>
            Connect Your First Outlook Account
          </Button>
        </Box>
      ) : (
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Email Address</Th>
              <Th>Display Name</Th>
              <Th>Status</Th>
              <Th>Daily Send Limit</Th>
              <Th>Connected</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {identities.map((identity) => (
              <Tr key={identity.id}>
                <Td>{identity.emailAddress}</Td>
                <Td>{identity.displayName || '-'}</Td>
                <Td>
                  <Badge colorScheme={identity.isActive ? 'green' : 'gray'}>
                    {identity.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                <Td>{identity.dailySendLimit}</Td>
                <Td>{new Date(identity.createdAt).toLocaleDateString()}</Td>
                <Td>
                  <HStack spacing={2}>
                    <IconButton
                      aria-label="Edit"
                      icon={<EditIcon />}
                      size="sm"
                      onClick={() => handleEdit(identity)}
                    />
                    <IconButton
                      aria-label="Disconnect"
                      icon={<DeleteIcon />}
                      size="sm"
                      colorScheme="gray"
                      onClick={() => handleDisconnect(identity.id)}
                    />
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Modal isOpen={isEditOpen} onClose={onEditClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Email Account Settings</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Daily Send Limit</FormLabel>
                <NumberInput
                  value={dailyLimit}
                  onChange={(_, val) => setDailyLimit(val || 150)}
                  min={1}
                  max={500}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <Text fontSize="sm" color="gray.500" mt={2}>
                  Recommended: 150-200 emails per day to avoid spam filters
                </Text>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditClose}>
              Cancel
            </Button>
            <Button colorScheme="gray" onClick={handleSaveEdit}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
