/**
 * Sequences Builder UI
 * Ported from OpensDoorsV2 sequences/ui.tsx
 * Adapted to Chakra UI
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  HStack,
  VStack,
  Text,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  useToast,
  Spinner,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Divider,
  NumberInput,
  NumberInputField,
  Code,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react'
import { AddIcon, EditIcon, ViewIcon, DeleteIcon } from '@chakra-ui/icons'
import { getCurrentCustomerId } from '../platform/stores/settings'
import { api } from '../utils/api'

type SequenceStep = {
  id: string
  stepOrder: number
  delayDaysFromPrevious: number
  subjectTemplate: string
  bodyTemplateHtml: string
  bodyTemplateText?: string
  createdAt: string
  updatedAt: string
}

type Sequence = {
  id: string
  customerId: string
  name: string
  description?: string | null
  stepCount?: number
  createdAt: string
  updatedAt: string
  steps?: SequenceStep[]
}

type SequenceFormState = {
  id?: string
  name: string
  description: string
}

type StepFormState = {
  stepOrder: number
  delayDaysFromPrevious: number
  subjectTemplate: string
  bodyTemplateHtml: string
}

type DryRunStepPlan = {
  stepOrder: number
  delayDaysFromPrevious: number
  plannedSendAt: string
  subjectPreview: string
  bodyPreviewHtml: string
  wouldSendFromEmail: string
  provider: string
}

type DryRunContactPlan = {
  contactId: string
  email: string | null
  name: string
  suppressed: boolean
  suppressedReason?: string
  skippedReason?: string
  steps: DryRunStepPlan[]
}

type DryRunResult = {
  _dryRun: boolean
  _warning: string
  sequenceId: string
  sequenceName: string
  customerId: string
  asOf: string
  senderIdentity: { id: string; emailAddress: string; displayName?: string; provider: string }
  summary: {
    candidateCount: number
    eligibleCount: number
    suppressedCount: number
    enrolledSkippedCount: number
    plannedSendsCount: number
    stepCount: number
  }
  sample: DryRunContactPlan[]
}

export default function MarketingSequencesTab() {
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null)
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null)
  const [sequenceToDelete, setSequenceToDelete] = useState<Sequence | null>(null)
  const [customerId, setCustomerId] = useState<string>(
    getCurrentCustomerId('prod-customer-1')
  ) // TODO: Get from context

  const [sequenceForm, setSequenceForm] = useState<SequenceFormState>({
    name: '',
    description: '',
  })

  const [steps, setSteps] = useState<StepFormState[]>([
    { stepOrder: 1, delayDaysFromPrevious: 0, subjectTemplate: '', bodyTemplateHtml: '' },
  ])

  const [dryRunLoading, setDryRunLoading] = useState<string | null>(null) // sequenceId being run
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)

  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure()
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()
  const { isOpen: isDryRunOpen, onOpen: onDryRunOpen, onClose: onDryRunClose } = useDisclosure()
  
  const cancelRef = useRef<HTMLButtonElement>(null)
  const toast = useToast()

  const fetchSequences = useCallback(async () => {
    setLoading(true)
    const { data, error } = await api.get<Sequence[]>(`/api/sequences?customerId=${customerId}`)
    if (error) {
      toast({
        title: 'Error',
        description: error,
        status: 'error',
        duration: 3000,
      })
    } else if (data) {
      setSequences(data)
    }
    setLoading(false)
  }, [customerId, toast])

  useEffect(() => {
    if (customerId) {
      fetchSequences()
    }
  }, [customerId, fetchSequences])

  const handleCreateSequence = async () => {
    if (!sequenceForm.name.trim()) {
      toast({ title: 'Error', description: 'Sequence name is required', status: 'error' })
      return
    }

    const { error } = await api.post('/api/sequences', {
      customerId,
      name: sequenceForm.name,
      description: sequenceForm.description,
      steps: steps.map((step) => ({
        stepOrder: step.stepOrder,
        delayDaysFromPrevious: step.delayDaysFromPrevious,
        subjectTemplate: step.subjectTemplate,
        bodyTemplateHtml: step.bodyTemplateHtml,
      })),
    })

    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'Sequence created', status: 'success' })
      fetchSequences()
      onCreateClose()
      setSequenceForm({ name: '', description: '' })
      setSteps([{ stepOrder: 1, delayDaysFromPrevious: 0, subjectTemplate: '', bodyTemplateHtml: '' }])
    }
  }

  const handleViewSequence = async (sequence: Sequence) => {
    const { data, error } = await api.get<Sequence>(`/api/sequences/${sequence.id}`)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else if (data) {
      setSelectedSequence(data)
      onViewOpen()
    }
  }

  const handleDeleteClick = (sequence: Sequence) => {
    setSequenceToDelete(sequence)
    onDeleteOpen()
  }

  const handleDeleteConfirm = async () => {
    if (!sequenceToDelete) return

    const { error } = await api.delete(`/api/sequences/${sequenceToDelete.id}`)

    if (error) {
      toast({ title: 'Error', description: error, status: 'error', duration: 5000 })
    } else {
      toast({ title: 'Success', description: 'Sequence deleted', status: 'success' })
      onDeleteClose()
      fetchSequences()
    }
    setSequenceToDelete(null)
  }

  const handleDryRun = async (sequence: Sequence) => {
    setDryRunLoading(sequence.id)
    setDryRunResult(null)
    const { data, error } = await api.post<DryRunResult>(`/api/sequences/${sequence.id}/dry-run`, {
      limit: 10,
    })
    setDryRunLoading(null)
    if (error) {
      toast({ title: 'Dry-Run Error', description: error, status: 'error', duration: 5000 })
      return
    }
    if (data) {
      setDryRunResult(data)
      onDryRunOpen()
    }
  }

  const addStep = () => {
    const nextOrder = steps.length + 1
    setSteps([
      ...steps,
      {
        stepOrder: nextOrder,
        delayDaysFromPrevious: 3,
        subjectTemplate: '',
        bodyTemplateHtml: '',
      },
    ])
  }

  const removeStep = (index: number) => {
    if (steps.length === 1) {
      toast({ title: 'Error', description: 'Sequence must have at least one step', status: 'error' })
      return
    }
    setSteps(steps.filter((_, i) => i !== index))
  }

  const updateStep = (index: number, field: keyof StepFormState, value: any) => {
    const updated = [...steps]
    updated[index] = { ...updated[index], [field]: value }
    setSteps(updated)
  }

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
      </Box>
    )
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Box>
          <Heading size="lg">Sequences</Heading>
          <Text fontSize="sm" color="gray.600">
            Build multi-step email sequences for campaigns
          </Text>
        </Box>
        <Button leftIcon={<AddIcon />} colorScheme="teal" onClick={onCreateOpen}>
          Create Sequence
        </Button>
      </HStack>

      <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
        <Table size="sm">
          <Thead bg="gray.50">
            <Tr>
              <Th>Name</Th>
              <Th>Description</Th>
              <Th isNumeric>Steps</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {sequences.length === 0 ? (
              <Tr>
                <Td colSpan={5} textAlign="center" py={8}>
                  <Text color="gray.500">No sequences yet. Create your first sequence to get started.</Text>
                </Td>
              </Tr>
            ) : (
              sequences.map((sequence) => (
                <Tr key={sequence.id}>
                  <Td fontWeight="medium">{sequence.name}</Td>
                  <Td>
                    <Text fontSize="sm" color="gray.600" noOfLines={1}>
                      {sequence.description || '-'}
                    </Text>
                  </Td>
                  <Td isNumeric>
                    <Badge colorScheme="purple">{sequence.stepCount || 0}</Badge>
                  </Td>
                  <Td fontSize="sm" color="gray.600">
                    {new Date(sequence.createdAt).toLocaleDateString()}
                  </Td>
                  <Td>
                    <HStack spacing={1}>
                      <IconButton
                        aria-label="View sequence"
                        icon={<ViewIcon />}
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewSequence(sequence)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        colorScheme="orange"
                        isLoading={dryRunLoading === sequence.id}
                        loadingText="Running…"
                        onClick={() => handleDryRun(sequence)}
                        title="Preview what would be sent — no emails sent"
                      >
                        Dry Run
                      </Button>
                      <IconButton
                        aria-label="Delete sequence"
                        icon={<DeleteIcon />}
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => handleDeleteClick(sequence)}
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Box>

      {/* Create Sequence Modal */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="6xl">
        <ModalOverlay />
        <ModalContent maxH="90vh">
          <ModalHeader>Create Sequence</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto">
            <VStack spacing={6} align="stretch">
              {/* Sequence Details */}
              <Box>
                <FormControl isRequired mb={3}>
                  <FormLabel>Sequence Name</FormLabel>
                  <Input
                    value={sequenceForm.name}
                    onChange={(e) => setSequenceForm({ ...sequenceForm, name: e.target.value })}
                    placeholder="e.g., Tech CEOs Follow-up"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    value={sequenceForm.description}
                    onChange={(e) => setSequenceForm({ ...sequenceForm, description: e.target.value })}
                    placeholder="Optional description"
                    rows={2}
                  />
                </FormControl>
              </Box>

              <Divider />

              {/* Steps Builder */}
              <Box>
                <HStack justify="space-between" mb={3}>
                  <Text fontWeight="bold" fontSize="md">
                    Email Steps ({steps.length})
                  </Text>
                  <Button size="sm" leftIcon={<AddIcon />} onClick={addStep} colorScheme="blue">
                    Add Step
                  </Button>
                </HStack>

                <Text fontSize="xs" color="gray.600" mb={4}>
                  Available placeholders: <Code fontSize="xs">{'{{firstName}}'}</Code>,{' '}
                  <Code fontSize="xs">{'{{lastName}}'}</Code>, <Code fontSize="xs">{'{{company}}'}</Code>,{' '}
                  <Code fontSize="xs">{'{{email}}'}</Code>, <Code fontSize="xs">{'{{jobTitle}}'}</Code>
                </Text>

                <VStack spacing={4} align="stretch">
                  {steps.map((step, index) => (
                    <Box
                      key={index}
                      p={4}
                      border="2px solid"
                      borderColor="teal.200"
                      borderRadius="md"
                      bg="teal.50"
                    >
                      <HStack justify="space-between" mb={3}>
                        <Badge colorScheme="teal" fontSize="sm">
                          Step {step.stepOrder}
                        </Badge>
                        {steps.length > 1 && (
                          <IconButton
                            aria-label="Remove step"
                            icon={<DeleteIcon />}
                            size="xs"
                            colorScheme="red"
                            variant="ghost"
                            onClick={() => removeStep(index)}
                          />
                        )}
                      </HStack>

                      <VStack spacing={3} align="stretch">
                        <FormControl>
                          <FormLabel fontSize="sm">
                            Delay (days from previous step)
                            {step.stepOrder === 1 && <Text as="span" fontSize="xs" color="gray.500" ml={2}>(0 for immediate)</Text>}
                          </FormLabel>
                          <NumberInput
                            value={step.delayDaysFromPrevious}
                            onChange={(_, num) => updateStep(index, 'delayDaysFromPrevious', num || 0)}
                            min={0}
                            max={30}
                          >
                            <NumberInputField />
                          </NumberInput>
                        </FormControl>

                        <FormControl isRequired>
                          <FormLabel fontSize="sm">Subject Template</FormLabel>
                          <Input
                            value={step.subjectTemplate}
                            onChange={(e) => updateStep(index, 'subjectTemplate', e.target.value)}
                            placeholder="Hi {{firstName}}, question about {{company}}"
                            size="sm"
                          />
                        </FormControl>

                        <FormControl isRequired>
                          <FormLabel fontSize="sm">Email Body Template</FormLabel>
                          <Textarea
                            value={step.bodyTemplateHtml}
                            onChange={(e) => updateStep(index, 'bodyTemplateHtml', e.target.value)}
                            placeholder="Hi {{firstName}},&#10;&#10;I'm reaching out because..."
                            rows={6}
                            size="sm"
                            fontFamily="monospace"
                            fontSize="xs"
                          />
                        </FormControl>
                      </VStack>
                    </Box>
                  ))}
                </VStack>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateClose}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={handleCreateSequence}>
              Create Sequence
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* View Sequence Modal */}
      <Modal isOpen={isViewOpen} onClose={onViewClose} size="4xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <VStack align="start" spacing={1}>
              <Text>{selectedSequence?.name}</Text>
              <Text fontSize="sm" fontWeight="normal" color="gray.600">
                {selectedSequence?.description || 'No description'}
              </Text>
            </VStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Badge colorScheme="purple" fontSize="md" px={3} py={1} alignSelf="start">
                {selectedSequence?.steps?.length || 0} step(s)
              </Badge>

              {selectedSequence?.steps && selectedSequence.steps.length > 0 ? (
                <VStack spacing={3} align="stretch">
                  {selectedSequence.steps.map((step) => (
                    <Box
                      key={step.id}
                      p={4}
                      border="1px solid"
                      borderColor="gray.200"
                      borderRadius="md"
                      bg="gray.50"
                    >
                      <HStack justify="space-between" mb={2}>
                        <Badge colorScheme="teal">Step {step.stepOrder}</Badge>
                        <Badge colorScheme="blue">
                          {step.delayDaysFromPrevious === 0
                            ? 'Immediate'
                            : `+${step.delayDaysFromPrevious} day(s)`}
                        </Badge>
                      </HStack>
                      <VStack align="stretch" spacing={2}>
                        <Box>
                          <Text fontSize="xs" color="gray.600" fontWeight="bold">
                            Subject:
                          </Text>
                          <Text fontSize="sm">{step.subjectTemplate}</Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.600" fontWeight="bold">
                            Body:
                          </Text>
                          <Text
                            fontSize="sm"
                            whiteSpace="pre-wrap"
                            fontFamily="monospace"
                            bg="white"
                            p={2}
                            borderRadius="md"
                            maxH="200px"
                            overflowY="auto"
                          >
                            {step.bodyTemplateHtml}
                          </Text>
                        </Box>
                      </VStack>
                    </Box>
                  ))}
                </VStack>
              ) : (
                <Text color="gray.500" textAlign="center" py={4}>
                  No steps in this sequence
                </Text>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onViewClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete Sequence</AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete "{sequenceToDelete?.name}"? This cannot be undone, and campaigns
              using this sequence may be affected.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteConfirm} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Dry-Run Results Modal */}
      <Modal isOpen={isDryRunOpen} onClose={onDryRunClose} size="5xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent maxH="90vh">
          <ModalHeader>
            <VStack align="start" spacing={0}>
              <HStack>
                <Badge colorScheme="orange" fontSize="xs" px={2} py={0.5}>DRY RUN</Badge>
                <Text fontSize="lg">{dryRunResult?.sequenceName}</Text>
              </HStack>
              <Text fontSize="sm" fontWeight="normal" color="gray.500">
                Planning preview as of {dryRunResult ? new Date(dryRunResult.asOf).toLocaleString() : ''}
              </Text>
            </VStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {dryRunResult && (
              <VStack spacing={5} align="stretch">
                <Alert status="warning" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle fontSize="sm">No emails sent</AlertTitle>
                    <AlertDescription fontSize="xs">{dryRunResult._warning}</AlertDescription>
                  </Box>
                </Alert>

                {/* Sender identity */}
                <Box bg="gray.50" p={3} borderRadius="md" fontSize="sm">
                  <Text fontWeight="bold" mb={1}>Would send from:</Text>
                  <Text>
                    {dryRunResult.senderIdentity.displayName
                      ? `${dryRunResult.senderIdentity.displayName} <${dryRunResult.senderIdentity.emailAddress}>`
                      : dryRunResult.senderIdentity.emailAddress}
                    {' '}
                    <Badge colorScheme="blue" fontSize="xs">{dryRunResult.senderIdentity.provider}</Badge>
                  </Text>
                </Box>

                {/* Summary stats */}
                <StatGroup borderWidth="1px" borderRadius="md" p={3}>
                  <Stat>
                    <StatLabel fontSize="xs">Candidates</StatLabel>
                    <StatNumber fontSize="xl">{dryRunResult.summary.candidateCount}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel fontSize="xs">Eligible</StatLabel>
                    <StatNumber fontSize="xl" color="green.600">{dryRunResult.summary.eligibleCount}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel fontSize="xs">Suppressed</StatLabel>
                    <StatNumber fontSize="xl" color={dryRunResult.summary.suppressedCount > 0 ? 'red.500' : 'gray.400'}>
                      {dryRunResult.summary.suppressedCount}
                    </StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel fontSize="xs">Already Enrolled</StatLabel>
                    <StatNumber fontSize="xl" color="gray.500">{dryRunResult.summary.enrolledSkippedCount}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel fontSize="xs">Total Sends Planned</StatLabel>
                    <StatNumber fontSize="xl" color="teal.600">{dryRunResult.summary.plannedSendsCount}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel fontSize="xs">Steps</StatLabel>
                    <StatNumber fontSize="xl">{dryRunResult.summary.stepCount}</StatNumber>
                  </Stat>
                </StatGroup>

                <Divider />

                {/* Per-contact plan */}
                <Box>
                  <Text fontWeight="bold" mb={2} fontSize="sm">
                    Contact Sample ({Array.isArray(dryRunResult.sample) ? dryRunResult.sample.length : 0} shown)
                  </Text>
                  {Array.isArray(dryRunResult.sample) && dryRunResult.sample.length > 0 ? (
                    <Accordion allowMultiple>
                      {dryRunResult.sample.map((contact, i) => (
                        <AccordionItem key={contact.contactId} borderColor="gray.200">
                          <AccordionButton py={2}>
                            <HStack flex="1" textAlign="left" spacing={2}>
                              {contact.suppressed ? (
                                <Badge colorScheme="red" fontSize="xs">SUPPRESSED</Badge>
                              ) : contact.skippedReason ? (
                                <Badge colorScheme="gray" fontSize="xs">SKIPPED</Badge>
                              ) : (
                                <Badge colorScheme="green" fontSize="xs">ELIGIBLE</Badge>
                              )}
                              <Text fontSize="sm" fontWeight="medium">{contact.name || contact.email}</Text>
                              <Text fontSize="xs" color="gray.500">{contact.email}</Text>
                              {(contact.suppressedReason || contact.skippedReason) && (
                                <Text fontSize="xs" color="red.500">— {contact.suppressedReason || contact.skippedReason}</Text>
                              )}
                              {!contact.suppressed && !contact.skippedReason && (
                                <Text fontSize="xs" color="gray.400">
                                  {Array.isArray(contact.steps) ? contact.steps.length : 0} step(s) planned
                                </Text>
                              )}
                            </HStack>
                            <AccordionIcon />
                          </AccordionButton>
                          <AccordionPanel pb={3} bg="gray.50">
                            {contact.suppressed || contact.skippedReason ? (
                              <Text fontSize="sm" color="gray.500">
                                {contact.suppressedReason || contact.skippedReason || 'Excluded'}
                              </Text>
                            ) : Array.isArray(contact.steps) && contact.steps.length > 0 ? (
                              <VStack align="stretch" spacing={2}>
                                {contact.steps.map(step => (
                                  <Box
                                    key={step.stepOrder}
                                    p={3}
                                    bg="white"
                                    borderRadius="md"
                                    borderWidth="1px"
                                    borderColor="gray.200"
                                  >
                                    <HStack justify="space-between" mb={1}>
                                      <Badge colorScheme="teal" fontSize="xs">Step {step.stepOrder}</Badge>
                                      <Badge colorScheme="blue" fontSize="xs">
                                        {step.delayDaysFromPrevious === 0 ? 'Day 0 (immediate)' : `+${step.delayDaysFromPrevious}d`}
                                      </Badge>
                                      <Text fontSize="xs" color="gray.500">
                                        {new Date(step.plannedSendAt).toLocaleString()}
                                      </Text>
                                    </HStack>
                                    <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={0.5}>Subject:</Text>
                                    <Text fontSize="sm" mb={1}>{step.subjectPreview}</Text>
                                    <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={0.5}>Body preview:</Text>
                                    <Text fontSize="xs" color="gray.700" whiteSpace="pre-wrap" fontFamily="monospace">
                                      {step.bodyPreviewHtml}
                                    </Text>
                                    <Text fontSize="xs" color="gray.400" mt={1}>via {step.wouldSendFromEmail} ({step.provider})</Text>
                                  </Box>
                                ))}
                              </VStack>
                            ) : (
                              <Text fontSize="sm" color="gray.400">No steps</Text>
                            )}
                          </AccordionPanel>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : (
                    <Text color="gray.500" fontSize="sm">No contacts in sample.</Text>
                  )}
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Text fontSize="xs" color="gray.400" mr="auto">
              Read-only preview — no data was written
            </Text>
            <Button onClick={onDryRunClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
