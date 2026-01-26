import React, { useEffect, useMemo, useState } from 'react'
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
  Checkbox,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Textarea,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Spacer,
  useToast,
} from '@chakra-ui/react'
import {
  SearchIcon,
  AddIcon,
  DownloadIcon,
  EditIcon,
  DeleteIcon,
  EmailIcon,
  PhoneIcon,
  CheckIcon,
  ChevronDownIcon,
  SettingsIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

type Prospect = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  jobTitle?: string
  companyName: string
  companySize?: string
  industry?: string
  location?: string
  linkedinUrl?: string
  status: 'new' | 'contacted' | 'qualified' | 'unqualified'
  source: 'cognism' | 'manual' | 'imported'
  createdAt: string
  lastUpdated: string
}

type ProspectList = {
  id: string
  name: string
  description?: string
  prospectCount: number
  createdAt: string
}

const CognismProspectsTab: React.FC = () => {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [lists, setLists] = useState<ProspectList[]>([])
  const [selectedProspects, setSelectedProspects] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null)
  const toast = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [prospectsRes, listsRes] = await Promise.all([
        api.get<Prospect[]>('/api/prospects'),
        api.get<ProspectList[]>('/api/prospects/lists')
      ])

      setProspects(prospectsRes.data || mockProspects)
      setLists(listsRes.data || mockLists)
    } catch (error) {
      console.error('Failed to load prospects:', error)
      setProspects(mockProspects)
      setLists(mockLists)
    } finally {
      setLoading(false)
    }
  }

  const filteredProspects = useMemo(() => {
    return prospects.filter(prospect => {
      const matchesSearch = searchQuery === '' ||
        `${prospect.firstName} ${prospect.lastName} ${prospect.email} ${prospect.companyName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || prospect.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [prospects, searchQuery, statusFilter])

  const stats = useMemo(() => {
    return {
      total: prospects.length,
      new: prospects.filter(p => p.status === 'new').length,
      contacted: prospects.filter(p => p.status === 'contacted').length,
      qualified: prospects.filter(p => p.status === 'qualified').length,
    }
  }, [prospects])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProspects(filteredProspects.map(p => p.id))
    } else {
      setSelectedProspects([])
    }
  }

  const handleSelectProspect = (prospectId: string, checked: boolean) => {
    if (checked) {
      setSelectedProspects(prev => [...prev, prospectId])
    } else {
      setSelectedProspects(prev => prev.filter(id => id !== prospectId))
    }
  }

  const handleEditProspect = (prospect: Prospect) => {
    setEditingProspect(prospect)
    onOpen()
  }

  const handleSaveProspect = async () => {
    if (!editingProspect) return

    try {
      await api.put(`/api/prospects/${editingProspect.id}`, editingProspect)
      await loadData()
      onClose()
      toast({
        title: 'Prospect updated',
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Failed to update prospect',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleDeleteProspects = async (prospectIds: string[]) => {
    try {
      await Promise.all(prospectIds.map(id => api.delete(`/api/prospects/${id}`)))
      await loadData()
      setSelectedProspects([])
      toast({
        title: `${prospectIds.length} prospect${prospectIds.length > 1 ? 's' : ''} deleted`,
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Failed to delete prospects',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'blue'
      case 'contacted': return 'yellow'
      case 'qualified': return 'green'
      case 'unqualified': return 'red'
      default: return 'gray'
    }
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Loading prospects...</Text>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Prospects</Heading>
          <Text color="gray.600">
            Manage and organize your prospect database from Cognism and other sources
          </Text>
        </VStack>
        <HStack>
          <Button leftIcon={<AddIcon />} size="sm" variant="outline">
            Import
          </Button>
          <Button leftIcon={<AddIcon />} colorScheme="blue" size="sm">
            Add Prospect
          </Button>
        </HStack>
      </Flex>

      {/* Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Prospects</StatLabel>
              <StatNumber>{stats.total}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>New</StatLabel>
              <StatNumber>{stats.new}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Contacted</StatLabel>
              <StatNumber>{stats.contacted}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Qualified</StatLabel>
              <StatNumber>{stats.qualified}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Controls */}
      <Flex gap={4} mb={6} align="center">
        <InputGroup maxW="300px">
          <InputLeftElement>
            <Icon as={SearchIcon} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search prospects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>

        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          maxW="150px"
        >
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="unqualified">Unqualified</option>
        </Select>

        <Spacer />

        {selectedProspects.length > 0 && (
          <HStack>
            <Text fontSize="sm" color="gray.600">
              {selectedProspects.length} selected
            </Text>
            <Button size="sm" variant="outline" leftIcon={<EmailIcon />}>
              Send Sequence
            </Button>
            <Button
              size="sm"
              variant="outline"
              colorScheme="red"
              leftIcon={<DeleteIcon />}
              onClick={() => handleDeleteProspects(selectedProspects)}
            >
              Delete
            </Button>
          </HStack>
        )}
      </Flex>

      {/* Prospects Table */}
      <Card>
        <CardBody p={0}>
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th w="50px">
                    <Checkbox
                      isChecked={selectedProspects.length === filteredProspects.length && filteredProspects.length > 0}
                      isIndeterminate={selectedProspects.length > 0 && selectedProspects.length < filteredProspects.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </Th>
                  <Th>Name</Th>
                  <Th>Title & Company</Th>
                  <Th>Contact</Th>
                  <Th>Status</Th>
                  <Th>Source</Th>
                  <Th>Added</Th>
                  <Th w="50px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredProspects.map((prospect) => (
                  <Tr key={prospect.id}>
                    <Td>
                      <Checkbox
                        isChecked={selectedProspects.includes(prospect.id)}
                        onChange={(e) => handleSelectProspect(prospect.id, e.target.checked)}
                      />
                    </Td>
                    <Td>
                      <HStack>
                        <Avatar size="sm" name={`${prospect.firstName} ${prospect.lastName}`} />
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="semibold">
                            {prospect.firstName} {prospect.lastName}
                          </Text>
                        </VStack>
                      </HStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" fontWeight="semibold">
                          {prospect.jobTitle || '—'}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {prospect.companyName}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <HStack>
                          <Icon as={EmailIcon} boxSize={3} color="gray.500" />
                          <Text fontSize="sm">{prospect.email}</Text>
                        </HStack>
                        {prospect.phone && (
                          <HStack>
                            <Icon as={PhoneIcon} boxSize={3} color="gray.500" />
                            <Text fontSize="sm">{prospect.phone}</Text>
                          </HStack>
                        )}
                      </VStack>
                    </Td>
                    <Td>
                      <Badge colorScheme={getStatusColor(prospect.status)} size="sm">
                        {prospect.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge variant="outline" size="sm">
                        {prospect.source}
                      </Badge>
                    </Td>
                    <Td>
                      <Text fontSize="xs" color="gray.600">
                        {new Date(prospect.createdAt).toLocaleDateString()}
                      </Text>
                    </Td>
                    <Td>
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          icon={<SettingsIcon />}
                          size="sm"
                          variant="ghost"
                        />
                        <MenuList>
                          <MenuItem icon={<EditIcon />} onClick={() => handleEditProspect(prospect)}>
                            Edit
                          </MenuItem>
                          <MenuItem icon={<EmailIcon />}>
                            Start Sequence
                          </MenuItem>
                          <MenuItem icon={<DeleteIcon />} color="red.500" onClick={() => handleDeleteProspects([prospect.id])}>
                            Delete
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </CardBody>
      </Card>

      {/* Edit Prospect Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Prospect</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {editingProspect && (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>First Name</FormLabel>
                  <Input
                    value={editingProspect.firstName}
                    onChange={(e) => setEditingProspect({...editingProspect, firstName: e.target.value})}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Last Name</FormLabel>
                  <Input
                    value={editingProspect.lastName}
                    onChange={(e) => setEditingProspect({...editingProspect, lastName: e.target.value})}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Email</FormLabel>
                  <Input
                    type="email"
                    value={editingProspect.email}
                    onChange={(e) => setEditingProspect({...editingProspect, email: e.target.value})}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Phone</FormLabel>
                  <Input
                    value={editingProspect.phone || ''}
                    onChange={(e) => setEditingProspect({...editingProspect, phone: e.target.value})}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Job Title</FormLabel>
                  <Input
                    value={editingProspect.jobTitle || ''}
                    onChange={(e) => setEditingProspect({...editingProspect, jobTitle: e.target.value})}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Company</FormLabel>
                  <Input
                    value={editingProspect.companyName}
                    onChange={(e) => setEditingProspect({...editingProspect, companyName: e.target.value})}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={editingProspect.status}
                    onChange={(e) => setEditingProspect({...editingProspect, status: e.target.value as any})}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="unqualified">Unqualified</option>
                  </Select>
                </FormControl>
              </SimpleGrid>
            )}
          </ModalBody>
          <Flex justify="flex-end" p={6} pt={0}>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSaveProspect}>
              Save Changes
            </Button>
          </Flex>
        </ModalContent>
      </Modal>
    </Box>
  )
}

// Mock data for development
const mockProspects: Prospect[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@techcorp.com',
    phone: '+1-555-0123',
    jobTitle: 'CTO',
    companyName: 'TechCorp Inc.',
    companySize: '500-1000',
    industry: 'Technology',
    location: 'San Francisco, CA',
    status: 'new',
    source: 'cognism',
    createdAt: '2024-01-20T10:00:00Z',
    lastUpdated: '2024-01-20T10:00:00Z',
  },
  {
    id: '2',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@startup.io',
    phone: '+1-555-0124',
    jobTitle: 'VP of Engineering',
    companyName: 'Startup.io',
    companySize: '50-100',
    industry: 'SaaS',
    location: 'Austin, TX',
    status: 'contacted',
    source: 'cognism',
    createdAt: '2024-01-19T14:30:00Z',
    lastUpdated: '2024-01-22T09:15:00Z',
  },
  {
    id: '3',
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'm.chen@enterprise.com',
    jobTitle: 'Head of IT',
    companyName: 'Enterprise Corp',
    companySize: '1000-5000',
    industry: 'Finance',
    location: 'New York, NY',
    status: 'qualified',
    source: 'manual',
    createdAt: '2024-01-18T11:20:00Z',
    lastUpdated: '2024-01-24T16:45:00Z',
  },
]

const mockLists: ProspectList[] = [
  {
    id: '1',
    name: 'Tech CTOs',
    description: 'Chief Technology Officers at tech companies',
    prospectCount: 245,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    name: 'Bay Area Prospects',
    description: 'Prospects located in the San Francisco Bay Area',
    prospectCount: 189,
    createdAt: '2024-01-16T14:30:00Z',
  },
]

export default CognismProspectsTab
