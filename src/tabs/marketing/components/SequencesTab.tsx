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
  Switch,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Badge,
  Progress,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
} from '@chakra-ui/react'
import {
  AddIcon,
  SearchIcon,
  ChevronDownIcon,
  EditIcon,
  DeleteIcon,
  ViewIcon,
  RepeatIcon,
  TimeIcon,
  CheckCircleIcon,
  WarningIcon,
} from '@chakra-ui/icons'

// Mock data - in real implementation, this would come from API
const mockSequences = [
  {
    id: '1',
    name: 'Welcome Sequence',
    status: 'active',
    people: 1250,
    openRate: 28.5,
    replyRate: 3.2,
    progress: 75,
    owner: 'Greg Visser',
    deliveries: 950,
    lastActivity: '2 hours ago',
  },
  {
    id: '2',
    name: 'Product Demo Follow-up',
    status: 'active',
    people: 543,
    openRate: 31.2,
    replyRate: 4.1,
    progress: 45,
    owner: 'Greg Visser',
    deliveries: 320,
    lastActivity: '1 hour ago',
  },
  {
    id: '3',
    name: 'Newsletter Signup',
    status: 'paused',
    people: 2100,
    openRate: 22.8,
    replyRate: 1.8,
    progress: 90,
    owner: 'Greg Visser',
    deliveries: 1800,
    lastActivity: '3 days ago',
  },
]

const SequencesTab: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const { isOpen, onOpen, onClose } = useDisclosure()

  const filteredSequences = mockSequences.filter(sequence => {
    const matchesSearch = sequence.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || sequence.status === statusFilter
    const matchesOwner = ownerFilter === 'all' || sequence.owner === ownerFilter
    return matchesSearch && matchesStatus && matchesOwner
  })

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex align="center" justify="space-between">
          <Box>
            <Heading size="lg" mb={2}>Email Sequences</Heading>
            <Text color="gray.600">
              Create and manage automated multi-step email campaigns
            </Text>
          </Box>
          <Button leftIcon={<AddIcon />} colorScheme="blue" size="lg" onClick={onOpen}>
            Create Sequence
          </Button>
        </Flex>

        {/* Filters and Search */}
        <Card>
          <CardBody>
            <Grid templateColumns={{ base: '1fr', md: '1fr 1fr 1fr 2fr' }} gap={4} alignItems="center">
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Status</Text>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} size="sm">
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="draft">Draft</option>
                  <option value="stopped">Stopped</option>
                </Select>
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Owner</Text>
                <Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} size="sm">
                  <option value="all">All Owners</option>
                  <option value="Greg Visser">Greg Visser</option>
                </Select>
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Sort By</Text>
                <Select size="sm">
                  <option value="name">Name</option>
                  <option value="created">Created Date</option>
                  <option value="performance">Performance</option>
                  <option value="people">People Count</option>
                </Select>
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Search</Text>
                <InputGroup size="sm">
                  <InputLeftElement>
                    <Icon as={SearchIcon} color="gray.400" />
                  </InputLeftElement>
                  <Input
                    placeholder="Search sequences..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </InputGroup>
              </Box>
            </Grid>
          </CardBody>
        </Card>

        {/* Sequences Table */}
        <Card>
          <CardBody p={0}>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Status</Th>
                  <Th isNumeric>People</Th>
                  <Th isNumeric>Open Rate</Th>
                  <Th isNumeric>Reply Rate</Th>
                  <Th>Progress</Th>
                  <Th>Owner</Th>
                  <Th>Deliveries</Th>
                  <Th>Last Activity</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredSequences.map((sequence) => (
                  <Tr key={sequence.id}>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="medium">{sequence.name}</Text>
                        <Text fontSize="xs" color="gray.500">ID: {sequence.id}</Text>
                      </VStack>
                    </Td>
                    <Td>
                      <HStack>
                        <Switch
                          colorScheme="green"
                          isChecked={sequence.status === 'active'}
                          size="sm"
                        />
                        <Badge
                          colorScheme={
                            sequence.status === 'active' ? 'green' :
                            sequence.status === 'paused' ? 'orange' : 'gray'
                          }
                          size="sm"
                        >
                          {sequence.status}
                        </Badge>
                      </HStack>
                    </Td>
                    <Td isNumeric>
                      <Text fontWeight="medium">{sequence.people.toLocaleString()}</Text>
                    </Td>
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text fontWeight="medium">{sequence.openRate}%</Text>
                        <Text fontSize="xs" color="gray.500">
                          {Math.round(sequence.people * sequence.openRate / 100)} opens
                        </Text>
                      </VStack>
                    </Td>
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text fontWeight="medium">{sequence.replyRate}%</Text>
                        <Text fontSize="xs" color="gray.500">
                          {Math.round(sequence.people * sequence.replyRate / 100)} replies
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm">{sequence.progress}%</Text>
                        <Progress value={sequence.progress} size="sm" colorScheme="blue" w="60px" />
                      </VStack>
                    </Td>
                    <Td>
                      <Text fontSize="sm">{sequence.owner}</Text>
                    </Td>
                    <Td>
                      <Text fontWeight="medium">{sequence.deliveries.toLocaleString()}</Text>
                    </Td>
                    <Td>
                      <Text fontSize="sm" color="gray.600">{sequence.lastActivity}</Text>
                    </Td>
                    <Td>
                      <Menu>
                        <MenuButton as={IconButton} icon={<ChevronDownIcon />} variant="ghost" size="sm" />
                        <MenuList>
                          <MenuItem icon={<ViewIcon />}>View Details</MenuItem>
                          <MenuItem icon={<EditIcon />}>Edit Sequence</MenuItem>
                          <MenuItem icon={<RepeatIcon />}>Clone Sequence</MenuItem>
                          <MenuItem icon={<TimeIcon />}>View Analytics</MenuItem>
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

        {/* Summary Stats */}
        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Sequences</StatLabel>
                <StatNumber>{mockSequences.length}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Active Sequences</StatLabel>
                <StatNumber>{mockSequences.filter(s => s.status === 'active').length}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total People</StatLabel>
                <StatNumber>{mockSequences.reduce((sum, s) => sum + s.people, 0).toLocaleString()}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Avg Reply Rate</StatLabel>
                <StatNumber>
                  {(mockSequences.reduce((sum, s) => sum + s.replyRate, 0) / mockSequences.length).toFixed(1)}%
                </StatNumber>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>
      </VStack>

      {/* Create Sequence Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Sequence</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text fontWeight="medium" mb={2}>Sequence Name</Text>
                <Input placeholder="Enter sequence name..." />
              </Box>

              <Box>
                <Text fontWeight="medium" mb={2}>Description (Optional)</Text>
                <Input placeholder="Brief description of this sequence..." />
              </Box>

              <Box>
                <Text fontWeight="medium" mb={2}>Goal Type</Text>
                <Select>
                  <option value="replies">Maximize Replies</option>
                  <option value="meetings">Schedule Meetings</option>
                  <option value="sales">Drive Sales</option>
                  <option value="custom">Custom Goal</option>
                </Select>
              </Box>

              <Box>
                <Text fontWeight="medium" mb={2}>Email Account</Text>
                <Select>
                  <option value="">Select sending account...</option>
                  {/* Would be populated from email accounts */}
                </Select>
              </Box>

              <Flex justify="flex-end" pt={4}>
                <Button variant="ghost" mr={3} onClick={onClose}>
                  Cancel
                </Button>
                <Button colorScheme="blue" onClick={onClose}>
                  Create Sequence
                </Button>
              </Flex>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default SequencesTab