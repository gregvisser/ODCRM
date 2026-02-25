/**
 * Customers/Clients Management Component
 * Ported from OpensDoorsV2 clients/ui.tsx
 * Adapted to Chakra UI
 */

import { useCallback, useEffect, useRef, useState } from 'react'
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
  Textarea,
  useToast,
  Spinner,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Collapse,
  Grid,
  GridItem,
  Divider,
  FormErrorMessage,
  Switch,
  Tooltip,
} from '@chakra-ui/react'
import { AddIcon, EditIcon, DeleteIcon, ChevronDownIcon, ChevronRightIcon, RepeatIcon, WarningIcon } from '@chakra-ui/icons'
import { api } from '../utils/api'
import { normalizeCustomersListResponse } from '../utils/normalizeApiResponse'
import { GoogleSheetLink } from './links/GoogleSheetLink'

type CustomerContact = {
  id: string
  customerId: string
  name: string
  email?: string | null
  phone?: string | null
  title?: string | null
  isPrimary: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
}

type Customer = {
  id: string
  name: string
  domain?: string | null
  leadsReportingUrl?: string | null
  leadsGoogleSheetLabel?: string | null
  sector?: string | null
  clientStatus: string
  targetJobTitle?: string | null
  prospectingLocation?: string | null
  monthlyIntakeGBP?: string | null
  monthlyRevenueFromCustomer?: string | null
  defcon?: number | null
  weeklyLeadTarget?: number | null
  weeklyLeadActual?: number | null
  monthlyLeadTarget?: number | null
  monthlyLeadActual?: number | null
  // Archive fields
  isArchived?: boolean
  archivedAt?: string | null
  archivedByEmail?: string | null
  createdAt: string
  updatedAt: string
  customerContacts: CustomerContact[]
}

type FormState = {
  id?: string
  name: string
  domain: string
  leadsReportingUrl: string
  leadsGoogleSheetLabel: string
  sector: string
  clientStatus: string
  targetJobTitle: string
  prospectingLocation: string
  monthlyIntakeGBP: string
  defcon: string
  weeklyLeadTarget: string
  weeklyLeadActual: string
  monthlyLeadTarget: string
  monthlyLeadActual: string
}

function emptyForm(): FormState {
  return {
    name: '',
    domain: '',
    leadsReportingUrl: '',
    leadsGoogleSheetLabel: '',
    sector: '',
    clientStatus: 'active',
    targetJobTitle: '',
    prospectingLocation: '',
    monthlyIntakeGBP: '',
    defcon: '',
    weeklyLeadTarget: '',
    weeklyLeadActual: '',
    monthlyLeadTarget: '',
    monthlyLeadActual: '',
  }
}

function toForm(c: Customer): FormState {
  return {
    id: c.id,
    name: c.name,
    domain: c.domain || '',
    leadsReportingUrl: c.leadsReportingUrl || '',
    leadsGoogleSheetLabel: c.leadsGoogleSheetLabel || '',
    sector: c.sector || '',
    clientStatus: c.clientStatus || 'active',
    targetJobTitle: c.targetJobTitle || '',
    prospectingLocation: c.prospectingLocation || '',
    monthlyIntakeGBP: c.monthlyIntakeGBP || '',
    defcon: c.defcon?.toString() || '',
    weeklyLeadTarget: c.weeklyLeadTarget?.toString() || '',
    weeklyLeadActual: c.weeklyLeadActual?.toString() || '',
    monthlyLeadTarget: c.monthlyLeadTarget?.toString() || '',
    monthlyLeadActual: c.monthlyLeadActual?.toString() || '',
  }
}

