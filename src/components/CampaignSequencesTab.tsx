import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Heading,
  Text,
  Stack,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  HStack,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Divider,
  VStack,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  SimpleGrid,
  Icon,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons'
import { MdEmail } from 'react-icons/md'
import { accounts } from './AccountsTab'
import { accountsStore, campaignWorkflowsStore, settingsStore } from '../platform'
import { api } from '../utils/api'

type EmailTemplate = {
  id: string
  subject: string
  body: string
  stepNumber: 1 | 2
}

type SavedEmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  account?: string
  stepNumber: 1 | 2
  createdAt: string
  updatedAt: string
}

type CampaignWorkflow = {
  id: string
  name: string
  description: string
  account?: string // Will link to account eventually
  firstEmail: EmailTemplate
  secondEmail: EmailTemplate
  daysBetweenEmails: number
  firstEmailScheduledDate?: string // ISO date string for first email
  secondEmailScheduledDate?: string // ISO date string for second email
  status: 'Active' | 'Paused' | 'Draft'
  createdAt: string
  updatedAt: string
}

// Default email templates
const defaultFirstEmailTemplate: EmailTemplate = {
  id: 'default-first',
  subject: 'Introduction - {{accountName}}',
  body: `Hi {{contactName}},

I hope this email finds you well. My name is {{senderName}} and I'm reaching out from OpensDoors regarding {{accountName}}.

We specialize in [your value proposition] and I believe we could help {{accountName}} achieve [specific benefit].

Would you be available for a brief call this week to discuss how we might be able to support your goals?

Best regards,
{{senderName}}`,
  stepNumber: 1,
}

const defaultSecondEmailTemplate: EmailTemplate = {
  id: 'default-second',
  subject: 'Following up - {{accountName}}',
  body: `Hi {{contactName}},

I wanted to follow up on my previous email regarding {{accountName}}.

I understand you're likely busy, but I wanted to make sure you saw my message about [value proposition].

If you're interested in learning more, I'd be happy to schedule a quick 15-minute call at your convenience.

Alternatively, if now isn't the right time, please let me know and I'll follow up in a few months.

Best regards,
{{senderName}}`,
  stepNumber: 2,
}

