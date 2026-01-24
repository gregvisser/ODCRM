import React, { useState } from 'react'
import {
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
} from '@chakra-ui/react'
import {
  AddIcon,
  SearchIcon,
  ChevronDownIcon,
  EditIcon,
  DeleteIcon,
  ViewIcon,
  AtSignIcon,
  EmailIcon,
  PhoneIcon,
  StarIcon,
  CheckCircleIcon,
  WarningIcon,
  TimeIcon,
} from '@chakra-ui/icons'

// Mock data - in real implementation, this would come from API
const mockContacts = [
  {
    id: '1',
    email: 'john.smith@techcorp.com',
    firstName: 'John',
    lastName: 'Smith',
    jobTitle: 'CTO',
    companyName: 'TechCorp Inc',
    status: 'active',
    openRate: 85,
    clickRate: 25,
    replyRate: 8,
    lastContacted: '2 days ago',
    totalEmails: 12,
    source: 'manual',
  },
  {
    id: '2',
    email: 'sarah.jones@startup.io',
    firstName: 'Sarah',
    lastName: 'Jones',
    jobTitle: 'VP Engineering',
    companyName: 'Startup.io',
    status: 'active',
    openRate: 92,
    clickRate: 15,
    replyRate: 3,
    lastContacted: '1 week ago',
    totalEmails: 8,
    source: 'csv_import',
  },
  {
    id: '3',
    email: 'mike.wilson@unsubscribed.com',
    firstName: 'Mike',
    lastName: 'Wilson',
    jobTitle: 'CEO',
    companyName: 'Wilson Enterprises',
    status: 'unsubscribed',
    openRate: 0,
    clickRate: 0,
    replyRate: 0,
    lastContacted: '3 months ago',
    totalEmails: 5,
    source: 'manual',
  },
]

const PeopleTab: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const { isOpen, onOpen, onClose } = useDisclosure()

  const filteredContacts = mockContacts.filter(contact => {
    const matchesSearch =
      contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.companyName?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || contact.status === statusFilter

    return matchesSearch && matchesStatus
  })

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
                <StatNumber>33,519</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Active Contacts</StatLabel>
                <StatNumber>32,514</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Avg Open Rate</StatLabel>
                <StatNumber>28.5%</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Avg Reply Rate</StatLabel>
                <StatNumber>3.2%</StatNumber>
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
                  <option value="all">All Contacts (33,519)</option>
                  <option value="active">Active (32,514)</option>
                  <option value="opened">Opened (10,239)</option>
                  <option value="replied">Replied (213)</option>
                  <option value="bounced">Bounced (192)</option>
                  <option value="unsubscribed">Opted Out (10)</option>
                  <option value="to_call">To Call (0)</option>
                  <option value="clicked">Clicked (0)</option>
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
                  <Th isNumeric>Open Rate</Th>
                  <Th isNumeric>Reply Rate</Th>
                  <Th>Last Contacted</Th>
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
                          <HStack spacing={1}>
                            <Icon as={EmailIcon} boxSize={3} color="gray.400" />
                            <Text fontSize="sm" color="blue.600">
                              {contact.email}
                            </Text>
                          </HStack>
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
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text fontWeight="medium">{contact.openRate}%</Text>
                        <Text fontSize="xs" color="gray.500">
                          {Math.round(contact.totalEmails * contact.openRate / 100)}/{contact.totalEmails}
                        </Text>
                      </VStack>
                    </Td>
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text fontWeight="medium">{contact.replyRate}%</Text>
                        <Text fontSize="xs" color="gray.500">
                          {Math.round(contact.totalEmails * contact.replyRate / 100)}/{contact.totalEmails}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <Text fontSize="sm" color="gray.600">{contact.lastContacted}</Text>
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
                          <MenuItem icon={<DeleteIcon />} color="red.500">Delete</MenuItem>
                        </MenuList>
                      </Menu>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
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
                  <Input placeholder="John" />
                </FormControl>
                <FormControl>
                  <FormLabel>Last Name</FormLabel>
                  <Input placeholder="Smith" />
                </FormControl>
              </SimpleGrid>

              <FormControl isRequired>
                <FormLabel>Email Address</FormLabel>
                <Input type="email" placeholder="john@company.com" />
              </FormControl>

              <SimpleGrid columns={2} spacing={4}>
                <FormControl>
                  <FormLabel>Job Title</FormLabel>
                  <Input placeholder="CTO" />
                </FormControl>
                <FormControl>
                  <FormLabel>Company</FormLabel>
                  <Input placeholder="TechCorp Inc" />
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={2} spacing={4}>
                <FormControl>
                  <FormLabel>Phone</FormLabel>
                  <Input placeholder="+1 (555) 123-4567" />
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

              <SimpleGrid columns={3} spacing={4}>
                <FormControl>
                  <FormLabel>Country</FormLabel>
                  <Input placeholder="United States" />
                </FormControl>
                <FormControl>
                  <FormLabel>State</FormLabel>
                  <Input placeholder="California" />
                </FormControl>
                <FormControl>
                  <FormLabel>City</FormLabel>
                  <Input placeholder="San Francisco" />
                </FormControl>
              </SimpleGrid>

              <Flex justify="flex-end" pt={4}>
                <Button variant="ghost" mr={3} onClick={onClose}>
                  Cancel
                </Button>
                <Button colorScheme="blue" onClick={onClose}>
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