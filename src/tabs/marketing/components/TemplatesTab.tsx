import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
  ViewIcon,
} from '@chakra-ui/icons'
import { RiSparkling2Line } from 'react-icons/ri'
import { api } from '../../../utils/api'
import { normalizeCustomersListResponse } from '../../../utils/normalizeApiResponse'
import { getCurrentCustomerId } from '../../../platform/stores/settings'
import RequireActiveClient from '../../../components/RequireActiveClient'

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

const TEMPLATE_PLACEHOLDER_HELP = [
  'email_signature',
  'first_name',
  'last_name',
  'full_name',
  'company_name',
  'role',
  'website',
  'sender_name',
  'sender_email',
  'unsubscribe_link',
] as const

type AITone = 'professional' | 'friendly' | 'casual'
type TemplateEditorSnapshot = {
  subject: string
  content: string
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
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return '<p></p>'

  return normalized
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

const toPreviewBodyHtml = (body: string) => {
  const trimmed = body.trim()
  if (!trimmed) return '<p></p>'
  if (trimmed.startsWith('<')) return trimmed

  const firstTagIndex = trimmed.indexOf('<')
  if (firstTagIndex < 0) return toHtmlBody(trimmed)

  const leadingText = trimmed.slice(0, firstTagIndex).trimEnd()
  const trailingHtml = trimmed.slice(firstTagIndex)
  return `${leadingText ? toHtmlBody(leadingText) : ''}${trailingHtml}`
}

const buildEmailPreviewDocument = (bodyHtml: string) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        background: #f7fafc;
        font-family: Arial, sans-serif;
        font-size: 15px;
        line-height: 1.6;
        color: #1a202c;
      }
      .preview-shell {
        padding: 24px;
      }
      .preview-frame {
        max-width: 680px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 32px;
        overflow-wrap: anywhere;
      }
      p {
        margin: 0 0 16px 0;
      }
      p:last-child {
        margin-bottom: 0;
      }
      div, td, th {
        line-height: 1.6;
      }
      img {
        max-width: 100%;
        height: auto;
      }
      table {
        max-width: 100%;
      }
      a {
        color: #2563eb;
      }
    </style>
  </head>
  <body>
    <div class="preview-shell">
      <div class="preview-frame">
        ${bodyHtml || '<p></p>'}
      </div>
    </div>
  </body>
