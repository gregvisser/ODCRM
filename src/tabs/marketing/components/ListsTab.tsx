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
  MenuDivider,
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
  Spacer,
  Divider,
  useToast,
  Tag,
  TagLabel,
  TagCloseButton,
  Progress,
  Checkbox,
} from '@chakra-ui/react'
import {
  AddIcon,
  SearchIcon,
  EditIcon,
  DeleteIcon,
  DownloadIcon,
  CopyIcon,
  SettingsIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

type ProspectList = {
  id: string
  name: string
  description?: string
  prospectCount: number
  activeProspects: number
  createdAt: string
  updatedAt: string
  tags: string[]
  filters: ListFilter[]
  isDynamic: boolean
}

type ListFilter = {
  field: 'company' | 'jobTitle' | 'industry' | 'location' | 'companySize' | 'status'
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than'
  value: string
}

type Prospect = {
  id: string
  firstName: string
  lastName: string
  email: string
  companyName: string
  jobTitle?: string
  status: 'new' | 'contacted' | 'qualified' | 'unqualified'
}

const ListsTab: React.FC = () => {
  const [lists, setLists] = useState<ProspectList[]>([])
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [selectedLists, setSelectedLists] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isManageOpen, onOpen: onManageOpen, onClose: onManageClose } = useDisclosure()
  const [editingList, setEditingList] = useState<ProspectList | null>(null)
  const [managingList, setManagingList] = useState<ProspectList | null>(null)
  const [availableProspects, setAvailableProspects] = useState<Prospect[]>([])
  const toast = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [listsRes, prospectsRes] = await Promise.all([
        api.get<ProspectList[]>('/api/lists'),
        api.get<Prospect[]>('/api/prospects')
      ])

      setLists(listsRes.data || mockLists)
      setProspects(prospectsRes.data || mockProspects)
    } catch (error) {
      console.error('Failed to load lists:', error)
      setLists(mockLists)
      setProspects(mockProspects)
    } finally {
      setLoading(false)
    }
  }

  const filteredLists = useMemo(() => {
    return lists.filter(list =>
      searchQuery === '' ||
      list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      list.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [lists, searchQuery])

  const stats = useMemo(() => {
    return {
      totalLists: lists.length,
      totalProspects: lists.reduce((sum, list) => sum + list.prospectCount, 0),
      activeProspects: lists.reduce((sum, list) => sum + list.activeProspects, 0),
      dynamicLists: lists.filter(l => l.isDynamic).length,
      staticLists: lists.filter(l => !l.isDynamic).length,
    }
  }, [lists])

  const handleCreateList = () => {
    setEditingList({
      id: '',
      name: '',
      description: '',
      prospectCount: 0,
      activeProspects: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      filters: [],
      isDynamic: false,
    })
    onOpen()
  }

  const handleEditList = (list: ProspectList) => {
    setEditingList(list)
    onOpen()
  }

  const handleSaveList = async () => {
    if (!editingList) return

    try {
      if (editingList.id) {
        await api.put(`/api/lists/${editingList.id}`, editingList)
      } else {
        const res = await api.post('/api/lists', editingList)
        setEditingList({ ...editingList, id: (res.data as any).id })
      }
      await loadData()
      onClose()
      toast({
        title: `List ${editingList.id ? 'updated' : 'created'}`,
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: `Failed to ${editingList.id ? 'update' : 'create'} list`,
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleManageProspects = async (list: ProspectList) => {
    setManagingList(list)
    try {
      const prospectsRes = await api.get<Prospect[]>(`/api/lists/${list.id}/prospects`)
      setAvailableProspects(prospectsRes.data || [])
    } catch (error) {
      setAvailableProspects(mockProspects.slice(0, 20))
    }
    onManageOpen()
  }

  const handleAddProspectToList = async (prospectId: string) => {
    if (!managingList) return

    try {
      await api.post(`/api/lists/${managingList.id}/prospects`, { prospectId })
      await loadData()
      toast({
        title: 'Prospect added to list',
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      toast({
        title: 'Failed to add prospect',
        status: 'error',
        duration: 2000,
      })
    }
  }

  const handleRemoveProspectFromList = async (prospectId: string) => {
    if (!managingList) return

    try {
      await api.delete(`/api/lists/${managingList.id}/prospects/${prospectId}`)
      await loadData()
      toast({
        title: 'Prospect removed from list',
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      toast({
        title: 'Failed to remove prospect',
        status: 'error',
        duration: 2000,
      })
    }
  }

  const handleDeleteList = async (listId: string) => {
    try {
      await api.delete(`/api/lists/${listId}`)
      await loadData()
      toast({
        title: 'List deleted',
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Failed to delete list',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleDuplicateList = async (list: ProspectList) => {
    try {
      const duplicatedList = {
        ...list,
        id: '',
        name: `${list.name} (Copy)`,
        prospectCount: 0,
        activeProspects: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await api.post('/api/lists', duplicatedList)
      await loadData()
      toast({
        title: 'List duplicated',
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Failed to duplicate list',
        status: 'error',
        duration: 3000,
      })
    }
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Loading lists...</Text>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Lists</Heading>
          <Text color="gray.600">
            Organize and segment your prospects for targeted campaigns
          </Text>
        </VStack>
        <HStack>
          <Button leftIcon={<AddIcon />} size="sm" variant="outline">
            Import
          </Button>
          <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={handleCreateList}>
            New List
          </Button>
        </HStack>
      </Flex>

      {/* Stats */}
      <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Lists</StatLabel>
              <StatNumber>{stats.totalLists}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Prospects</StatLabel>
              <StatNumber>{stats.totalProspects}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Active Prospects</StatLabel>
              <StatNumber>{stats.activeProspects}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Dynamic Lists</StatLabel>
              <StatNumber>{stats.dynamicLists}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Static Lists</StatLabel>
              <StatNumber>{stats.staticLists}</StatNumber>
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
            placeholder="Search lists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>

        <Select maxW="150px" defaultValue="all">
          <option value="all">All Lists</option>
          <option value="dynamic">Dynamic</option>
          <option value="static">Static</option>
        </Select>

        <Spacer />

        {selectedLists.length > 0 && (
          <HStack>
            <Text fontSize="sm" color="gray.600">
              {selectedLists.length} selected
            </Text>
            <Button size="sm" variant="outline" colorScheme="red">
              Delete Selected
            </Button>
          </HStack>
        )}
      </Flex>

      {/* Lists Grid */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
        {filteredLists.map((list) => (
          <Card key={list.id} cursor="pointer" _hover={{ shadow: 'md' }}>
            <CardHeader pb={2}>
              <Flex justify="space-between" align="start">
                <VStack align="start" spacing={1} flex={1}>
                  <Heading size="md" noOfLines={2}>{list.name}</Heading>
                  {list.description && (
                    <Text fontSize="sm" color="gray.600" noOfLines={2}>
                      {list.description}
                    </Text>
                  )}
                </VStack>
                <Menu>
                  <MenuButton
                    as={IconButton}
                    icon={<SettingsIcon />}
                    size="sm"
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <MenuList>
                    <MenuItem icon={<EditIcon />} onClick={() => handleEditList(list)}>
                      Edit
                    </MenuItem>
                    <MenuItem icon={<AddIcon />} onClick={() => handleManageProspects(list)}>
                      Manage Prospects
                    </MenuItem>
                    <MenuItem icon={<CopyIcon />} onClick={() => handleDuplicateList(list)}>
                      Duplicate
                    </MenuItem>
                    <MenuItem icon={<DownloadIcon />}>
                      Export
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem icon={<DeleteIcon />} color="red.500" onClick={() => handleDeleteList(list.id)}>
                      Delete
                    </MenuItem>
                  </MenuList>
                </Menu>
              </Flex>
            </CardHeader>
            <CardBody pt={0}>
              <VStack spacing={3} align="stretch">
                <HStack justify="space-between">
                  <HStack>
                    <Icon as={AddIcon} color="blue.500" boxSize={4} />
                    <Text fontSize="sm" fontWeight="semibold">
                      {list.prospectCount.toLocaleString()} prospects
                    </Text>
                  </HStack>
                  <Badge colorScheme={list.isDynamic ? 'green' : 'blue'} size="sm">
                    {list.isDynamic ? 'Dynamic' : 'Static'}
                  </Badge>
                </HStack>

                <Box>
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="xs" color="gray.600">Active Prospects</Text>
                    <Text fontSize="xs" fontWeight="semibold">
                      {list.activeProspects}/{list.prospectCount}
                    </Text>
                  </HStack>
                  <Progress
                    value={list.prospectCount > 0 ? (list.activeProspects / list.prospectCount) * 100 : 0}
                    size="sm"
                    colorScheme="green"
                  />
                </Box>

                {list.tags.length > 0 && (
                  <HStack spacing={1} wrap="wrap">
                    {list.tags.slice(0, 3).map((tag) => (
                      <Tag key={tag} size="sm" variant="subtle">
                        <TagLabel>{tag}</TagLabel>
                      </Tag>
                    ))}
                    {list.tags.length > 3 && (
                      <Tag size="sm" variant="subtle">
                        <TagLabel>+{list.tags.length - 3}</TagLabel>
                      </Tag>
                    )}
                  </HStack>
                )}

                <Divider />

                <HStack justify="space-between">
                  <Text fontSize="xs" color="gray.600">
                    Updated {new Date(list.updatedAt).toLocaleDateString()}
                  </Text>
                  <Button size="xs" variant="outline" onClick={() => handleManageProspects(list)}>
                    Manage
                  </Button>
                </HStack>
              </VStack>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      {/* Create/Edit List Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingList?.id ? 'Edit List' : 'Create List'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {editingList && (
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>List Name</FormLabel>
                  <Input
                    value={editingList.name}
                    onChange={(e) => setEditingList({...editingList, name: e.target.value})}
                    placeholder="Enter list name"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    value={editingList.description || ''}
                    onChange={(e) => setEditingList({...editingList, description: e.target.value})}
                    placeholder="Describe this list..."
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>List Type</FormLabel>
                  <Select
                    value={editingList.isDynamic ? 'dynamic' : 'static'}
                    onChange={(e) => setEditingList({...editingList, isDynamic: e.target.value === 'dynamic'})}
                  >
                    <option value="static">Static List (manual prospect management)</option>
                    <option value="dynamic">Dynamic List (auto-updated based on filters)</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Tags</FormLabel>
                  <HStack spacing={2} wrap="wrap">
                    {editingList.tags.map((tag) => (
                      <Tag key={tag} size="md" variant="solid">
                        <TagLabel>{tag}</TagLabel>
                        <TagCloseButton
                          onClick={() => setEditingList({
                            ...editingList,
                            tags: editingList.tags.filter(t => t !== tag)
                          })}
                        />
                      </Tag>
                    ))}
                    <Input
                      size="sm"
                      placeholder="Add tag..."
                      w="120px"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          const newTag = e.currentTarget.value.trim()
                          if (!editingList.tags.includes(newTag)) {
                            setEditingList({
                              ...editingList,
                              tags: [...editingList.tags, newTag]
                            })
                          }
                          e.currentTarget.value = ''
                        }
                      }}
                    />
                  </HStack>
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <Flex justify="flex-end" p={6} pt={0}>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSaveList}>
              {editingList?.id ? 'Save Changes' : 'Create List'}
            </Button>
          </Flex>
        </ModalContent>
      </Modal>

      {/* Manage Prospects Modal */}
      <Modal isOpen={isManageOpen} onClose={onManageClose} size="4xl">
        <ModalOverlay />
        <ModalContent maxH="80vh">
          <ModalHeader>
            Manage Prospects: {managingList?.name}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto">
            {managingList && (
              <VStack spacing={4} align="stretch">
                <Text fontSize="sm" color="gray.600">
                  Add or remove prospects from this list. Use the checkboxes to select prospects to add.
                </Text>

                <Box border="1px solid" borderColor="gray.200" borderRadius="md" overflow="hidden">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th w="50px">Add</Th>
                        <Th>Name</Th>
                        <Th>Title & Company</Th>
                        <Th>Email</Th>
                        <Th>Status</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {availableProspects.map((prospect) => (
                        <Tr key={prospect.id}>
                          <Td>
                            <Checkbox
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleAddProspectToList(prospect.id)
                                } else {
                                  handleRemoveProspectFromList(prospect.id)
                                }
                              }}
                            />
                          </Td>
                          <Td>
                            <HStack>
                              <Avatar size="sm" name={`${prospect.firstName} ${prospect.lastName}`} />
                              <Text fontWeight="semibold">
                                {prospect.firstName} {prospect.lastName}
                              </Text>
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
                          <Td>{prospect.email}</Td>
                          <Td>
                            <Badge colorScheme={prospect.status === 'qualified' ? 'green' : 'gray'} size="sm">
                              {prospect.status}
                            </Badge>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </VStack>
            )}
          </ModalBody>
          <Flex justify="flex-end" p={4}>
            <Button onClick={onManageClose}>Done</Button>
          </Flex>
        </ModalContent>
      </Modal>
    </Box>
  )
}

// Mock data for development
const mockLists: ProspectList[] = [
  {
    id: '1',
    name: 'Tech CTOs - Bay Area',
    description: 'Chief Technology Officers at tech companies in the San Francisco Bay Area',
    prospectCount: 245,
    activeProspects: 198,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-25T14:30:00Z',
    tags: ['tech', 'bay-area', 'executive'],
    filters: [
      { field: 'jobTitle', operator: 'contains', value: 'CTO' },
      { field: 'industry', operator: 'equals', value: 'Technology' },
      { field: 'location', operator: 'contains', value: 'Bay Area' },
    ],
    isDynamic: true,
  },
  {
    id: '2',
    name: 'Enterprise Accounts',
    description: 'High-value enterprise prospects for strategic outreach',
    prospectCount: 89,
    activeProspects: 89,
    createdAt: '2024-01-18T09:15:00Z',
    updatedAt: '2024-01-24T11:20:00Z',
    tags: ['enterprise', 'high-value'],
    filters: [],
    isDynamic: false,
  },
  {
    id: '3',
    name: 'Recent Responders',
    description: 'Prospects who have replied to emails in the last 30 days',
    prospectCount: 156,
    activeProspects: 134,
    createdAt: '2024-01-20T16:45:00Z',
    updatedAt: '2024-01-25T08:30:00Z',
    tags: ['responders', 'engaged'],
    filters: [
      { field: 'status', operator: 'equals', value: 'qualified' },
    ],
    isDynamic: true,
  },
]

const mockProspects: Prospect[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@techcorp.com',
    companyName: 'TechCorp Inc.',
    jobTitle: 'CTO',
    status: 'qualified',
  },
  {
    id: '2',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@startup.io',
    companyName: 'Startup.io',
    jobTitle: 'VP of Engineering',
    status: 'contacted',
  },
]

export default ListsTab