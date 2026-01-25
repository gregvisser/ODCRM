import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Select,
  SimpleGrid,
  Spacer,
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
  Avatar,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Spinner,
} from '@chakra-ui/react'
import {
  AddIcon,
  SearchIcon,
  ChevronDownIcon,
  EditIcon,
  DeleteIcon,
  ViewIcon,
  EmailIcon,
  PhoneIcon,
  StarIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

type ContactRecord = {
  id: string
  email: string
  firstName: string
  lastName: string
  jobTitle?: string | null
  companyName: string
  status: 'active' | 'inactive' | 'unsubscribed' | 'bounced'
  source: string
  phone?: string | null
  createdAt: string
}

const PeopleTab: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [contacts, setContacts] = useState<ContactRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formState, setFormState] = useState({
    firstName: '',
    lastName: '',
    email: '',
    jobTitle: '',
    companyName: '',
    phone: '',
  })

  const loadContacts = async () => {
    setIsLoading(true)
    setError(null)
    const { data, error: apiError } = await api.get<ContactRecord[]>('/api/contacts')
    if (apiError) {
      setError(apiError)
      setContacts([])
    } else {
      setContacts(data || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadContacts()
  }, [])

  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return contacts.filter((contact) => {
      const matchesSearch =
        contact.email.toLowerCase().includes(query) ||
        contact.firstName?.toLowerCase().includes(query) ||
        contact.lastName?.toLowerCase().includes(query) ||
        contact.companyName?.toLowerCase().includes(query)

      const matchesStatus = statusFilter === 'all' || contact.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [contacts, searchQuery, statusFilter])

  const handleSelectContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    )
  }

  const handleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id))
    }
  }

  const handleCreateContact = async () => {
    if (!formState.email.trim() || !formState.companyName.trim()) {
      setError('Email and company name are required.')
      return
    }

    const payload = {
      firstName: formState.firstName.trim(),
      lastName: formState.lastName.trim(),
      email: formState.email.trim(),
      jobTitle: formState.jobTitle.trim() || undefined,
      companyName: formState.companyName.trim(),
      phone: formState.phone.trim() || undefined,
      source: 'manual',
    }

    const { data, error: apiError } = await api.post<ContactRecord>('/api/contacts', payload)
    if (apiError || !data) {
      setError(apiError || 'Failed to create contact.')
      return
    }

    setContacts((prev) => [data, ...prev])
    setFormState({
      firstName: '',
      lastName: '',
      email: '',
      jobTitle: '',
      companyName: '',
      phone: '',
    })
    onClose()
  }

  const handleDeleteContact = async (contact: ContactRecord) => {
    if (!window.confirm(`Delete ${contact.firstName || ''} ${contact.lastName || ''}?`)) return
    const { error: apiError } = await api.delete(`/api/contacts/${contact.id}`)
    if (apiError) {
      setError(apiError)
      return
    }
    setContacts((prev) => prev.filter((item) => item.id !== contact.id))
  }

  const statusCounts = useMemo(() => ({
    total: contacts.length,
    active: contacts.filter((c) => c.status === 'active').length,
    unsubscribed: contacts.filter((c) => c.status === 'unsubscribed').length,
    bounced: contacts.filter((c) => c.status === 'bounced').length,
  }), [contacts])

  const formatDate = (value: string) => new Date(value).toLocaleDateString()

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex align="center" justify="space-between">
          <Box>
            <Heading size="lg" mb={2}>People & Contacts</Heading>
            <Text color="gray.600">
              Manage your contact database with rich profiles and activity tracking
            </Text>
          </Box>
          <HStack spacing={3}>
            <Button variant="outline" leftIcon={<AddIcon />}>
              Import CSV
            </Button>
            <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={onOpen}>
              Add Contact
            </Button>
          </HStack>
        </Flex>

        {/* Quick Stats */}
        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Contacts</StatLabel>
                <StatNumber>{statusCounts.total}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Active Contacts</StatLabel>
                <StatNumber>{statusCounts.active}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Unsubscribed</StatLabel>
                <StatNumber>{statusCounts.unsubscribed}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Bounced</StatLabel>
                <StatNumber>{statusCounts.bounced}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Filters and Search */}
        <Card>
          <CardBody>
            <Grid templateColumns={{ base: '1fr', md: '1fr 1fr 2fr' }} gap={4} alignItems="end">
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Status</Text>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} size="sm">
                  <option value="all">All Contacts</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="bounced">Bounced</option>
                  <option value="unsubscribed">Opted Out</option>
                </Select>
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Sort By</Text>
                <Select size="sm">
                  <option value="name">Name</option>
                  <option value="email">Email</option>
                  <option value="company">Company</option>
                  <option value="last_contacted">Last Contacted</option>
                  <option value="open_rate">Open Rate</option>
                </Select>
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Search</Text>
                <InputGroup size="sm">
                  <InputLeftElement>
                    <Icon as={SearchIcon} color="gray.400" />
                  </InputLeftElement>
                  <Input
                    placeholder="Search by name, email, or company..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </InputGroup>
              </Box>
            </Grid>
          </CardBody>
        </Card>

        {/* Bulk Actions */}
        {selectedContacts.length > 0 && (
          <Card bg="blue.50" borderColor="blue.200">
            <CardBody>
              <HStack justify="space-between">
                <Text fontWeight="medium">
                  {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} selected
                </Text>
                <HStack spacing={3}>
                  <Button size="sm" variant="outline">Add to List</Button>
                  <Button size="sm" variant="outline">Export</Button>
                  <Button size="sm" colorScheme="blue">Send Sequence</Button>
                </HStack>
              </HStack>
            </CardBody>
          </Card>
        )}

        {/* Contacts Table */}
        <Card>
          <CardBody p={0}>
            {error && (
              <Alert status="error" borderRadius="md" m={4}>
                <AlertIcon />
                {error}
              </Alert>
            )}
            {isLoading ? (
              <Flex align="center" justify="center" py={16}>
                <Spinner size="lg" />
              </Flex>
            ) : (
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th width="40px">
                    <input
                      type="checkbox"
                      checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                      onChange={handleSelectAll}
                    />
                  </Th>
                  <Th>Contact</Th>
                  <Th>Company</Th>
                  <Th>Status</Th>
                  <Th>Email</Th>
                  <Th>Created</Th>
                  <Th>Source</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredContacts.map((contact) => (
                  <Tr key={contact.id}>
                    <Td>
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(contact.id)}
                        onChange={() => handleSelectContact(contact.id)}
                      />
                    </Td>
                    <Td>
                      <HStack spacing={3}>
                        <Avatar
                          size="sm"
                          name={`${contact.firstName} ${contact.lastName}`}
                          bg={
                            contact.status === 'active' ? 'green.500' :
                            contact.status === 'unsubscribed' ? 'red.500' :
                            contact.status === 'bounced' ? 'orange.500' : 'gray.500'
                          }
                        />
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="medium">
                            {contact.firstName} {contact.lastName}
                          </Text>
                          <Text fontSize="sm" color="gray.600">
                            {contact.jobTitle}
                          </Text>
                        </VStack>
                      </HStack>
                    </Td>
                    <Td>
                      <Text fontWeight="medium">{contact.companyName}</Text>
                    </Td>
                    <Td>
                      <Badge
                        colorScheme={
                          contact.status === 'active' ? 'green' :
                          contact.status === 'unsubscribed' ? 'red' :
                          contact.status === 'bounced' ? 'orange' : 'gray'
                        }
                        size="sm"
                      >
                        {contact.status === 'active' ? 'Active' :
                         contact.status === 'unsubscribed' ? 'Opted Out' :
                         contact.status === 'bounced' ? 'Bounced' :
                         contact.status}
                      </Badge>
                    </Td>
                    <Td>
                      <HStack spacing={1}>
                        <Icon as={EmailIcon} boxSize={3} color="gray.400" />
                        <Text fontSize="sm" color="blue.600">
                          {contact.email}
                        </Text>
                      </HStack>
                    </Td>
                    <Td>
                      <Text fontSize="sm" color="gray.600">{formatDate(contact.createdAt)}</Text>
                    </Td>
                    <Td>
                      <Badge variant="outline" size="sm">
                        {contact.source === 'manual' ? 'Manual' :
                         contact.source === 'csv_import' ? 'CSV Import' : contact.source}
                      </Badge>
                    </Td>
                    <Td>
                      <Menu>
                        <MenuButton as={IconButton} icon={<ChevronDownIcon />} variant="ghost" size="sm" />
                        <MenuList>
                          <MenuItem icon={<ViewIcon />}>View Profile</MenuItem>
                          <MenuItem icon={<EditIcon />}>Edit Contact</MenuItem>
                          <MenuItem icon={<EmailIcon />}>Send Email</MenuItem>
                          <MenuItem icon={<StarIcon />}>Add to Sequence</MenuItem>
                          <MenuItem
                            icon={<DeleteIcon />}
                            color="red.500"
                            onClick={() => handleDeleteContact(contact)}
                          >
                            Delete
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            )}
          </CardBody>
        </Card>
      </VStack>

      {/* Add Contact Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add New Contact</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <SimpleGrid columns={2} spacing={4}>
                <FormControl>
                  <FormLabel>First Name</FormLabel>
                  <Input
                    placeholder="John"
                    value={formState.firstName}
                    onChange={(e) => setFormState((prev) => ({ ...prev, firstName: e.target.value }))}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Last Name</FormLabel>
                  <Input
                    placeholder="Smith"
                    value={formState.lastName}
                    onChange={(e) => setFormState((prev) => ({ ...prev, lastName: e.target.value }))}
                  />
                </FormControl>
              </SimpleGrid>

              <FormControl isRequired>
                <FormLabel>Email Address</FormLabel>
                <Input
                  type="email"
                  placeholder="john@company.com"
                  value={formState.email}
                  onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
                />
              </FormControl>

              <SimpleGrid columns={2} spacing={4}>
                <FormControl>
                  <FormLabel>Job Title</FormLabel>
                  <Input
                    placeholder="CTO"
                    value={formState.jobTitle}
                    onChange={(e) => setFormState((prev) => ({ ...prev, jobTitle: e.target.value }))}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Company</FormLabel>
                  <Input
                    placeholder="TechCorp Inc"
                    value={formState.companyName}
                    onChange={(e) => setFormState((prev) => ({ ...prev, companyName: e.target.value }))}
                  />
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={2} spacing={4}>
                <FormControl>
                  <FormLabel>Phone</FormLabel>
                  <Input
                    placeholder="+1 (555) 123-4567"
                    value={formState.phone}
                    onChange={(e) => setFormState((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Industry</FormLabel>
                  <Select placeholder="Select industry">
                    <option value="technology">Technology</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="finance">Finance</option>
                    <option value="education">Education</option>
                  </Select>
                </FormControl>
              </SimpleGrid>

              <Flex justify="flex-end" pt={4}>
                <Button variant="ghost" mr={3} onClick={onClose}>
                  Cancel
                </Button>
                <Button colorScheme="blue" onClick={handleCreateContact}>
                  Add Contact
                </Button>
              </Flex>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default PeopleTab