export default function CustomersManagementTab() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  
  // Admin controls state
  const [showArchived, setShowArchived] = useState(false)
  const [archivingAll, setArchivingAll] = useState(false)
  const [unarchiving, setUnarchiving] = useState<string | null>(null)

  const { isOpen: isFormOpen, onOpen: onFormOpen, onClose: onFormClose } = useDisclosure()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()
  const { isOpen: isArchiveAllOpen, onOpen: onArchiveAllOpen, onClose: onArchiveAllClose } = useDisclosure()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const archiveAllCancelRef = useRef<HTMLButtonElement>(null)
  const toast = useToast()

  const isEditing = !!form.id

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    const url = showArchived ? '/api/customers?includeArchived=true' : '/api/customers'
    const { data, error } = await api.get(url)
    
    if (error) {
      toast({
        title: 'Error loading customers',
        description: error,
        status: 'error',
        duration: 5000,
      })
      setCustomers([])
      setLoading(false)
      return
    }
    
    try {
      // Use canonical normalizer - throws on unexpected shape
      const customersArray = normalizeCustomersListResponse(data) as Customer[]
      setCustomers(customersArray)
    } catch (err: any) {
      console.error('❌ Failed to normalize customers response:', err)
      toast({
        title: 'Error parsing customers',
        description: err.message || 'Unexpected API response format',
        status: 'error',
        duration: 5000,
      })
      setCustomers([])
    }
    
    setLoading(false)
  }, [toast, showArchived])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const handleCreate = () => {
    setForm(emptyForm())
    onFormOpen()
  }

  const handleEdit = (customer: Customer) => {
    setForm(toForm(customer))
    onFormOpen()
  }

  const handleSave = async () => {
    const payload = {
      name: form.name,
      domain: form.domain || null,
      leadsReportingUrl: form.leadsReportingUrl || null,
      leadsGoogleSheetLabel: form.leadsGoogleSheetLabel || null,
      sector: form.sector || null,
      clientStatus: form.clientStatus,
      targetJobTitle: form.targetJobTitle || null,
      prospectingLocation: form.prospectingLocation || null,
      monthlyIntakeGBP: form.monthlyIntakeGBP ? parseFloat(form.monthlyIntakeGBP) : null,
      defcon: form.defcon ? parseInt(form.defcon, 10) : null,
      weeklyLeadTarget: form.weeklyLeadTarget ? parseInt(form.weeklyLeadTarget, 10) : null,
      weeklyLeadActual: form.weeklyLeadActual ? parseInt(form.weeklyLeadActual, 10) : null,
      monthlyLeadTarget: form.monthlyLeadTarget ? parseInt(form.monthlyLeadTarget, 10) : null,
      monthlyLeadActual: form.monthlyLeadActual ? parseInt(form.monthlyLeadActual, 10) : null,
    }

    if (payload.leadsReportingUrl && !payload.leadsGoogleSheetLabel) {
      toast({
        title: 'Google Sheet label required',
        description: 'Please set a label for the Google Sheet (we display labels, not raw URLs).',
        status: 'error',
        duration: 5000,
      })
      return
    }

    const { error } = isEditing
      ? await api.put(`/api/customers/${form.id}`, payload)
      : await api.post('/api/customers', payload)

    if (error) {
      toast({
        title: 'Error',
        description: error,
        status: 'error',
      })
    } else {
      toast({
        title: 'Success',
        description: isEditing ? 'Client updated' : 'Client created',
        status: 'success',
      })
      onFormClose()
      fetchCustomers()
    }
  }

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer)
    onDeleteOpen()
  }

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return

    const { error } = await api.delete(`/api/customers/${customerToDelete.id}`)

    if (error) {
      toast({
        title: 'Error archiving customer',
        description: error,
        status: 'error',
        duration: 5000,
      })
    } else {
      toast({
        title: 'Client Archived',
        description: `"${customerToDelete.name}" has been archived. All data preserved.`,
        status: 'success',
        duration: 3000,
      })
      onDeleteClose()
      fetchCustomers()
    }
    setCustomerToDelete(null)
  }

  const toggleExpanded = (customerId: string) => {
    setExpandedCustomer(expandedCustomer === customerId ? null : customerId)
  }

  // Admin: Archive all customers (clean slate)
  const handleArchiveAll = async () => {
    setArchivingAll(true)
    const { data, error } = await api.post('/api/customers/archive-all', {})
    
    if (error) {
      toast({
        title: 'Error archiving customers',
        description: error,
        status: 'error',
        duration: 5000,
      })
    } else {
      toast({
        title: 'Clean Slate Complete',
        description: `Successfully archived ${data.archived} customers. All data preserved.`,
        status: 'success',
        duration: 5000,
      })
      onArchiveAllClose()
      fetchCustomers()
    }
    setArchivingAll(false)
  }

  // Admin: Unarchive a single customer
  const handleUnarchive = async (customerId: string, customerName: string) => {
    setUnarchiving(customerId)
    const { error } = await api.post(`/api/customers/${customerId}/unarchive`, {})
    
    if (error) {
      toast({
        title: 'Error restoring customer',
        description: error,
        status: 'error',
        duration: 5000,
      })
    } else {
      toast({
        title: 'Customer Restored',
        description: `"${customerName}" has been unarchived and is now active.`,
        status: 'success',
        duration: 3000,
      })
      fetchCustomers()
    }
    setUnarchiving(null)
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
      </Box>
    )
  }

  // Count active vs archived
  const activeCount = customers.filter(c => !c.isArchived).length
  const archivedCount = customers.filter(c => c.isArchived).length

  return (
    <Box>
      <HStack justify="space-between" mb={4} flexWrap="wrap" gap={4}>
        <Box>
          <Heading size="lg">Clients</Heading>
          <Text fontSize="sm" color="gray.600">
            Manage your client companies and their key contacts
          </Text>
        </Box>
        <HStack spacing={4}>
          <Button leftIcon={<AddIcon />} colorScheme="teal" onClick={handleCreate}>
            New Client
          </Button>
        </HStack>
      </HStack>

      {/* Admin Controls Section */}
      <Box 
        bg="gray.50" 
        borderRadius="lg" 
        border="1px solid" 
        borderColor="gray.200" 
        p={4} 
        mb={4}
      >
        <HStack justify="space-between" flexWrap="wrap" gap={4}>
          <HStack spacing={6}>
            <HStack>
              <Text fontSize="sm" fontWeight="medium" color="gray.600">
                Show Archived:
              </Text>
              <Switch 
                isChecked={showArchived} 
                onChange={(e) => setShowArchived(e.target.checked)}
                colorScheme="purple"
              />
              {showArchived && archivedCount > 0 && (
                <Badge colorScheme="purple" ml={2}>
                  {archivedCount} archived
                </Badge>
              )}
            </HStack>
            <Text fontSize="sm" color="gray.500">
              {activeCount} active customer{activeCount !== 1 ? 's' : ''}
            </Text>
          </HStack>
          
          <Tooltip 
            label="Archive all clients for a clean slate. All data (contacts, sequences, campaigns) will be preserved." 
            placement="top"
          >
            <Button 
              size="sm" 
              colorScheme="orange" 
              variant="outline"
              leftIcon={<WarningIcon />}
              onClick={onArchiveAllOpen}
              isDisabled={activeCount === 0}
            >
              Archive All (Clean Slate)
            </Button>
          </Tooltip>
        </HStack>
      </Box>

      <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
        <Table size="sm">
          <Thead bg="gray.50">
            <Tr>
              <Th w="40px"></Th>
              <Th>Name</Th>
              <Th>Domain</Th>
              <Th>Status</Th>
              <Th>Sector</Th>
              <Th>DEFCON</Th>
              <Th>Contacts</Th>
              {showArchived && <Th>Archived</Th>}
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {customers.length === 0 ? (
              <Tr>
                <Td colSpan={showArchived ? 9 : 8} textAlign="center" py={8}>
                  <Text color="gray.500">
                    {showArchived 
? 'No clients found (including archived).'
                      : 'No clients yet. Create your first client to get started.'}
                  </Text>
                </Td>
              </Tr>
            ) : (
              customers.map((customer) => (
                <>
                  <Tr 
                    key={customer.id} 
                    _hover={{ bg: 'gray.50' }}
                    opacity={customer.isArchived ? 0.6 : 1}
                    bg={customer.isArchived ? 'gray.50' : 'white'}
                  >
                    <Td>
                      <IconButton
                        aria-label="Expand"
                        icon={expandedCustomer === customer.id ? <ChevronDownIcon /> : <ChevronRightIcon />}
                        size="xs"
                        variant="ghost"
                        onClick={() => toggleExpanded(customer.id)}
                      />
                    </Td>
                    <Td fontWeight="medium">
                      <HStack>
                        <Text>{customer.name}</Text>
                        {customer.isArchived && (
                          <Badge colorScheme="purple" size="sm">Archived</Badge>
                        )}
                      </HStack>
                    </Td>
                    <Td fontSize="sm" color="gray.600">
                      {customer.domain || '-'}
                    </Td>
                    <Td>
                      <Badge
                        colorScheme={
                          customer.clientStatus === 'active'
                            ? 'green'
                            : customer.clientStatus === 'onboarding'
                              ? 'blue'
                              : customer.clientStatus === 'win_back'
                                ? 'orange'
                                : 'gray'
                        }
                      >
                        {customer.clientStatus}
                      </Badge>
                    </Td>
                    <Td fontSize="sm">{customer.sector || '-'}</Td>
                    <Td>
                      {customer.defcon ? (
                        <Badge colorScheme={customer.defcon <= 2 ? 'red' : customer.defcon <= 4 ? 'yellow' : 'green'}>
                          {customer.defcon}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </Td>
                    <Td>
                      <Badge>{customer.customerContacts.length}</Badge>
                    </Td>
                    {showArchived && (
                      <Td fontSize="xs" color="gray.500">
                        {customer.isArchived && customer.archivedAt 
                          ? new Date(customer.archivedAt).toLocaleDateString('en-GB')
                          : '-'}
                      </Td>
                    )}
                    <Td>
                      <HStack spacing={1}>
                        {customer.isArchived ? (
                          // Archived customer: show Unarchive button
                          <Tooltip label="Restore this client to active">
                            <IconButton
                              aria-label="Unarchive"
                              icon={<RepeatIcon />}
                              size="sm"
                              variant="ghost"
                              colorScheme="green"
                              isLoading={unarchiving === customer.id}
                              onClick={() => handleUnarchive(customer.id, customer.name)}
                            />
                          </Tooltip>
                        ) : (
                          // Active customer: show Edit and Archive buttons
                          <>
                            <IconButton
                              aria-label="Edit"
                              icon={<EditIcon />}
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(customer)}
                            />
                            <Tooltip label="Archive this client (data preserved)">
                              <IconButton
                                aria-label="Archive"
                                icon={<DeleteIcon />}
                                size="sm"
                                variant="ghost"
                                colorScheme="red"
                                onClick={() => handleDeleteClick(customer)}
                              />
                            </Tooltip>
                          </>
                        )}
                      </HStack>
                    </Td>
                  </Tr>
                  {expandedCustomer === customer.id && (
                    <Tr>
                      <Td colSpan={showArchived ? 9 : 8} bg="gray.50" p={4}>
                        <VStack align="stretch" spacing={3}>
                          <Text fontWeight="bold" fontSize="sm">
                            Client Details
                          </Text>
                          <Grid templateColumns="repeat(3, 1fr)" gap={4}>
                            <Box>
                              <Text fontSize="xs" color="gray.600">
                                Target Job Titles
                              </Text>
                              <Text fontSize="sm">{customer.targetJobTitle || 'Not set'}</Text>
                            </Box>
                            <Box>
                              <Text fontSize="xs" color="gray.600">
                                Prospecting Location
                              </Text>
                              <Text fontSize="sm">{customer.prospectingLocation || 'Not set'}</Text>
                            </Box>
                            <Box>
                              <Text fontSize="xs" color="gray.600">
                                Monthly Intake
                              </Text>
                              <Text fontSize="sm">
                                {customer.monthlyIntakeGBP ? `£${customer.monthlyIntakeGBP}` : 'Not set'}
                              </Text>
                            </Box>
                            <Box>
                              <Text fontSize="xs" color="gray.600">
                                Monthly Revenue
                              </Text>
                              <Text fontSize="sm" fontWeight="medium" color="green.600">
                                {customer.monthlyRevenueFromCustomer ? `£${parseFloat(customer.monthlyRevenueFromCustomer).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Not set'}
                              </Text>
                            </Box>
                            <Box>
                              <Text fontSize="xs" color="gray.600">
                                Weekly Lead Target
                              </Text>
                              <Text fontSize="sm">{customer.weeklyLeadTarget || 'Not set'}</Text>
                            </Box>
                            <Box>
                              <Text fontSize="xs" color="gray.600">
                                Monthly Lead Target
                              </Text>
                              <Text fontSize="sm">{customer.monthlyLeadTarget || 'Not set'}</Text>
                            </Box>
                            <Box>
                              <Text fontSize="xs" color="gray.600">
                                Leads Google Sheet
                              </Text>
                              <GoogleSheetLink
                                url={customer.leadsReportingUrl}
                                label={customer.leadsGoogleSheetLabel}
                                fallbackLabel="Client Lead Sheet"
                              />
                            </Box>
                          </Grid>

                          {customer.customerContacts.length > 0 && (
                            <>
                              <Divider my={2} />
                              <Text fontWeight="bold" fontSize="sm">
                                Client Contacts ({customer.customerContacts.length})
                              </Text>
                              <VStack align="stretch" spacing={2}>
                                {customer.customerContacts.map((contact) => (
                                  <Box key={contact.id} p={2} bg="white" borderRadius="md" border="1px solid" borderColor="gray.200">
                                    <HStack justify="space-between">
                                      <VStack align="start" spacing={0}>
                                        <HStack>
                                          <Text fontSize="sm" fontWeight="medium">
                                            {contact.name}
                                          </Text>
                                          {contact.isPrimary && (
                                            <Badge colorScheme="purple" size="sm">
                                              Primary
                                            </Badge>
                                          )}
                                        </HStack>
                                        <Text fontSize="xs" color="gray.600">
                                          {contact.title || 'No title'}
                                        </Text>
                                        <HStack fontSize="xs" color="gray.500">
                                          {contact.email && <Text>{contact.email}</Text>}
                                          {contact.phone && <Text>{contact.phone}</Text>}
                                        </HStack>
                                      </VStack>
                                    </HStack>
                                  </Box>
                                ))}
                              </VStack>
                            </>
                          )}
                        </VStack>
                      </Td>
                    </Tr>
                  )}
                </>
              ))
            )}
          </Tbody>
        </Table>
      </Box>

      {/* Create/Edit Client Modal */}
      <Modal isOpen={isFormOpen} onClose={onFormClose} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{isEditing ? 'Edit Client' : 'Create Client'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {/* Basic Info */}
              <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">
                Basic Info
              </Text>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Client Name</FormLabel>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Tech Solutions Ltd"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Domain</FormLabel>
                  <Input
                    value={form.domain}
                    onChange={(e) => setForm({ ...form, domain: e.target.value })}
                    placeholder="techsolutions.com"
                  />
                </FormControl>
              </Grid>

              {/* Business Details */}
              <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" mt={2}>
                Business Details
              </Text>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <FormControl>
                  <FormLabel fontSize="sm">Sector / Industry</FormLabel>
                  <Input
                    value={form.sector}
                    onChange={(e) => setForm({ ...form, sector: e.target.value })}
                    placeholder="Technology, Finance..."
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Client Status</FormLabel>
                  <Select value={form.clientStatus} onChange={(e) => setForm({ ...form, clientStatus: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="win_back">Win Back</option>
                  </Select>
                </FormControl>
              </Grid>

              {/* Targeting */}
              <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" mt={2}>
                Targeting
              </Text>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <FormControl>
                  <FormLabel fontSize="sm">Target Job Titles</FormLabel>
                  <Input
                    value={form.targetJobTitle}
                    onChange={(e) => setForm({ ...form, targetJobTitle: e.target.value })}
                    placeholder="CMO, Head of Marketing..."
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Prospecting Location</FormLabel>
                  <Input
                    value={form.prospectingLocation}
                    onChange={(e) => setForm({ ...form, prospectingLocation: e.target.value })}
                    placeholder="UK, London, Manchester..."
                  />
                </FormControl>
              </Grid>

              {/* Performance */}
              <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" mt={2}>
                Performance & Targets
              </Text>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <FormControl>
                  <FormLabel fontSize="sm">Monthly Intake (£)</FormLabel>
                  <Input
                    type="number"
                    value={form.monthlyIntakeGBP}
                    onChange={(e) => setForm({ ...form, monthlyIntakeGBP: e.target.value })}
                    placeholder="5000"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">DEFCON Level (1-6)</FormLabel>
                  <Select value={form.defcon} onChange={(e) => setForm({ ...form, defcon: e.target.value })}>
                    <option value="">Not Set</option>
                    <option value="1">1 - Very Dissatisfied</option>
                    <option value="2">2 - Dissatisfied</option>
                    <option value="3">3 - Neutral</option>
                    <option value="4">4 - Satisfied</option>
                    <option value="5">5 - Very Satisfied</option>
                    <option value="6">6 - Extremely Satisfied</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Weekly Lead Target</FormLabel>
                  <Input
                    type="number"
                    value={form.weeklyLeadTarget}
                    onChange={(e) => setForm({ ...form, weeklyLeadTarget: e.target.value })}
                    placeholder="20"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Monthly Lead Target</FormLabel>
                  <Input
                    type="number"
                    value={form.monthlyLeadTarget}
                    onChange={(e) => setForm({ ...form, monthlyLeadTarget: e.target.value })}
                    placeholder="80"
                  />
                </FormControl>
              </Grid>

              <FormControl mt={2}>
                <FormLabel fontSize="sm">Leads Google Sheet URL</FormLabel>
                <Input
                  value={form.leadsReportingUrl}
                  onChange={(e) => setForm({ ...form, leadsReportingUrl: e.target.value })}
                  placeholder="https://docs.google.com/spreadsheets/..."
                />
              </FormControl>
              <FormControl mt={2}>
                <FormLabel fontSize="sm">Leads Google Sheet Label</FormLabel>
                <Input
                  value={form.leadsGoogleSheetLabel}
                  onChange={(e) => setForm({ ...form, leadsGoogleSheetLabel: e.target.value })}
                  placeholder="e.g. Customer Lead Sheet"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onFormClose}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={handleSave}>
              {isEditing ? 'Update' : 'Create'} Client
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Archive Confirmation Dialog */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Archive Client</AlertDialogHeader>
            <AlertDialogBody>
              <VStack align="start" spacing={3}>
                <Text>
                  Are you sure you want to archive "{customerToDelete?.name}"?
                </Text>
                <Box bg="green.50" p={3} borderRadius="md" border="1px solid" borderColor="green.200">
                  <Text fontSize="sm" color="green.700" fontWeight="medium">
                    Data Preservation Notice:
                  </Text>
                  <Text fontSize="sm" color="green.600" mt={1}>
                    All contacts, campaigns, sequences, and analytics data will be preserved. 
                    You can restore this customer at any time by enabling "Show Archived" and clicking Unarchive.
                  </Text>
                </Box>
              </VStack>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="orange" onClick={handleDeleteConfirm} ml={3}>
                Archive Client
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Archive All Confirmation Dialog */}
      <AlertDialog isOpen={isArchiveAllOpen} leastDestructiveRef={archiveAllCancelRef} onClose={onArchiveAllClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>
              <HStack>
                <WarningIcon color="orange.500" />
                <Text>Archive All Clients</Text>
              </HStack>
            </AlertDialogHeader>
            <AlertDialogBody>
              <VStack align="start" spacing={4}>
                <Text>
                  You are about to archive <strong>{activeCount}</strong> active customer{activeCount !== 1 ? 's' : ''}.
                </Text>
                <Box bg="orange.50" p={3} borderRadius="md" border="1px solid" borderColor="orange.200" w="100%">
                  <Text fontSize="sm" color="orange.700" fontWeight="medium">
                    This is a "Clean Slate" operation:
                  </Text>
                  <VStack align="start" spacing={1} mt={2}>
                    <Text fontSize="sm" color="orange.600">
                      • All customers will be hidden from default lists
                    </Text>
                    <Text fontSize="sm" color="orange.600">
                      • All contacts, sequences, and campaigns are preserved
                    </Text>
                    <Text fontSize="sm" color="orange.600">
                      • Historical analytics data remains intact
                    </Text>
                    <Text fontSize="sm" color="orange.600">
                      • Clients can be restored individually at any time
                    </Text>
                  </VStack>
                </Box>
                <Text fontSize="sm" color="gray.600">
                  To view or restore archived customers, enable "Show Archived" toggle.
                </Text>
              </VStack>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={archiveAllCancelRef} onClick={onArchiveAllClose}>
                Cancel
              </Button>
              <Button 
                colorScheme="orange" 
                onClick={handleArchiveAll} 
                ml={3}
                isLoading={archivingAll}
                loadingText="Archiving..."
              >
                Archive All Clients
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}
