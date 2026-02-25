import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons'
import { api } from '../utils/api'
import { getCurrentCustomerId } from '../platform/stores/settings'

type EmailTemplate = {
  id: string
  customerId: string | null
  name: string
  subjectTemplate: string
  bodyTemplateHtml: string
  bodyTemplateText?: string | null
  stepNumber: number
  createdAt: string
  updatedAt: string
}

type Customer = { id: string; name: string }

export default function MarketingEmailTemplatesTab() {
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure()
  const cancelRef = useRef<HTMLButtonElement>(null)

  const [templates, setTemplatesState] = useState<EmailTemplate[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAccount, setFilterAccount] = useState<string>('__all__')
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null)
  const [templateToEdit, setTemplateToEdit] = useState<EmailTemplate | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  const [draft, setDraft] = useState<{
    name: string
    subject: string
    body: string
    stepNumber: number
    customerId: string | null
    isGlobal: boolean
  }>({
    name: '',
    subject: '',
    body: '',
    stepNumber: 1,
    customerId: null,
    isGlobal: false,
  })
  const customerLookup = useMemo(() => {
    return Object.fromEntries(customers.map((c) => [c.id, c.name]))
  }, [customers])

  const loadTemplates = async (activeCustomerId: string) => {
    const { data, error } = await api.get<EmailTemplate[]>(
      `/api/templates?customerId=${activeCustomerId}&includeGlobal=true`,
    )
    if (error) {
      toast({ title: 'Error loading templates', description: error, status: 'error' })
      return
    }
    setTemplatesState(data || [])
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await api.get<Customer[]>('/api/customers')
      if (error) {
        toast({ title: 'Error loading customers', description: error, status: 'error' })
        setLoading(false)
        return
      }
      const list = data || []
      setCustomers(list)
      const activeCustomerId =
        getCurrentCustomerId() ?? list[0]?.id ?? ''
      if (activeCustomerId) {
        await loadTemplates(activeCustomerId)
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredTemplates = useMemo(() => {
    const list = [...templates]
    if (filterAccount === '__all__') return list
    if (filterAccount === '__global__') return list.filter((t) => !t.customerId)
    return list.filter((t) => t.customerId === filterAccount)
  }, [templates, filterAccount])

  const openCreate = () => {
    setIsEditMode(false)
    setTemplateToEdit(null)
    setDraft({ name: '', subject: '', body: '', stepNumber: 1, customerId: null, isGlobal: false })
    onOpen()
  }

  const openEdit = (t: EmailTemplate) => {
    setIsEditMode(true)
    setTemplateToEdit(t)
    setDraft({
      name: t.name,
      subject: t.subjectTemplate,
      body: t.bodyTemplateHtml,
      stepNumber: t.stepNumber,
      customerId: t.customerId,
      isGlobal: !t.customerId,
    })
    onOpen()
  }

  const save = async () => {
    if (!draft.name.trim() || !draft.subject.trim() || !draft.body.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in template name, subject, and body.',
        status: 'error',
        duration: 2500,
        isClosable: true,
      })
      return
    }

    const activeCustomerId =
      getCurrentCustomerId() ?? customers[0]?.id ?? ''
    if (!activeCustomerId) {
      toast({ title: 'Missing client', description: 'Select a client first.', status: 'error' })
      return
    }

    if (isEditMode && templateToEdit) {
      const { error } = await api.patch(`/api/templates/${templateToEdit.id}?customerId=${activeCustomerId}`, {
        name: draft.name.trim(),
        subjectTemplate: draft.subject.trim(),
        bodyTemplateHtml: draft.body.trim(),
        bodyTemplateText: draft.body.trim(),
        stepNumber: draft.stepNumber,
        isGlobal: draft.isGlobal,
      })
      if (error) {
        toast({ title: 'Update failed', description: error, status: 'error' })
        return
      }
      toast({ title: 'Template updated', status: 'success', duration: 1500 })
    } else {
      const { error } = await api.post(`/api/templates?customerId=${activeCustomerId}`, {
        name: draft.name.trim(),
        subjectTemplate: draft.subject.trim(),
        bodyTemplateHtml: draft.body.trim(),
        bodyTemplateText: draft.body.trim(),
        stepNumber: draft.stepNumber,
        isGlobal: draft.isGlobal,
      })
      if (error) {
        toast({ title: 'Create failed', description: error, status: 'error' })
        return
      }
      toast({ title: 'Template created', status: 'success', duration: 1500 })
    }

    await loadTemplates(activeCustomerId)
    onClose()
  }

  const requestDelete = (t: EmailTemplate) => {
    setTemplateToDelete(t)
    onDeleteOpen()
  }

  const confirmDelete = async () => {
    if (!templateToDelete) return
    const activeCustomerId =
      getCurrentCustomerId() ?? customers[0]?.id ?? ''
    const { error } = await api.delete(`/api/templates/${templateToDelete.id}?customerId=${activeCustomerId}`)
    if (error) {
      toast({ title: 'Delete failed', description: error, status: 'error' })
      return
    }
    toast({ title: 'Template deleted', status: 'success', duration: 1500 })
    await loadTemplates(activeCustomerId)
    setTemplateToDelete(null)
    onDeleteClose()
  }

  const runGeminiEnhance = async () => {
    if (!enhanceGoal.trim() || !enhanceTone.trim()) {
      toast({ title: 'Required', description: 'Goal and tone are required.', status: 'warning' })
      return
    }
    const activeCustomerId = getCurrentCustomerId() ?? customers[0]?.id ?? ''
    if (!activeCustomerId) {
      toast({ title: 'Select client', description: 'Choose a client first.', status: 'warning' })
      return
    }
    setEnhanceLoading(true)
    setEnhanceError(null)
    const { data, error } = await api.post<{ enhancedSubject: string; enhancedBodyHtml: string; modelUsed: string }>(
      `/api/templates/gemini-enhance?customerId=${activeCustomerId}`,
      {
        goal: enhanceGoal.trim(),
        tone: enhanceTone.trim(),
        audience: enhanceAudience.trim() || undefined,
        subject: draft.subject || undefined,
        bodyHtml: draft.body || undefined,
      }
    )
    setEnhanceLoading(false)
    if (error) {
      setEnhanceError(error)
      if (error.includes('501') || error.includes('not configured')) {
        toast({ title: 'Feature not configured', description: 'Gemini API key is not set on the server.', status: 'info' })
      } else {
        toast({ title: 'Enhancement failed', description: error, status: 'error' })
      }
      return
    }
    if (data?.enhancedSubject != null) setDraft((d) => ({ ...d, subject: data.enhancedSubject }))
    if (data?.enhancedBodyHtml != null) setDraft((d) => ({ ...d, body: data.enhancedBodyHtml }))
    toast({ title: 'Enhanced', description: 'Subject and body updated. Review and save when ready.', status: 'success', duration: 2500 })
    onEnhanceClose()
  }

  return (
    <Stack spacing={6}>
      <Box>
        <Heading size="lg" mb={2}>
          Email Templates
        </Heading>
        <Text color="gray.600">
          Create customer-specific templates that OpenDoors users can pick for any step in a campaign sequence (up to 10 steps).
        </Text>
      </Box>

      <HStack justify="space-between" flexWrap="wrap">
        <HStack spacing={3}>
          <FormControl maxW="360px">
            <FormLabel fontSize="sm" mb={1}>
              Customer filter
            </FormLabel>
            <Select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} size="sm">
              <option value="__all__">All templates</option>
              <option value="__global__">Global (no customer)</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </FormControl>
        </HStack>
        <Button leftIcon={<AddIcon />} colorScheme="gray" onClick={openCreate} size="sm">
          Create Template
        </Button>
      </HStack>

      <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
        <Table variant="simple" size="sm">
          <Thead bg="gray.50">
            <Tr>
              <Th>Name</Th>
              <Th>Customer</Th>
              <Th>Step</Th>
              <Th>Subject</Th>
              <Th>Updated</Th>
              <Th textAlign="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredTemplates.length === 0 ? (
              <Tr>
                <Td colSpan={6}>
                  <Text color="gray.500" py={4}>
                    No templates yet for this filter.
                  </Text>
                </Td>
              </Tr>
            ) : (
              filteredTemplates
                .slice()
                .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
                .map((t) => (
                  <Tr key={t.id}>
                    <Td>
                      <Text fontWeight="semibold">{t.name}</Text>
                    </Td>
                    <Td>
                      {t.customerId ? (
                        <Badge colorScheme="gray">{customerLookup[t.customerId] || t.customerId}</Badge>
                      ) : (
                        <Text fontSize="sm" color="gray.400" fontStyle="italic">
                          Global
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <Badge colorScheme={t.stepNumber === 1 ? 'blue' : t.stepNumber === 2 ? 'purple' : 'gray'}>
                        Step {t.stepNumber}
                      </Badge>
                    </Td>
                    <Td>
                      <Text fontSize="sm" noOfLines={1} maxW="520px">
                        {t.subjectTemplate}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontSize="sm" color="gray.600">
                        {new Date(t.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </Td>
                    <Td textAlign="right">
                      <HStack justify="flex-end" spacing={2}>
                        <IconButton
                          aria-label="Edit template"
                          icon={<EditIcon />}
                          size="sm"
                          variant="ghost"
                          colorScheme="gray"
                          onClick={() => openEdit(t)}
                        />
                        <IconButton
                          aria-label="Delete template"
                          icon={<DeleteIcon />}
                          size="sm"
                          variant="ghost"
                          colorScheme="gray"
                          onClick={() => requestDelete(t)}
                        />
                      </HStack>
                    </Td>
                  </Tr>
                ))
            )}
          </Tbody>
        </Table>
      </Box>

      <Box fontSize="sm" color="gray.600">
        <Text fontWeight="semibold" mb={1}>
          Template variables (recommended)
        </Text>
        <Text>
          Use <code>{'{{senderName}}'}</code>, <code>{'{{contactName}}'}</code>, <code>{'{{accountName}}'}</code> in subjects/bodies.
        </Text>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent maxH="90vh">
          <ModalHeader>{isEditMode ? 'Edit Template' : 'Create Template'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Template name</FormLabel>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </FormControl>

              <HStack spacing={4} align="flex-start">
                <FormControl>
                  <FormLabel>Customer (optional)</FormLabel>
                  <Select
                    value={draft.customerId || ''}
                    onChange={(e) => setDraft({ ...draft, customerId: e.target.value || null, isGlobal: !e.target.value })}
                    placeholder="Global (no customer)"
                    isDisabled={draft.isGlobal}
                  >
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </Select>
                  <Checkbox
                    mt={2}
                    isChecked={draft.isGlobal}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        isGlobal: e.target.checked,
                        customerId: e.target.checked ? null : draft.customerId,
                      })
                    }
                  >
                    Global template
                  </Checkbox>
                </FormControl>
                <FormControl isRequired maxW="220px">
                  <FormLabel>Step</FormLabel>
                  <Select
                    value={String(draft.stepNumber)}
                    onChange={(e) => setDraft({ ...draft, stepNumber: Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
                  >
                    {Array.from({ length: 10 }).map((_, i) => {
                      const n = i + 1
                      return (
                        <option key={n} value={String(n)}>
                          Step {n}
                        </option>
                      )
                    })}
                  </Select>
                </FormControl>
              </HStack>

              <FormControl isRequired>
                <FormLabel>Subject</FormLabel>
                <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Body</FormLabel>
                <Textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  rows={12}
                  fontFamily="mono"
                  fontSize="sm"
                />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="gray" onClick={save}>
              {isEditMode ? 'Save changes' : 'Create template'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete template
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete <strong>{templateToDelete?.name}</strong>? This cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="gray" onClick={confirmDelete} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Stack>
  )
}


