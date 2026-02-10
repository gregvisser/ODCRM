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
} from '@chakra-ui/react'
import { AddIcon, EditIcon, DeleteIcon, ChevronDownIcon, ChevronRightIcon } from '@chakra-ui/icons'
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

  const { isOpen: isFormOpen, onOpen: onFormOpen, onClose: onFormClose } = useDisclosure()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const toast = useToast()

  const isEditing = !!form.id

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await api.get('/api/customers')
    
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
  }, [toast])

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
        description: isEditing ? 'Customer updated' : 'Customer created',
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
        title: 'Error',
        description: error,
        status: 'error',
        duration: 5000,
      })
    } else {
      toast({
        title: 'Success',
        description: 'Customer deleted',
        status: 'success',
      })
      onDeleteClose()
      fetchCustomers()
    }
    setCustomerToDelete(null)
  }

  const toggleExpanded = (customerId: string) => {
    setExpandedCustomer(expandedCustomer === customerId ? null : customerId)
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
          <Heading size="lg">Customers / Clients</Heading>
          <Text fontSize="sm" color="gray.600">
            Manage your client companies and their key contacts
          </Text>
        </Box>
        <Button leftIcon={<AddIcon />} colorScheme="teal" onClick={handleCreate}>
          New Customer
        </Button>
      </HStack>

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
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {customers.length === 0 ? (
              <Tr>
                <Td colSpan={8} textAlign="center" py={8}>
                  <Text color="gray.500">
                    No customers yet. Create your first customer to get started.
                  </Text>
                </Td>
              </Tr>
            ) : (
              customers.map((customer) => (
                <>
                  <Tr key={customer.id} _hover={{ bg: 'gray.50' }}>
                    <Td>
                      <IconButton
                        aria-label="Expand"
                        icon={expandedCustomer === customer.id ? <ChevronDownIcon /> : <ChevronRightIcon />}
                        size="xs"
                        variant="ghost"
                        onClick={() => toggleExpanded(customer.id)}
                      />
                    </Td>
                    <Td fontWeight="medium">{customer.name}</Td>
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
                    <Td>
                      <HStack spacing={1}>
                        <IconButton
                          aria-label="Edit"
                          icon={<EditIcon />}
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(customer)}
                        />
                        <IconButton
                          aria-label="Delete"
                          icon={<DeleteIcon />}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => handleDeleteClick(customer)}
                        />
                      </HStack>
                    </Td>
                  </Tr>
                  {expandedCustomer === customer.id && (
                    <Tr>
                      <Td colSpan={8} bg="gray.50" p={4}>
                        <VStack align="stretch" spacing={3}>
                          <Text fontWeight="bold" fontSize="sm">
                            Customer Details
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
                                fallbackLabel="Customer Lead Sheet"
                              />
                            </Box>
                          </Grid>

                          {customer.customerContacts.length > 0 && (
                            <>
                              <Divider my={2} />
                              <Text fontWeight="bold" fontSize="sm">
                                Customer Contacts ({customer.customerContacts.length})
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

      {/* Create/Edit Customer Modal */}
      <Modal isOpen={isFormOpen} onClose={onFormClose} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{isEditing ? 'Edit Customer' : 'Create Customer'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {/* Basic Info */}
              <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">
                Basic Info
              </Text>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Customer Name</FormLabel>
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
              {isEditing ? 'Update' : 'Create'} Customer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete Customer</AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete "{customerToDelete?.name}"? This will also delete all associated
              contacts, campaigns, sequences, and lists. This cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteConfirm} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}
