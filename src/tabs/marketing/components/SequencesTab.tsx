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
  Progress,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Spinner,
} from '@chakra-ui/react'
import {
  AddIcon,
  SearchIcon,
  ChevronDownIcon,
  EditIcon,
  DeleteIcon,
  ViewIcon,
  TimeIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

type SequenceSummary = {
  id: string
  name: string
  description?: string | null
  stepCount: number
  createdAt: string
  updatedAt: string
}

const SequencesTab: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [sequences, setSequences] = useState<SequenceSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formState, setFormState] = useState({
    name: '',
    description: '',
  })

  const loadSequences = async () => {
    setIsLoading(true)
    setError(null)
    const { data, error: apiError } = await api.get<SequenceSummary[]>('/api/sequences')
    if (apiError) {
      setError(apiError)
      setSequences([])
    } else {
      setSequences(data || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadSequences()
  }, [])

  const filteredSequences = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return sequences
    return sequences.filter((sequence) => sequence.name.toLowerCase().includes(query))
  }, [searchQuery, sequences])

  const totalSteps = useMemo(
    () => sequences.reduce((sum, seq) => sum + (seq.stepCount || 0), 0),
    [sequences],
  )

  const handleCreateSequence = async () => {
    const name = formState.name.trim()
    if (!name) {
      setError('Sequence name is required.')
      return
    }

    setError(null)
    const payload = {
      name,
      description: formState.description.trim() || undefined,
    }
    const { data, error: apiError } = await api.post<SequenceSummary>('/api/sequences', payload)
    if (apiError || !data) {
      setError(apiError || 'Failed to create sequence.')
      return
    }

    setSequences((prev) => [data, ...prev])
    setFormState({ name: '', description: '' })
    onClose()
  }

  const handleDeleteSequence = async (sequence: SequenceSummary) => {
    if (!window.confirm(`Delete "${sequence.name}"? This cannot be undone.`)) return
    const { error: apiError } = await api.delete(`/api/sequences/${sequence.id}`)
    if (apiError) {
      setError(apiError)
      return
    }
    setSequences((prev) => prev.filter((item) => item.id !== sequence.id))
  }

  const formatDate = (value: string) => new Date(value).toLocaleDateString()

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
            <Grid templateColumns={{ base: '1fr', md: '1fr 1fr 2fr' }} gap={4} alignItems="center">
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Sort By</Text>
                <Select size="sm">
                  <option value="updated">Updated Date</option>
                  <option value="created">Created Date</option>
                  <option value="name">Name</option>
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
                  <Th>Name</Th>
                  <Th>Steps</Th>
                  <Th>Created</Th>
                  <Th>Updated</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredSequences.map((sequence) => (
                  <Tr key={sequence.id}>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="medium">{sequence.name}</Text>
                        <Text fontSize="xs" color="gray.500">
                          {sequence.description || 'No description'}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <Badge colorScheme={sequence.stepCount ? 'blue' : 'gray'}>
                        {sequence.stepCount} step{sequence.stepCount === 1 ? '' : 's'}
                      </Badge>
                    </Td>
                    <Td>
                      <Text fontSize="sm">{formatDate(sequence.createdAt)}</Text>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <Icon as={TimeIcon} color="gray.400" boxSize={4} />
                        <Text fontSize="sm" color="gray.600">
                          {formatDate(sequence.updatedAt)}
                        </Text>
                      </HStack>
                    </Td>
                    <Td>
                      <Menu>
                        <MenuButton as={IconButton} icon={<ChevronDownIcon />} variant="ghost" size="sm" />
                        <MenuList>
                          <MenuItem icon={<ViewIcon />}>View Details</MenuItem>
                          <MenuItem icon={<EditIcon />}>Edit Sequence</MenuItem>
                          <MenuItem icon={<TimeIcon />}>View Activity</MenuItem>
                          <MenuItem
                            icon={<DeleteIcon />}
                            color="red.500"
                            onClick={() => handleDeleteSequence(sequence)}
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

        {/* Summary Stats */}
        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Sequences</StatLabel>
                <StatNumber>{sequences.length}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Steps</StatLabel>
                <StatNumber>{totalSteps}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Sequences With Steps</StatLabel>
                <StatNumber>{sequences.filter((s) => s.stepCount > 0).length}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Newest Updated</StatLabel>
                <StatNumber>
                  {sequences[0]?.updatedAt ? formatDate(sequences[0].updatedAt) : '—'}
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
                <Input
                  placeholder="Enter sequence name..."
                  value={formState.name}
                  onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                />
              </Box>

              <Box>
                <Text fontWeight="medium" mb={2}>Description (Optional)</Text>
                <Input
                  placeholder="Brief description of this sequence..."
                  value={formState.description}
                  onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                />
              </Box>

              <Flex justify="flex-end" pt={4}>
                <Button variant="ghost" mr={3} onClick={onClose}>
                  Cancel
                </Button>
                <Button colorScheme="blue" onClick={handleCreateSequence}>
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