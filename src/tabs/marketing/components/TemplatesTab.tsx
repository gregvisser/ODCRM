import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
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
  Text,
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
} from '@chakra-ui/react'
import {
  AddIcon,
  SearchIcon,
  EditIcon,
  DeleteIcon,
  CopyIcon,
  StarIcon,
  EmailIcon,
  ViewIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { normalizeCustomersListResponse } from '../../../utils/normalizeApiResponse'
import { getCurrentCustomerId } from '../../../platform/stores/settings'
import NoActiveClientEmptyState from '../../../components/NoActiveClientEmptyState'

type EmailTemplate = {
  id: string
  name: string
  subject: string
  content: string
  previewText?: string
  category: string
  tags: string[]
  isFavorite: boolean
  usageCount: number
  lastUsed?: string
  createdAt: string
  updatedAt: string
  createdBy: {
    id: string
    name: string
    email: string
  }
}

type Customer = {
  id: string
  name: string
}

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const toHtmlBody = (text: string) => {
  const escaped = escapeHtml(text)
  return `<p>${escaped.replace(/\n/g, '<br/>')}</p>`
}

const TemplatesTab: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isPreviewOpen, onOpen: onPreviewOpen, onClose: onPreviewClose } = useDisclosure()
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [previewingTemplate, setPreviewingTemplate] = useState<EmailTemplate | null>(null)
  const toast = useToast()

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    if (selectedCustomerId) {
      loadData()
    }
  }, [selectedCustomerId])

  const loadCustomers = async () => {
    const { data, error: apiError } = await api.get('/api/customers')

    if (apiError) {
      console.error('Failed to load customers:', apiError)
      setCustomers([])
      setSelectedCustomerId('')
      return
    }

    try {
      const customerList = normalizeCustomersListResponse(data) as Customer[]
      setCustomers(customerList)
      // Only use customer IDs that exist in the API response (real cust_*). No silent default tenant.
      const storeCustomerId = getCurrentCustomerId()
      const currentCustomer = customerList.find(c => c.id === storeCustomerId)
      if (currentCustomer) {
        setSelectedCustomerId(currentCustomer.id)
      } else {
        setSelectedCustomerId('')
      }
    } catch (err: any) {
      console.error('❌ Failed to normalize customers in TemplatesTab:', err)
      setCustomers([])
      setSelectedCustomerId('')
    }
  }

  const loadData = async () => {
    if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
      return
    }

    setLoading(true)
    setError(null)

    if (import.meta.env.DEV) {
      console.log('[TemplatesTab] request customerId present=', !!selectedCustomerId)
    }

    const { data, error: apiError } = await api.get<any[]>('/api/templates', {
      headers: { 'X-Customer-Id': selectedCustomerId }
    })
    
    if (apiError) {
      setError(apiError)
    } else {
      const mapped = (data || []).map((template) => ({
        id: template.id,
        name: template.name || '',
        subject: template.subjectTemplate || template.subject || '',
        content: template.bodyTemplateText || template.bodyTemplateHtml || '',
        previewText: template.previewText || '',
        category: template.category || 'General',
        tags: Array.isArray(template.tags) ? template.tags : [],
        isFavorite: !!template.isFavorite,
        usageCount: template.usageCount || 0,
        lastUsed: template.lastUsed,
        createdAt: template.createdAt || new Date().toISOString(),
        updatedAt: template.updatedAt || new Date().toISOString(),
        createdBy: template.createdBy || {
          id: 'current-user',
          name: 'Current User',
          email: 'user@company.com',
        },
      }))
      setTemplates(mapped)
    }
    
    setLoading(false)
  }

  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category))
    return Array.from(cats).sort()
  }, [templates])

  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = searchQuery === '' ||
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter

      return matchesSearch && matchesCategory
    })
  }, [templates, searchQuery, categoryFilter])

  const favoriteTemplates = useMemo(() => {
    return templates.filter(t => t.isFavorite)
  }, [templates])

  const handleCreateTemplate = () => {
    setEditingTemplate({
      id: '',
      name: '',
      subject: '',
      content: '',
      previewText: '',
      category: 'General',
      tags: [],
      isFavorite: false,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: {
        id: 'current-user',
        name: 'Current User',
        email: 'user@company.com',
      },
    })
    onOpen()
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template)
    onOpen()
  }

  const handlePreviewTemplate = (template: EmailTemplate) => {
    setPreviewingTemplate(template)
    onPreviewOpen()
  }

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return
    if (!editingTemplate.name.trim() || !editingTemplate.subject.trim() || !editingTemplate.content.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Name, subject, and content are required.',
        status: 'error',
        duration: 3000,
      })
      return
    }
    if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
      toast({
        title: 'No client selected',
        description: 'Select a client to create or update templates.',
        status: 'error',
        duration: 3000,
      })
      return
    }

    try {
      const payload = {
        name: editingTemplate.name.trim(),
        subjectTemplate: editingTemplate.subject.trim(),
        bodyTemplateHtml: toHtmlBody(editingTemplate.content),
        bodyTemplateText: editingTemplate.content.trim(),
        stepNumber: 1,
      }
      const headers = { 'X-Customer-Id': selectedCustomerId }
      
      if (editingTemplate.id) {
        const res = await api.patch(`/api/templates/${editingTemplate.id}`, payload, { headers })
        if (res.error) {
          throw new Error(res.error)
        }
      } else {
        const res = await api.post('/api/templates', payload, { headers })
        if (res.error) {
          throw new Error(res.error)
        }
        setEditingTemplate({ ...editingTemplate, id: (res.data as any).id })
      }
      await loadData()
      onClose()
      toast({
        title: `Template ${editingTemplate.id ? 'updated' : 'created'}`,
        status: 'success',
        duration: 3000,
      })
    } catch (error: any) {
      toast({
        title: `Failed to ${editingTemplate.id ? 'update' : 'create'} template`,
        description: error?.message,
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleDuplicateTemplate = async (template: EmailTemplate) => {
    if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
      toast({
        title: 'No client selected',
        description: 'Select a client to duplicate templates.',
        status: 'error',
        duration: 3000,
      })
      return
    }
    try {
      const duplicatedTemplate = {
        name: `${template.name} (Copy)`,
        subjectTemplate: template.subject.trim(),
        bodyTemplateHtml: toHtmlBody(template.content),
        bodyTemplateText: template.content.trim(),
        stepNumber: 1,
      }
      const headers = { 'X-Customer-Id': selectedCustomerId }
      const res = await api.post('/api/templates', duplicatedTemplate, { headers })
      if (res.error) {
        throw new Error(res.error)
      }
      await loadData()
      toast({
        title: 'Template duplicated',
        status: 'success',
        duration: 3000,
      })
    } catch (error: any) {
      toast({
        title: 'Failed to duplicate template',
        description: error?.message,
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleToggleFavorite = async (template: EmailTemplate) => {
    try {
      const headers = { 'X-Customer-Id': selectedCustomerId }
      await api.patch(`/api/templates/${template.id}`, {
        isFavorite: !template.isFavorite
      }, { headers })
      await loadData()
    } catch (error) {
      toast({
        title: 'Failed to update favorite status',
        status: 'error',
        duration: 2000,
      })
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
      toast({ title: 'No client selected', status: 'error', duration: 3000 })
      return
    }
    try {
      const headers = { 'X-Customer-Id': selectedCustomerId }
      const { error: deleteError } = await api.delete(`/api/templates/${templateId}`, { headers })
      if (deleteError) {
        toast({
          title: 'Failed to delete template',
          description: deleteError,
          status: 'error',
          duration: 3000,
        })
        return
      }
      // Only update UI after confirmed backend deletion
      setTemplates((prev) => prev.filter((t) => t.id !== templateId))
      toast({ title: 'Template deleted', status: 'success', duration: 3000 })
    } catch (error: any) {
      toast({
        title: 'Failed to delete template',
        description: error?.message,
        status: 'error',
        duration: 3000,
      })
    }
  }

  if (!getCurrentCustomerId()) {
    return <NoActiveClientEmptyState />
  }
  if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Please select a client to view templates.</Text>
      </Box>
    )
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Loading templates...</Text>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Email Templates</Heading>
          <Text color="gray.600">
            Create and manage reusable email content for your outreach campaigns
          </Text>
        </VStack>
        <HStack spacing={3}>
          <FormControl w="250px">
            <Select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              placeholder="Select Client"
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </FormControl>
          <Button 
            leftIcon={<AddIcon />} 
            colorScheme="blue" 
            onClick={handleCreateTemplate}
            isDisabled={!selectedCustomerId}
          >
            New Template
          </Button>
        </HStack>
      </Flex>

      {/* Error Display */}
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>Failed to load templates</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
          <Button size="sm" onClick={loadData} ml={4}>
            Retry
          </Button>
        </Alert>
      )}

      {/* Quick Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Text fontSize="2xl" fontWeight="bold">{templates.length}</Text>
            <Text fontSize="sm" color="gray.600">Total Templates</Text>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Text fontSize="2xl" fontWeight="bold">{categories.length}</Text>
            <Text fontSize="sm" color="gray.600">Categories</Text>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Text fontSize="2xl" fontWeight="bold">{favoriteTemplates.length}</Text>
            <Text fontSize="sm" color="gray.600">Favorites</Text>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Text fontSize="2xl" fontWeight="bold">
              {templates.reduce((sum, t) => sum + t.usageCount, 0)}
            </Text>
            <Text fontSize="sm" color="gray.600">Total Uses</Text>
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
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>

        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          maxW="150px"
        >
          <option value="all">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </Select>

        <Spacer />
      </Flex>

      {/* Empty State */}
      {filteredTemplates.length === 0 && !loading && (
        <Box textAlign="center" py={10}>
          <Text fontSize="lg" color="gray.600" mb={4}>
            {templates.length === 0 
              ? 'No templates yet. Create your first template to get started!'
              : 'No templates match your search criteria.'}
          </Text>
          {templates.length === 0 && (
            <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={handleCreateTemplate}>
              Create First Template
            </Button>
          )}
        </Box>
      )}

      {/* Templates Grid */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
        {filteredTemplates.map((template) => (
          <Card key={template.id} cursor="pointer" _hover={{ shadow: 'md' }}>
            <CardHeader pb={2}>
              <Flex justify="space-between" align="start">
                <VStack align="start" spacing={1} flex={1}>
                  <HStack>
                    <Heading size="md" noOfLines={2}>{template.name}</Heading>
                    {template.isFavorite && (
                      <Icon as={StarIcon} color="yellow.400" boxSize={4} />
                    )}
                  </HStack>
                  <Badge colorScheme="blue" size="sm">{template.category}</Badge>
                </VStack>
                <Menu>
                  <MenuButton
                    as={IconButton}
                    icon={<EditIcon />}
                    size="sm"
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <MenuList>
                    <MenuItem icon={<ViewIcon />} onClick={() => handlePreviewTemplate(template)}>
                      Preview
                    </MenuItem>
                    <MenuItem icon={<EditIcon />} onClick={() => handleEditTemplate(template)}>
                      Edit
                    </MenuItem>
                    <MenuItem icon={<CopyIcon />} onClick={() => handleDuplicateTemplate(template)}>
                      Duplicate
                    </MenuItem>
                    <MenuItem
                      icon={<StarIcon />}
                      onClick={() => handleToggleFavorite(template)}
                    >
                      {template.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem icon={<DeleteIcon />} color="red.500" onClick={() => handleDeleteTemplate(template.id)}>
                      Delete
                    </MenuItem>
                  </MenuList>
                </Menu>
              </Flex>
            </CardHeader>
            <CardBody pt={0}>
              <VStack spacing={3} align="stretch">
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" color="gray.700">
                    Subject: {template.subject}
                  </Text>
                  {template.previewText && (
                    <Text fontSize="sm" color="gray.600" noOfLines={2}>
                      {template.previewText}
                    </Text>
                  )}
                </Box>

                {template.tags.length > 0 && (
                  <HStack spacing={1} wrap="wrap">
                    {template.tags.slice(0, 3).map((tag) => (
                      <Tag key={tag} size="sm" variant="subtle">
                        <TagLabel>{tag}</TagLabel>
                      </Tag>
                    ))}
                    {template.tags.length > 3 && (
                      <Tag size="sm" variant="subtle">
                        <TagLabel>+{template.tags.length - 3}</TagLabel>
                      </Tag>
                    )}
                  </HStack>
                )}

                <Divider />

                <HStack justify="space-between" fontSize="sm" color="gray.600">
                  <Text>Used {template.usageCount} times</Text>
                  <Text>
                    Updated {new Date(template.updatedAt).toLocaleDateString()}
                  </Text>
                </HStack>
              </VStack>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      {/* Create/Edit Template Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="4xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingTemplate?.id ? 'Edit Template' : 'Create Template'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {editingTemplate && (
              <VStack spacing={4} align="stretch">
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Template Name</FormLabel>
                    <Input
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                      placeholder="Enter template name"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={editingTemplate.category}
                      onChange={(e) => setEditingTemplate({...editingTemplate, category: e.target.value})}
                    >
                      <option value="General">General</option>
                      <option value="Sales">Sales</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Follow-up 1">Follow-up 1</option>
                      <option value="Follow-up 2">Follow-up 2</option>
                      <option value="Follow-up 3">Follow-up 3</option>
                      <option value="Follow-up 4">Follow-up 4</option>
                      <option value="Follow-up 5">Follow-up 5</option>
                      <option value="Introduction">Introduction</option>
                      <option value="Newsletter">Newsletter</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>

                <FormControl>
                  <FormLabel>Email Subject</FormLabel>
                  <Input
                    value={editingTemplate.subject}
                    onChange={(e) => setEditingTemplate({...editingTemplate, subject: e.target.value})}
                    placeholder="Enter email subject line"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Preview Text (optional)</FormLabel>
                  <Input
                    value={editingTemplate.previewText || ''}
                    onChange={(e) => setEditingTemplate({...editingTemplate, previewText: e.target.value})}
                    placeholder="Short preview text that appears in email clients"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Email Content</FormLabel>
                  <Textarea
                    value={editingTemplate.content}
                    onChange={(e) => setEditingTemplate({...editingTemplate, content: e.target.value})}
                    placeholder="Enter your email content here..."
                    minH="200px"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Tags</FormLabel>
                  <HStack spacing={2} wrap="wrap">
                    {editingTemplate.tags.map((tag) => (
                      <Tag key={tag} size="md" variant="solid">
                        <TagLabel>{tag}</TagLabel>
                        <TagCloseButton
                          onClick={() => setEditingTemplate({
                            ...editingTemplate,
                            tags: editingTemplate.tags.filter(t => t !== tag)
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
                          if (!editingTemplate.tags.includes(newTag)) {
                            setEditingTemplate({
                              ...editingTemplate,
                              tags: [...editingTemplate.tags, newTag]
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
            <Button colorScheme="blue" onClick={handleSaveTemplate}>
              {editingTemplate?.id ? 'Save Changes' : 'Create Template'}
            </Button>
          </Flex>
        </ModalContent>
      </Modal>

      {/* Preview Template Modal */}
      <Modal isOpen={isPreviewOpen} onClose={onPreviewClose} size="4xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Template Preview: {previewingTemplate?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {previewingTemplate && (
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontWeight="semibold">Subject:</Text>
                  <Text p={3} bg="gray.50" borderRadius="md">{previewingTemplate.subject}</Text>
                </Box>

                {previewingTemplate.previewText && (
                  <Box>
                    <Text fontWeight="semibold">Preview Text:</Text>
                    <Text p={3} bg="gray.50" borderRadius="md">{previewingTemplate.previewText}</Text>
                  </Box>
                )}

                <Box>
                  <Text fontWeight="semibold">Content:</Text>
                  <Box
                    p={4}
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="md"
                    minH="300px"
                    whiteSpace="pre-wrap"
                  >
                    {previewingTemplate.content}
                  </Box>
                </Box>

                <HStack spacing={2}>
                  <Text fontWeight="semibold">Tags:</Text>
                  {previewingTemplate.tags.map((tag) => (
                    <Tag key={tag} size="sm">
                      <TagLabel>{tag}</TagLabel>
                    </Tag>
                  ))}
                </HStack>
              </VStack>
            )}
          </ModalBody>
          <Flex justify="flex-end" p={4}>
            <Button onClick={onPreviewClose}>Close</Button>
          </Flex>
        </ModalContent>
      </Modal>
    </Box>
  )
}

// Mock data for development
export default TemplatesTab
