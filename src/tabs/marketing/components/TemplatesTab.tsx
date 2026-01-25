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
  MoreVerticalIcon,
  EditIcon,
  DeleteIcon,
  CopyIcon,
  StarIcon,
  EmailIcon,
  TemplateIcon,
  ViewIcon,
} from '@chakra-ui/icons'
import { api } from '../../../utils/api'

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

const TemplatesTab: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isPreviewOpen, onOpen: onPreviewOpen, onClose: onPreviewClose } = useDisclosure()
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [previewingTemplate, setPreviewingTemplate] = useState<EmailTemplate | null>(null)
  const toast = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const templatesRes = await api.get<EmailTemplate[]>('/api/templates')
      setTemplates(templatesRes.data || mockTemplates)
    } catch (error) {
      console.error('Failed to load templates:', error)
      setTemplates(mockTemplates)
    } finally {
      setLoading(false)
    }
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

    try {
      if (editingTemplate.id) {
        await api.put(`/api/templates/${editingTemplate.id}`, editingTemplate)
      } else {
        const res = await api.post('/api/templates', editingTemplate)
        setEditingTemplate({ ...editingTemplate, id: res.data.id })
      }
      await loadData()
      onClose()
      toast({
        title: `Template ${editingTemplate.id ? 'updated' : 'created'}`,
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: `Failed to ${editingTemplate.id ? 'update' : 'create'} template`,
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleDuplicateTemplate = async (template: EmailTemplate) => {
    try {
      const duplicatedTemplate = {
        ...template,
        id: '',
        name: `${template.name} (Copy)`,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await api.post('/api/templates', duplicatedTemplate)
      await loadData()
      toast({
        title: 'Template duplicated',
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Failed to duplicate template',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleToggleFavorite = async (template: EmailTemplate) => {
    try {
      await api.patch(`/api/templates/${template.id}`, {
        isFavorite: !template.isFavorite
      })
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
    try {
      await api.delete(`/api/templates/${templateId}`)
      await loadData()
      toast({
        title: 'Template deleted',
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Failed to delete template',
        status: 'error',
        duration: 3000,
      })
    }
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
        <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={handleCreateTemplate}>
          New Template
        </Button>
      </Flex>

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
                    icon={<MoreVerticalIcon />}
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
const mockTemplates: EmailTemplate[] = [
  {
    id: '1',
    name: 'Initial Outreach',
    subject: 'Following up on our conversation about {{company}}',
    content: `Hi {{firstName}},

I hope this email finds you well. I wanted to follow up on our conversation about {{company}} and the challenges you're facing with {{pain_point}}.

At {{our_company}}, we've helped similar companies like {{company}} achieve {{benefit}} by {{solution}}.

Would you be open to a quick 15-minute call next week to discuss how we might help {{company}}?

Best regards,
{{sender_name}}
{{sender_title}}
{{sender_company}}
{{sender_phone}}`,
    previewText: 'Following up on our conversation about your company...',
    category: 'Sales',
    tags: ['outreach', 'follow-up', 'sales'],
    isFavorite: true,
    usageCount: 245,
    lastUsed: '2024-01-25T10:30:00Z',
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-20T14:15:00Z',
    createdBy: {
      id: '1',
      name: 'John Smith',
      email: 'john@company.com',
    },
  },
  {
    id: '2',
    name: 'Product Demo Request',
    subject: 'Product demo: {{product_name}} for {{company}}',
    content: `Hello {{firstName}},

Thank you for your interest in {{product_name}}. I'd love to show you how our solution can help {{company}} overcome {{challenge}}.

Our product demo typically takes 30 minutes and covers:
• Key features and capabilities
• Integration with your existing systems
• ROI and implementation timeline

When would be a good time for us to connect?

Looking forward to your response.

Best,
{{sender_name}}`,
    category: 'Sales',
    tags: ['demo', 'product', 'sales'],
    isFavorite: false,
    usageCount: 89,
    createdAt: '2024-01-18T11:30:00Z',
    updatedAt: '2024-01-22T16:45:00Z',
    createdBy: {
      id: '1',
      name: 'John Smith',
      email: 'john@company.com',
    },
  },
  {
    id: '3',
    name: 'Newsletter Welcome',
    subject: 'Welcome to {{company}} Insights - Issue #{{issue_number}}',
    content: `Hi {{firstName}},

Welcome to our monthly newsletter! Each issue brings you:
• Industry trends and insights
• Best practices from successful companies
• Exclusive content and resources

In this issue:
{{newsletter_content}}

Stay connected,
The {{company}} Team

P.S. Reply to this email if you'd like to unsubscribe or update your preferences.`,
    category: 'Newsletter',
    tags: ['newsletter', 'welcome', 'marketing'],
    isFavorite: true,
    usageCount: 1200,
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-25T12:00:00Z',
    createdBy: {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@company.com',
    },
  },
]

export default TemplatesTab