</html>`

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
  const [previewRendered, setPreviewRendered] = useState<{ subject: string; body: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [aiTone, setAiTone] = useState<AITone>('professional')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<{ subject: string; content: string } | null>(null)
  const [aiAppliedLocally, setAiAppliedLocally] = useState(false)
  const [originalTemplateSnapshot, setOriginalTemplateSnapshot] = useState<TemplateEditorSnapshot | null>(null)
  const toast = useToast()

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  )

  const loadCustomers = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  const loadData = useCallback(async () => {
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
  }, [selectedCustomerId])

  useEffect(() => {
    if (selectedCustomerId) {
      void loadData()
    }
  }, [selectedCustomerId, loadData])

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

  const resetAiAssist = () => {
    setAiLoading(false)
    setAiError(null)
    setAiSuggestion(null)
    setAiAppliedLocally(false)
    setAiTone('professional')
  }

  const captureOriginalTemplateSnapshot = (template: Pick<EmailTemplate, 'subject' | 'content'>) => {
    setOriginalTemplateSnapshot({
      subject: template.subject,
      content: template.content,
    })
  }

  const handleCreateTemplate = () => {
    resetAiAssist()
    const nextTemplate = {
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
    }
    setEditingTemplate(nextTemplate)
    captureOriginalTemplateSnapshot(nextTemplate)
    onOpen()
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    resetAiAssist()
    setEditingTemplate(template)
    captureOriginalTemplateSnapshot(template)
    onOpen()
  }

const handlePreviewTemplate = (template: EmailTemplate) => {
    setPreviewingTemplate(template)
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewRendered(null)
    onPreviewOpen()
    const headers = selectedCustomerId ? { 'X-Customer-Id': selectedCustomerId } : undefined
    void api.post<{ subject?: string; body?: string }>(
      '/api/templates/preview',
      {
        subject: template.subject,
        body: toHtmlBody(template.content),
        variables: {
          first_name: 'Alex',
          last_name: 'Taylor',
          full_name: 'Alex Taylor',
          role: 'Operations Manager',
          unsubscribe_link: 'https://example.com/unsubscribe',
        },
      },
      { headers },
    ).then((res) => {
      if (res.error) {
        setPreviewError(res.error)
      } else {
        setPreviewRendered({
          subject: res.data?.subject || template.subject,
          body: res.data?.body || toHtmlBody(template.content),
        })
      }
    }).finally(() => setPreviewLoading(false))
  }

  const handleRewriteWithAI = async () => {
    if (!editingTemplate) return
    if (!editingTemplate.content.trim()) {
      setAiError('Enter template content before using AI.')
      return
    }

    setAiLoading(true)
    setAiError(null)
    setAiSuggestion(null)

    const headers = selectedCustomerId ? { 'X-Customer-Id': selectedCustomerId } : undefined
    const response = await api.post<{ tweakedBody?: string; tweakedSubject?: string }>(
      '/api/templates/ai/tweak',
      {
        templateBody: editingTemplate.content,
        templateSubject: editingTemplate.subject || undefined,
        contactCompany: selectedCustomer?.name || undefined,
        tone: aiTone,
        instruction: 'Improve the wording for production outreach. Keep placeholders and unsubscribe tokens exactly as written.',
        preservePlaceholders: true,
      },
      { headers },
    )

    setAiLoading(false)

    if (response.error) {
      setAiError(response.error)
      return
    }

    setAiSuggestion({
      subject: response.data?.tweakedSubject || editingTemplate.subject,
      content: response.data?.tweakedBody || editingTemplate.content,
    })
  }

  const applyAiSuggestion = () => {
    if (!editingTemplate || !aiSuggestion) return
    setEditingTemplate({
      ...editingTemplate,
      subject: aiSuggestion.subject,
      content: aiSuggestion.content,
    })
    setAiAppliedLocally(true)
    setAiSuggestion(null)
  }

  const restoreOriginalTemplate = () => {
    if (!editingTemplate || !originalTemplateSnapshot) return
    setEditingTemplate({
      ...editingTemplate,
      subject: originalTemplateSnapshot.subject,
      content: originalTemplateSnapshot.content,
    })
    setAiAppliedLocally(false)
    setAiSuggestion(null)
    setAiError(null)
  }

  const handleCloseEditor = () => {
    resetAiAssist()
    setOriginalTemplateSnapshot(null)
    onClose()
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
      handleCloseEditor()
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

  if (!selectedCustomerId || !selectedCustomerId.startsWith('cust_')) {
    return (
      <RequireActiveClient>
        <Box textAlign="center" py={10}>
          <Text>Please select a client to view templates.</Text>
        </Box>
      </RequireActiveClient>
    )
  }

  const templateHasOriginalSnapshot =
    !!editingTemplate &&
    !!originalTemplateSnapshot &&
    (
      editingTemplate.subject !== originalTemplateSnapshot.subject ||
      editingTemplate.content !== originalTemplateSnapshot.content
    )

  if (loading) {
    return (
      <RequireActiveClient>
        <Box textAlign="center" py={10}>
          <Text>Loading templates...</Text>
        </Box>
      </RequireActiveClient>
    )
  }

  return (
    <RequireActiveClient>
    <Box id="templates-tab-panel" data-testid="templates-tab-panel">
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
            id="templates-tab-refresh-btn"
            data-testid="templates-tab-refresh-btn"
            variant="outline"
            onClick={loadData}
          >
            Refresh
          </Button>
          <Button 
            id="templates-tab-create-btn"
            data-testid="templates-tab-create-btn"
            leftIcon={<AddIcon />} 
            colorScheme="blue" 
            onClick={handleCreateTemplate}
            isDisabled={!selectedCustomerId}
          >
            New Template
          </Button>
        </HStack>
      </Flex>

      <Alert id="templates-tab-compliance-banner" data-testid="templates-tab-compliance-banner" status="info" mb={4}>
        <AlertIcon />
        <AlertDescription>
          Preview and send use the same placeholder rendering contract. Unsubscribe links remain enforced at send time.
        </AlertDescription>
      </Alert>

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
      <SimpleGrid id="templates-tab-grid" data-testid="templates-tab-grid" columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
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
                  {!/\{\{\s*(unsubscribeLink|unsubscribe_link)\s*\}\}|unsubscribe/i.test(template.content) && (
                    <Badge mt={1} colorScheme="blue">Unsubscribe footer added automatically</Badge>
                  )}
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
      <Modal isOpen={isOpen} onClose={handleCloseEditor} size="4xl">
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
                  <Flex justify="space-between" align="center" mb={2} gap={3}>
                    <FormLabel mb={0}>Email Content</FormLabel>
                    <HStack spacing={2}>
                      {templateHasOriginalSnapshot ? (
                        <Button size="sm" variant="ghost" onClick={restoreOriginalTemplate}>
                          Restore original
                        </Button>
                      ) : null}
                      <Select
                        size="sm"
                        value={aiTone}
                        onChange={(e) => setAiTone(e.target.value as AITone)}
                        w="160px"
                      >
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="casual">Conversational</option>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Icon as={RiSparkling2Line} />}
                        onClick={handleRewriteWithAI}
                        isLoading={aiLoading}
                        loadingText="Rewriting"
                      >
                        Improve with AI
                      </Button>
                    </HStack>
                  </Flex>
                  <Box border="1px solid" borderColor="gray.200" borderRadius="md" bg="white" p={3} mb={3}>
                    <HStack spacing={2} flexWrap="wrap">
                      {aiSuggestion ? (
                        <Badge colorScheme="blue" variant="subtle">
                          AI suggestion ready
                        </Badge>
                      ) : null}
                      {aiAppliedLocally ? (
                        <>
                          <Badge colorScheme="purple" variant="subtle">
                            AI changes applied locally
                          </Badge>
                          <Badge colorScheme="orange" variant="subtle">
                            Not saved yet
                          </Badge>
                        </>
                      ) : (
                        <Badge colorScheme="gray" variant="subtle">
                          Original
                        </Badge>
                      )}
                    </HStack>
                    <Text mt={2} fontSize="xs" color="gray.600">
                      AI suggestions do not save automatically. Your original template stays unchanged until you click Save.
                    </Text>
                  </Box>
                  <Box border="1px solid" borderColor="gray.200" borderRadius="md" bg="gray.50" p={3} mb={3}>
                    <Text fontSize="sm" fontWeight="semibold">Supported placeholders</Text>
                    <Flex mt={2} gap={2} wrap="wrap">
                      {TEMPLATE_PLACEHOLDER_HELP.map((token) => (
                        <Tag key={token} size="sm" variant="subtle" colorScheme="blue">
                          <TagLabel>{`{{${token}}}`}</TagLabel>
                        </Tag>
                      ))}
                    </Flex>
                    <Text mt={2} fontSize="xs" color="gray.600">
                      Use {`{{email_signature}}`} to insert the sending signature. Existing camelCase placeholders still work.
                    </Text>
                  </Box>
                  <Textarea
                    value={editingTemplate.content}
                    onChange={(e) => setEditingTemplate({...editingTemplate, content: e.target.value})}
                    placeholder="Enter your email content here..."
                    minH="200px"
                  />
                </FormControl>

                {aiError ? (
                  <Alert status="warning">
                    <AlertIcon />
                    <AlertDescription>{aiError}</AlertDescription>
                  </Alert>
                ) : null}

                {aiSuggestion ? (
                  <Box border="1px solid" borderColor="blue.200" borderRadius="md" bg="blue.50" p={4}>
                    <HStack justify="space-between" align="start" mb={3}>
                      <VStack align="start" spacing={0}>
                        <HStack spacing={2}>
                          <Icon as={RiSparkling2Line} color="blue.500" />
                          <Text fontWeight="semibold">AI suggestion</Text>
                        </HStack>
                        <Text fontSize="sm" color="gray.600">Review before applying. The saved original stays unchanged until you explicitly save.</Text>
                      </VStack>
                      <HStack spacing={2}>
                        <Button size="sm" colorScheme="blue" onClick={applyAiSuggestion}>
                          Apply suggestion
                        </Button>
                        {originalTemplateSnapshot ? (
                          <Button size="sm" variant="ghost" onClick={restoreOriginalTemplate}>
                            Restore original
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => setAiSuggestion(null)}>
                          Dismiss
                        </Button>
                      </HStack>
                    </HStack>
                    <VStack align="stretch" spacing={3}>
                      <Box>
                        <Text fontSize="sm" fontWeight="semibold">Suggested subject</Text>
                        <Text mt={1} whiteSpace="pre-wrap">{aiSuggestion.subject}</Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" fontWeight="semibold">Suggested content</Text>
                        <Box mt={1} whiteSpace="pre-wrap">{aiSuggestion.content}</Box>
                      </Box>
                    </VStack>
                  </Box>
                ) : null}

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
            <Button variant="ghost" mr={3} onClick={handleCloseEditor}>
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
        <ModalContent id="templates-tab-preview-modal" data-testid="templates-tab-preview-modal">
          <ModalHeader>Template Preview: {previewingTemplate?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {previewingTemplate && (
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontWeight="semibold">Subject:</Text>
                  <Text p={3} bg="gray.50" borderRadius="md">{previewRendered?.subject || previewingTemplate.subject}</Text>
                </Box>

                {previewingTemplate.previewText && (
                  <Box>
                    <Text fontWeight="semibold">Preview Text:</Text>
                    <Text p={3} bg="gray.50" borderRadius="md">{previewingTemplate.previewText}</Text>
                  </Box>
                )}

                <Box>
                  <Text fontWeight="semibold">Content (backend rendered):</Text>
                  <Box
                    mt={2}
                    bg="gray.50"
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="md"
                    overflow="hidden"
                  >
                    <iframe
                      title="template-preview-frame"
                      srcDoc={buildEmailPreviewDocument(
                        previewLoading
                          ? '<p>Rendering preview...</p>'
                          : toPreviewBodyHtml(previewRendered?.body || toHtmlBody(previewingTemplate.content)),
                      )}
                      style={{ width: '100%', minHeight: '720px', border: 0, background: 'white' }}
                      sandbox="allow-same-origin"
                    />
                  </Box>
                  <Text mt={2} fontSize="xs" color="gray.500">
                    Preview framed at a realistic email width.
                  </Text>
                  {previewError ? (
                    <Alert status="warning" mt={2}>
                      <AlertIcon />
                      <AlertDescription>{previewError}</AlertDescription>
                    </Alert>
                  ) : null}
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
    </RequireActiveClient>
  )
}

// Mock data for development
export default TemplatesTab