// Create default Legionella workflow for demo
function createLegionellaWorkflow(): CampaignWorkflow {
  // Dates: First email Nov 30, 8 AM; Second email Dec 4, 8 AM
  const currentYear = new Date().getFullYear()
  const firstEmailDate = new Date(currentYear, 10, 30, 8, 0, 0) // Nov 30, 8 AM
  const secondEmailDate = new Date(currentYear, 11, 4, 8, 0, 0) // Dec 4, 8 AM

  return {
    id: 'legionella-demo-workflow',
    name: 'Legionella Outreach Campaign',
    description: 'Demo campaign for Legionella account using Reply success story templates',
    account: 'Legionella',
    firstEmail: {
      id: 'legionella-first',
      subject: 'How Reply helped us grow',
      body: `Hi A,

At Reply, we used our own software to attract customers, find more leads, and grow our business. In six months, thousands of people visited our site and signed up to try out our app. Hundreds went on to become paying customers.

How?

We tested our messaging until we found the best emails. We automated the process so we could reach more people. Using our own software, it was easy to improve our open/reply rates and find more customers.

We'd love to help you see the same great results. If you're still sending emails manually, why not come back to Reply and give us another try?

Best regards,

{{Your_Name}} and {{Your_Company}}`,
      stepNumber: 1,
    },
    secondEmail: {
      id: 'legionella-second',
      subject: 'Following up - Legionella',
      body: `Hi A.

You must have been very busy, but I'd really love to connect with you and see whether or not we can help Legionella with [Your brief value proposition].

We've helped many companies in your space improve their team's ability to successfully engage with their prospective clients and deliver tremendous ROI.

I'd love to share some insights on how Legionella can benefit from collaborating with us.

What will it take to get 10 minutes on your calendar in the next few days?`,
      stepNumber: 2,
    },
    daysBetweenEmails: 4,
    firstEmailScheduledDate: firstEmailDate.toISOString(),
    secondEmailScheduledDate: secondEmailDate.toISOString(),
    status: 'Active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function loadWorkflowsFromStore(): CampaignWorkflow[] {
  const parsed = campaignWorkflowsStore.getCampaignWorkflows<CampaignWorkflow>()

  // Ensure Legionella demo workflow exists
  const hasLegionellaWorkflow = parsed.some((w) => w?.id === 'legionella-demo-workflow')
  if (!hasLegionellaWorkflow) {
    const updated = [...parsed, createLegionellaWorkflow()]
    campaignWorkflowsStore.setCampaignWorkflows(updated)
    return updated
  }

  return parsed
}

function CampaignSequencesTab() {
  const customerId = settingsStore.getCurrentCustomerId('prod-customer-1') || ''
  const [workflows, setWorkflows] = useState<CampaignWorkflow[]>(() => loadWorkflowsFromStore())
  const [templates, setTemplates] = useState<SavedEmailTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure()
  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onClose: onEditClose,
  } = useDisclosure()
  const [workflowToDelete, setWorkflowToDelete] = useState<CampaignWorkflow | null>(null)
  const [workflowToEdit, setWorkflowToEdit] = useState<CampaignWorkflow | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const toast = useToast()
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Template modals
  const {
    isOpen: isTemplateModalOpen,
    onOpen: onTemplateModalOpen,
    onClose: onTemplateModalClose,
  } = useDisclosure()
  const {
    isOpen: isTemplateDeleteOpen,
    onOpen: onTemplateDeleteOpen,
    onClose: onTemplateDeleteClose,
  } = useDisclosure()
  const [templateToDelete, setTemplateToDelete] = useState<SavedEmailTemplate | null>(null)
  const [templateToEdit, setTemplateToEdit] = useState<SavedEmailTemplate | null>(null)
  const [isTemplateEditMode, setIsTemplateEditMode] = useState(false)
  const templateCancelRef = useRef<HTMLButtonElement>(null)

  // Load accounts from store (and keep in sync across tabs)
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([])

  useEffect(() => {
    const compute = () => {
      const storedAccounts = accountsStore.getAccounts<{ name: string }>()
      const storedNames = storedAccounts.map((a) => a?.name).filter(Boolean) as string[]
      const defaultNames = accounts.map((acc) => acc.name)
      return Array.from(new Set([...storedNames, ...defaultNames])).sort((a, b) => a.localeCompare(b))
    }

    setAvailableAccounts(compute())
    const off = accountsStore.onAccountsUpdated(() => setAvailableAccounts(compute()))
    return () => off()
  }, [])

  // Persist workflows immediately (and broadcast cross-tab)
  useEffect(() => {
    campaignWorkflowsStore.setCampaignWorkflows(workflows)
  }, [workflows])

  // Load templates from DB when customer is selected (tenant-safe)
  const fetchTemplates = useCallback(async () => {
    if (!customerId) {
      setTemplates([])
      setTemplatesError(null)
      return
    }
    setTemplatesLoading(true)
    setTemplatesError(null)
    const headers = { 'X-Customer-Id': customerId }
    const { data, error } = await api.get<Array<{ id: string; name: string; subjectTemplate: string; bodyTemplateHtml: string; bodyTemplateText?: string | null; stepNumber: number; createdAt: string; updatedAt: string }>>('/api/templates', { headers })
    if (error) {
      setTemplatesError(error)
      setTemplates([])
      toast({ title: 'Error loading templates', description: error, status: 'error' })
    } else if (data) {
      setTemplates(
        data.map((t) => ({
          id: t.id,
          name: t.name || '',
          subject: t.subjectTemplate || '',
          body: t.bodyTemplateText || t.bodyTemplateHtml || '',
          account: undefined,
          stepNumber: (t.stepNumber === 2 ? 2 : 1) as 1 | 2,
          createdAt: t.createdAt || new Date().toISOString(),
          updatedAt: t.updatedAt || new Date().toISOString(),
        }))
      )
    }
    setTemplatesLoading(false)
  }, [customerId, toast])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Form state
  const [newWorkflow, setNewWorkflow] = useState<Omit<CampaignWorkflow, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    description: '',
    account: '',
    firstEmail: defaultFirstEmailTemplate,
    secondEmail: defaultSecondEmailTemplate,
    daysBetweenEmails: 3,
    status: 'Draft',
  })

  const handleCreateWorkflow = () => {
    // Validate required fields
    if (!newWorkflow.name || !newWorkflow.firstEmail.subject || !newWorkflow.secondEmail.subject) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in workflow name and both email subjects',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Create new workflow
    const workflowId = Date.now().toString()
    const now = new Date().toISOString()
    const workflow: CampaignWorkflow = {
      id: workflowId,
      ...newWorkflow,
      createdAt: now,
      updatedAt: now,
    }

    // Add to workflows
    setWorkflows([...workflows, workflow])

    // Reset form
    setNewWorkflow({
      name: '',
      description: '',
      account: '',
      firstEmail: defaultFirstEmailTemplate,
      secondEmail: defaultSecondEmailTemplate,
      daysBetweenEmails: 3,
      status: 'Draft',
    })

    // Close modal
    onClose()

    // Show success toast
    toast({
      title: 'Workflow Created',
      description: `${workflow.name} has been successfully created`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  const handleEditClick = (workflow: CampaignWorkflow) => {
    setWorkflowToEdit(workflow)
    setIsEditMode(true)
    setNewWorkflow({
      name: workflow.name,
      description: workflow.description,
      account: workflow.account || '',
      firstEmail: workflow.firstEmail,
      secondEmail: workflow.secondEmail,
      daysBetweenEmails: workflow.daysBetweenEmails,
      status: workflow.status,
    })
    onEditOpen()
  }

  const handleUpdateWorkflow = () => {
    if (!workflowToEdit) return

    // Validate required fields
    if (!newWorkflow.name || !newWorkflow.firstEmail.subject || !newWorkflow.secondEmail.subject) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in workflow name and both email subjects',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Update workflow
    const updatedWorkflow: CampaignWorkflow = {
      ...workflowToEdit,
      ...newWorkflow,
      updatedAt: new Date().toISOString(),
    }

    // Update in workflows array
    setWorkflows(workflows.map((w) => (w.id === workflowToEdit.id ? updatedWorkflow : w)))

    // Reset form and state
    setNewWorkflow({
      name: '',
      description: '',
      account: '',
      firstEmail: defaultFirstEmailTemplate,
      secondEmail: defaultSecondEmailTemplate,
      daysBetweenEmails: 3,
      status: 'Draft',
    })
    setWorkflowToEdit(null)
    setIsEditMode(false)
    onEditClose()

    // Show success toast
    toast({
      title: 'Workflow Updated',
      description: `${updatedWorkflow.name} has been successfully updated`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  const handleCloseModal = () => {
    // Reset form and state
    setNewWorkflow({
      name: '',
      description: '',
      account: '',
      firstEmail: defaultFirstEmailTemplate,
      secondEmail: defaultSecondEmailTemplate,
      daysBetweenEmails: 3,
      status: 'Draft',
    })
    setWorkflowToEdit(null)
    setIsEditMode(false)
    onClose()
    onEditClose()
  }

  const handleDeleteClick = (workflow: CampaignWorkflow) => {
    setWorkflowToDelete(workflow)
    onDeleteOpen()
  }

  const handleDeleteConfirm = () => {
    if (workflowToDelete) {
      setWorkflows(workflows.filter((w) => w.id !== workflowToDelete.id))
      toast({
        title: 'Workflow Deleted',
        description: `${workflowToDelete.name} has been permanently deleted`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
      setWorkflowToDelete(null)
      onDeleteClose()
    }
  }

  const updateEmailTemplate = (stepNumber: 1 | 2, field: 'subject' | 'body', value: string) => {
    if (stepNumber === 1) {
      setNewWorkflow({
        ...newWorkflow,
        firstEmail: {
          ...newWorkflow.firstEmail,
          [field]: value,
        },
      })
    } else {
      setNewWorkflow({
        ...newWorkflow,
        secondEmail: {
          ...newWorkflow.secondEmail,
          [field]: value,
        },
      })
    }
  }

  const getStatusColor = (status: CampaignWorkflow['status']) => {
    switch (status) {
      case 'Active':
        return 'green'
      case 'Paused':
        return 'orange'
      case 'Draft':
        return 'gray'
      default:
        return 'gray'
    }
  }

  // Template form state
  const [newTemplate, setNewTemplate] = useState<Omit<SavedEmailTemplate, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    subject: '',
    body: '',
    account: '',
    stepNumber: 1,
  })

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.body) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in template name, subject, and body',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }
    if (!customerId) {
      toast({ title: 'No customer selected', description: 'Select a customer to create templates.', status: 'error' })
      return
    }

    const headers = { 'X-Customer-Id': customerId }
    const payload = {
      name: newTemplate.name.trim(),
      subjectTemplate: newTemplate.subject.trim(),
      bodyTemplateHtml: newTemplate.body,
      bodyTemplateText: newTemplate.body,
      stepNumber: newTemplate.stepNumber,
    }
    const { data, error } = await api.post<SavedEmailTemplate>('/api/templates', payload, { headers })
    if (error) {
      toast({ title: 'Failed to create template', description: error, status: 'error' })
      return
    }
    setNewTemplate({ name: '', subject: '', body: '', account: '', stepNumber: 1 })
    onTemplateModalClose()
    await fetchTemplates()
    toast({
      title: 'Template Created',
      description: `${newTemplate.name} has been successfully created`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  const handleEditTemplateClick = (template: SavedEmailTemplate) => {
    setTemplateToEdit(template)
    setIsTemplateEditMode(true)
    setNewTemplate({
      name: template.name,
      subject: template.subject,
      body: template.body,
      account: template.account || '',
      stepNumber: template.stepNumber,
    })
    onTemplateModalOpen()
  }

  const handleUpdateTemplate = async () => {
    if (!templateToEdit) return

    if (!newTemplate.name || !newTemplate.subject || !newTemplate.body) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in template name, subject, and body',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }
    if (!customerId) {
      toast({ title: 'No customer selected', description: 'Select a customer to update templates.', status: 'error' })
      return
    }

    const headers = { 'X-Customer-Id': customerId }
    const payload = {
      name: newTemplate.name.trim(),
      subjectTemplate: newTemplate.subject.trim(),
      bodyTemplateHtml: newTemplate.body,
      bodyTemplateText: newTemplate.body,
      stepNumber: newTemplate.stepNumber,
    }
    const { error } = await api.patch(`/api/templates/${templateToEdit.id}`, payload, { headers })
    if (error) {
      toast({ title: 'Failed to update template', description: error, status: 'error' })
      return
    }
    setNewTemplate({ name: '', subject: '', body: '', account: '', stepNumber: 1 })
    setTemplateToEdit(null)
    setIsTemplateEditMode(false)
    onTemplateModalClose()
    await fetchTemplates()
    toast({
      title: 'Template Updated',
      description: `${newTemplate.name} has been successfully updated`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  const handleCloseTemplateModal = () => {
    setNewTemplate({
      name: '',
      subject: '',
      body: '',
      account: '',
      stepNumber: 1,
    })
    setTemplateToEdit(null)
    setIsTemplateEditMode(false)
    onTemplateModalClose()
  }

  const handleDeleteTemplateClick = (template: SavedEmailTemplate) => {
    setTemplateToDelete(template)
    onTemplateDeleteOpen()
  }

  const handleDeleteTemplateConfirm = async () => {
    if (!templateToDelete) return
    if (!customerId) {
      toast({ title: 'No customer selected', description: 'Select a customer to delete templates.', status: 'error' })
      return
    }
    const headers = { 'X-Customer-Id': customerId }
    const { error } = await api.delete(`/api/templates/${templateToDelete.id}`, { headers })
    if (error) {
      toast({ title: 'Failed to delete template', description: error, status: 'error' })
      return
    }
    setTemplateToDelete(null)
    onTemplateDeleteClose()
    await fetchTemplates()
    toast({
      title: 'Template Deleted',
      description: `${templateToDelete.name} has been permanently deleted`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  return (
    <Stack spacing={6}>
      <Box>
        <Heading size="lg" mb={2}>
          Campaign Sequences
        </Heading>
        <Text color="gray.600">
          Create and manage 2-step email workflows with customizable templates
        </Text>
      </Box>

      <Tabs colorScheme="gray">
        <TabList>
          <Tab>Workflows</Tab>
          <Tab>Templates</Tab>
        </TabList>

        <TabPanels>
          {/* Workflows Tab */}
          <TabPanel>
            <Stack spacing={6}>
              <HStack justify="flex-end">
                <Button leftIcon={<AddIcon />} colorScheme="gray" onClick={onOpen}>
                  Create Workflow
                </Button>
              </HStack>

      {workflows.length === 0 ? (
        <Box
          textAlign="center"
          py={12}
          bg="white"
          borderRadius="lg"
          border="1px solid"
          borderColor="gray.200"
        >
          <Icon as={MdEmail} boxSize={12} color="gray.400" mx="auto" mb={4} />
          <Text fontSize="lg" color="gray.600" mb={2}>
            No workflows yet
          </Text>
          <Text fontSize="sm" color="gray.500" mb={4}>
            Create your first email campaign workflow to get started
          </Text>
          <Button leftIcon={<AddIcon />} colorScheme="gray" onClick={onOpen}>
            Create Your First Workflow
          </Button>
        </Box>
      ) : (
        <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" boxShadow="sm">
          <Table variant="simple">
            <Thead bg="gray.50">
              <Tr>
                <Th>Workflow Name</Th>
                <Th>Account</Th>
                <Th>Status</Th>
                <Th>Scheduled Dates</Th>
                <Th>Days Between</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {workflows.map((workflow) => (
                <Tr key={workflow.id}>
                  <Td>
                    <VStack align="flex-start" spacing={1}>
                      <Heading size="sm">{workflow.name}</Heading>
                      {workflow.description && (
                        <Text fontSize="xs" color="gray.500" noOfLines={1}>
                          {workflow.description}
                        </Text>
                      )}
                    </VStack>
                  </Td>
                  <Td>
                    {workflow.account ? (
                      <Badge colorScheme="gray">{workflow.account}</Badge>
                    ) : (
                      <Text fontSize="sm" color="gray.400" fontStyle="italic">
                        Not linked
                      </Text>
                    )}
                  </Td>
                  <Td>
                    <Badge colorScheme={getStatusColor(workflow.status)}>{workflow.status}</Badge>
                  </Td>
                  <Td>
                    {workflow.firstEmailScheduledDate && workflow.secondEmailScheduledDate ? (
                      <VStack align="flex-start" spacing={1}>
                        <Text fontSize="xs" color="gray.600">
                          <strong>1st:</strong>{' '}
                          {new Date(workflow.firstEmailScheduledDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                        <Text fontSize="xs" color="gray.600">
                          <strong>2nd:</strong>{' '}
                          {new Date(workflow.secondEmailScheduledDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </VStack>
                    ) : (
                      <Text fontSize="sm" color="gray.400" fontStyle="italic">
                        Not scheduled
                      </Text>
                    )}
                  </Td>
                  <Td>
                    <Text fontSize="sm">{workflow.daysBetweenEmails} days</Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm" color="gray.600">
                      {new Date(workflow.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      <IconButton
                        aria-label="Edit workflow"
                        icon={<EditIcon />}
                        size="sm"
                        colorScheme="gray"
                        variant="ghost"
                        onClick={() => handleEditClick(workflow)}
                      />
                      <IconButton
                        aria-label="Delete workflow"
                        icon={<DeleteIcon />}
                        size="sm"
                        colorScheme="gray"
                        variant="ghost"
                        onClick={() => handleDeleteClick(workflow)}
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
            </Stack>
          </TabPanel>

          {/* Templates Tab */}
          <TabPanel>
            <Stack spacing={6}>
              {!customerId && (
                <Box p={4} bg="orange.50" borderRadius="md" borderWidth="1px" borderColor="orange.200">
                  <Text>Select a customer to view and manage templates.</Text>
                </Box>
              )}
              <HStack justify="flex-end">
                <Button leftIcon={<AddIcon />} colorScheme="gray" onClick={onTemplateModalOpen} isDisabled={!customerId}>
                  Create Template
                </Button>
              </HStack>

              {templates.length === 0 && !templatesLoading ? (
                <Box
                  textAlign="center"
                  py={12}
                  bg="white"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                >
                  <Icon as={MdEmail} boxSize={12} color="gray.400" mx="auto" mb={4} />
                  <Text fontSize="lg" color="gray.600" mb={2}>
                    No templates yet
                  </Text>
                  <Text fontSize="sm" color="gray.500" mb={4}>
                    {customerId ? 'Create your first email template to get started' : 'Select a customer first.'}
                  </Text>
                  {customerId && (
                    <Button leftIcon={<AddIcon />} colorScheme="gray" onClick={onTemplateModalOpen}>
                      Create Your First Template
                    </Button>
                  )}
                </Box>
              ) : (
                <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" boxShadow="sm">
                  <Table variant="simple">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Template Name</Th>
                        <Th>Account</Th>
                        <Th>Step</Th>
                        <Th>Subject</Th>
                        <Th>Created</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {templates.map((template) => (
                        <Tr key={template.id}>
                          <Td>
                            <Heading size="sm">{template.name}</Heading>
                          </Td>
                          <Td>
                            {template.account ? (
                              <Badge colorScheme="gray">{template.account}</Badge>
                            ) : (
                              <Text fontSize="sm" color="gray.400" fontStyle="italic">
                                Not linked
                              </Text>
                            )}
                          </Td>
                          <Td>
                            <Badge colorScheme={template.stepNumber === 1 ? 'blue' : 'purple'}>
                              Step {template.stepNumber}
                            </Badge>
                          </Td>
                          <Td>
                            <Text fontSize="sm" noOfLines={1}>
                              {template.subject}
                            </Text>
                          </Td>
                          <Td>
                            <Text fontSize="sm" color="gray.600">
                              {new Date(template.createdAt).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </Text>
                          </Td>
                          <Td>
                            <HStack spacing={2}>
                              <IconButton
                                aria-label="Edit template"
                                icon={<EditIcon />}
                                size="sm"
                                colorScheme="gray"
                                variant="ghost"
                                onClick={() => handleEditTemplateClick(template)}
                              />
                              <IconButton
                                aria-label="Delete template"
                                icon={<DeleteIcon />}
                                size="sm"
                                colorScheme="gray"
                                variant="ghost"
                                onClick={() => handleDeleteTemplateClick(template)}
                              />
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              )}
            </Stack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Create/Edit Workflow Modal */}
      <Modal
        isOpen={isOpen || isEditOpen}
        onClose={handleCloseModal}
        size="6xl"
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent maxH="90vh">
          <ModalHeader>{isEditMode ? 'Edit Workflow' : 'Create New Workflow'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto" maxH="calc(90vh - 120px)">
            <Stack spacing={6}>
              {/* Basic Information */}
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                <FormControl isRequired>
                  <FormLabel>Workflow Name</FormLabel>
                  <Input
                    value={newWorkflow.name}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                    placeholder="e.g., Q1 2025 Outreach Campaign"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Account (Optional)</FormLabel>
                  <Select
                    value={newWorkflow.account}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, account: e.target.value })}
                    placeholder="Select an account (coming soon)"
                  >
                    {availableAccounts.map((account) => (
                      <option key={account} value={account}>
                        {account}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </SimpleGrid>

              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  value={newWorkflow.description}
                  onChange={(e) =>
                    setNewWorkflow({ ...newWorkflow, description: e.target.value })
                  }
                  placeholder="Describe the purpose of this workflow..."
                  rows={2}
                />
              </FormControl>

              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                <FormControl>
                  <FormLabel>Days Between Emails</FormLabel>
                  <NumberInput
                    value={newWorkflow.daysBetweenEmails}
                    onChange={(_, value) =>
                      setNewWorkflow({ ...newWorkflow, daysBetweenEmails: value || 3 })
                    }
                    min={1}
                    max={30}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={newWorkflow.status}
                    onChange={(e) =>
                      setNewWorkflow({
                        ...newWorkflow,
                        status: e.target.value as CampaignWorkflow['status'],
                      })
                    }
                  >
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                    <option value="Paused">Paused</option>
                  </Select>
                </FormControl>
              </SimpleGrid>

              <Divider />

              {/* First Email Template */}
              <Box>
                <Heading size="md" mb={4}>
                  First Email Template
                </Heading>
                <Stack spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Email Subject</FormLabel>
                    <Input
                      value={newWorkflow.firstEmail.subject}
                      onChange={(e) => updateEmailTemplate(1, 'subject', e.target.value)}
                      placeholder="e.g., Introduction - {{accountName}}"
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Available variables: {'{{contactName}}'}, {'{{accountName}}'}, {'{{senderName}}'}
                    </Text>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Email Body</FormLabel>
                    <Textarea
                      value={newWorkflow.firstEmail.body}
                      onChange={(e) => updateEmailTemplate(1, 'body', e.target.value)}
                      placeholder="Enter email body..."
                      rows={10}
                      fontFamily="mono"
                      fontSize="sm"
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Use variables like {'{{contactName}}'}, {'{{accountName}}'}, {'{{senderName}}'} in your template
                    </Text>
                  </FormControl>
                </Stack>
              </Box>

              <Divider />

              {/* Second Email Template */}
              <Box>
                <Heading size="md" mb={4}>
                  Second Email Template
                </Heading>
                <Stack spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Email Subject</FormLabel>
                    <Input
                      value={newWorkflow.secondEmail.subject}
                      onChange={(e) => updateEmailTemplate(2, 'subject', e.target.value)}
                      placeholder="e.g., Following up - {{accountName}}"
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Available variables: {'{{contactName}}'}, {'{{accountName}}'}, {'{{senderName}}'}
                    </Text>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Email Body</FormLabel>
                    <Textarea
                      value={newWorkflow.secondEmail.body}
                      onChange={(e) => updateEmailTemplate(2, 'body', e.target.value)}
                      placeholder="Enter email body..."
                      rows={10}
                      fontFamily="mono"
                      fontSize="sm"
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Use variables like {'{{contactName}}'}, {'{{accountName}}'}, {'{{senderName}}'} in your template
                    </Text>
                  </FormControl>
                </Stack>
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              colorScheme="gray"
              onClick={isEditMode ? handleUpdateWorkflow : handleCreateWorkflow}
            >
              {isEditMode ? 'Save Changes' : 'Create Workflow'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog isOpen={isDeleteOpen} onClose={onDeleteClose} leastDestructiveRef={cancelRef}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Workflow
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete {workflowToDelete?.name}? This action cannot be undone
              and the workflow will be permanently removed.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="gray" onClick={handleDeleteConfirm} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Create/Edit Template Modal */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={handleCloseTemplateModal}
        size="4xl"
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent maxH="90vh">
          <ModalHeader>
            {isTemplateEditMode ? 'Edit Template' : 'Create New Template'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto" maxH="calc(90vh - 120px)">
            <Stack spacing={4}>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                <FormControl isRequired>
                  <FormLabel>Template Name</FormLabel>
                  <Input
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="e.g., Introduction Email Template"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Account (Optional)</FormLabel>
                  <Select
                    value={newTemplate.account}
                    onChange={(e) => setNewTemplate({ ...newTemplate, account: e.target.value })}
                    placeholder="Select an account"
                  >
                    {availableAccounts.map((account) => (
                      <option key={account} value={account}>
                        {account}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                <FormControl>
                  <FormLabel>Step Number</FormLabel>
                  <Select
                    value={newTemplate.stepNumber}
                    onChange={(e) =>
                      setNewTemplate({
                        ...newTemplate,
                        stepNumber: parseInt(e.target.value) as 1 | 2,
                      })
                    }
                  >
                    <option value={1}>Step 1 - First Email</option>
                    <option value={2}>Step 2 - Follow-up Email</option>
                  </Select>
                </FormControl>
              </SimpleGrid>

              <FormControl isRequired>
                <FormLabel>Email Subject</FormLabel>
                <Input
                  value={newTemplate.subject}
                  onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                  placeholder="e.g., Introduction - {{accountName}}"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Available variables: {'{{contactName}}'}, {'{{accountName}}'}, {'{{Your_Name}}'}, {'{{Your_Company}}'}
                </Text>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Email Body</FormLabel>
                <Textarea
                  value={newTemplate.body}
                  onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                  placeholder="Enter email body..."
                  rows={12}
                  fontFamily="mono"
                  fontSize="sm"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Use variables like {'{{contactName}}'}, {'{{accountName}}'}, {'{{Your_Name}}'}, {'{{Your_Company}}'} in your template
                </Text>
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleCloseTemplateModal}>
              Cancel
            </Button>
            <Button
              colorScheme="gray"
              onClick={isTemplateEditMode ? handleUpdateTemplate : handleCreateTemplate}
            >
              {isTemplateEditMode ? 'Save Changes' : 'Create Template'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Template Confirmation Dialog */}
      <AlertDialog
        isOpen={isTemplateDeleteOpen}
        onClose={onTemplateDeleteClose}
        leastDestructiveRef={templateCancelRef}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Template
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete {templateToDelete?.name}? This action cannot be undone
              and the template will be permanently removed.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={templateCancelRef} onClick={onTemplateDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="gray" onClick={handleDeleteTemplateConfirm} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Stack>
  )
}

export default CampaignSequencesTab
