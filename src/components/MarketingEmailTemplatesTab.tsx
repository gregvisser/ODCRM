import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Button,
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
import { OdcrmStorageKeys } from '../platform/keys'
import { getJson } from '../platform/storage'
import { getEmailTemplates, setEmailTemplates, type OdcrmEmailTemplate } from '../platform/stores/emailTemplates'

function buildDefaultTemplates(): OdcrmEmailTemplate[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'default-step1',
      name: 'OpenDoors Default - Step 1',
      subject: 'Quick question about {{accountName}}',
      body: `Hi {{contactName}},

I’m {{senderName}} from OpenDoors.

We’re currently working with teams like {{accountName}} to improve outbound performance and reply rates.

Open to a quick 10-minute chat this week?

Best regards,
{{senderName}}`,
      stepNumber: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default-step2',
      name: 'OpenDoors Default - Step 2',
      subject: 'Following up — {{accountName}}',
      body: `Hi {{contactName}},

Just following up in case my previous email got buried.

If it’s easier, I can send a 2–3 line summary tailored to {{accountName}}.

Would you like that?

Thanks,
{{senderName}}`,
      stepNumber: 2,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export default function MarketingEmailTemplatesTab() {
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure()
  const cancelRef = useRef<HTMLButtonElement>(null)

  const [templates, setTemplatesState] = useState<OdcrmEmailTemplate[]>(() => {
    const existing = getEmailTemplates()
    if (existing.length > 0) return existing
    const seeded = buildDefaultTemplates()
    setEmailTemplates(seeded)
    return seeded
  })

  const [filterAccount, setFilterAccount] = useState<string>('__all__')
  const [templateToDelete, setTemplateToDelete] = useState<OdcrmEmailTemplate | null>(null)
  const [templateToEdit, setTemplateToEdit] = useState<OdcrmEmailTemplate | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  const [draft, setDraft] = useState<Omit<OdcrmEmailTemplate, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    subject: '',
    body: '',
    stepNumber: 1,
    account: '',
  })

  // Persist templates any time they change.
  useEffect(() => {
    setEmailTemplates(templates)
  }, [templates])

  const availableAccounts = useMemo(() => {
    const accounts = getJson<Array<{ name: string }>>(OdcrmStorageKeys.accounts) || []
    const names = accounts.map((a) => a?.name).filter(Boolean)
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
  }, [])

  const filteredTemplates = useMemo(() => {
    const list = [...templates]
    if (filterAccount === '__all__') return list
    if (filterAccount === '__global__') return list.filter((t) => !t.account)
    return list.filter((t) => (t.account || '').toLowerCase() === filterAccount.toLowerCase())
  }, [templates, filterAccount])

  const openCreate = () => {
    setIsEditMode(false)
    setTemplateToEdit(null)
    setDraft({ name: '', subject: '', body: '', stepNumber: 1, account: '' })
    onOpen()
  }

  const openEdit = (t: OdcrmEmailTemplate) => {
    setIsEditMode(true)
    setTemplateToEdit(t)
    setDraft({
      name: t.name,
      subject: t.subject,
      body: t.body,
      stepNumber: t.stepNumber,
      account: t.account || '',
    })
    onOpen()
  }

  const save = () => {
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

    const now = new Date().toISOString()
    if (isEditMode && templateToEdit) {
      const updated: OdcrmEmailTemplate = {
        ...templateToEdit,
        ...draft,
        account: draft.account?.trim() || undefined,
        updatedAt: now,
      }
      setTemplatesState((prev) => prev.map((t) => (t.id === templateToEdit.id ? updated : t)))
      toast({ title: 'Template updated', status: 'success', duration: 1500 })
    } else {
      const created: OdcrmEmailTemplate = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...draft,
        account: draft.account?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      }
      setTemplatesState((prev) => [created, ...prev])
      toast({ title: 'Template created', status: 'success', duration: 1500 })
    }

    onClose()
  }

  const requestDelete = (t: OdcrmEmailTemplate) => {
    setTemplateToDelete(t)
    onDeleteOpen()
  }

  const confirmDelete = () => {
    if (!templateToDelete) return
    setTemplatesState((prev) => prev.filter((t) => t.id !== templateToDelete.id))
    toast({ title: 'Template deleted', status: 'success', duration: 1500 })
    setTemplateToDelete(null)
    onDeleteClose()
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
              {availableAccounts.map((name) => (
                <option key={name} value={name}>
                  {name}
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
                      {t.account ? (
                        <Badge colorScheme="gray">{t.account}</Badge>
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
                        {t.subject}
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
                    value={draft.account || ''}
                    onChange={(e) => setDraft({ ...draft, account: e.target.value })}
                    placeholder="Global (no customer)"
                  >
                    {availableAccounts.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
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


