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
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
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

type Schedule = {
  id: string
  customerId: string
  name: string
  timezone: string
  daysOfWeek: number[]
  startHour: number
  endHour: number
  createdAt: string
}

const days = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 0, label: 'Sun' },
]

export default function MarketingSchedulesTab() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Schedule[]>([])
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [deleting, setDeleting] = useState<Schedule | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure()
  const cancelRef = useRef<HTMLButtonElement>(null)

  const [draft, setDraft] = useState({
    name: 'Default',
    timezone: 'UTC',
    daysOfWeek: [1, 2, 3, 4, 5] as number[],
    startHour: 9,
    endHour: 17,
  })

  const load = async () => {
    setLoading(true)
    const { data, error } = await api.get<Schedule[]>('/api/schedules')
    if (error) toast({ title: 'Error', description: error, status: 'error' })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => {
    setEditing(null)
    setDraft({ name: '', timezone: 'UTC', daysOfWeek: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 })
    onOpen()
  }

  const openEdit = (s: Schedule) => {
    setEditing(s)
    setDraft({
      name: s.name,
      timezone: s.timezone || 'UTC',
      daysOfWeek: Array.isArray(s.daysOfWeek) ? s.daysOfWeek : [1, 2, 3, 4, 5],
      startHour: s.startHour ?? 9,
      endHour: s.endHour ?? 17,
    })
    onOpen()
  }

  const save = async () => {
    if (!draft.name.trim()) {
      toast({ title: 'Name required', status: 'error' })
      return
    }
    if (draft.daysOfWeek.length === 0) {
      toast({ title: 'Pick at least one day', status: 'error' })
      return
    }
    if (draft.startHour === draft.endHour) {
      toast({ title: 'Start/end hours cannot be the same', status: 'error' })
      return
    }

    if (editing) {
      const { error } = await api.patch(`/api/schedules/${editing.id}`, draft)
      if (error) {
        toast({ title: 'Error', description: error, status: 'error' })
        return
      }
      toast({ title: 'Schedule updated', status: 'success', duration: 1200 })
    } else {
      const { error } = await api.post(`/api/schedules`, draft)
      if (error) {
        toast({ title: 'Error', description: error, status: 'error' })
        return
      }
      toast({ title: 'Schedule created', status: 'success', duration: 1200 })
    }

    onClose()
    load()
  }

  const requestDelete = (s: Schedule) => {
    setDeleting(s)
    onDeleteOpen()
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const { error } = await api.delete(`/api/schedules/${deleting.id}`)
    if (error) toast({ title: 'Error', description: error, status: 'error' })
    else toast({ title: 'Schedule deleted', status: 'success', duration: 1200 })
    setDeleting(null)
    onDeleteClose()
    load()
  }

  const dayLabel = useMemo(() => {
    const map = new Map(days.map((d) => [d.id, d.label]))
    return (ids: number[]) => ids.map((id) => map.get(id) || String(id)).join(', ')
  }, [])

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
      </Box>
    )
  }

  return (
    <Stack spacing={6}>
      <Box>
        <Heading size="lg" mb={2}>
          Schedules
        </Heading>
        <Text color="gray.600">
          Per-customer sending schedules (like Reply.io “Schedules”). Campaigns choose one schedule; the scheduler enforces it.
        </Text>
      </Box>

      <HStack justify="space-between" flexWrap="wrap" gap={3}>
        <Text fontSize="sm" color="gray.600">
          Customer-wide cap: <strong>160 emails / 24h</strong> across all 5 sender accounts.
        </Text>
        <Button leftIcon={<AddIcon />} colorScheme="gray" onClick={openCreate} size="sm">
          Create schedule
        </Button>
      </HStack>

      <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
        <Table size="sm">
          <Thead bg="gray.50">
            <Tr>
              <Th>Name</Th>
              <Th>Timezone</Th>
              <Th>Days</Th>
              <Th>Hours</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.map((s) => (
              <Tr key={s.id}>
                <Td>
                  <HStack>
                    <Text fontWeight="medium">{s.name}</Text>
                    {s.name === 'Default' && <Badge colorScheme="blue">default</Badge>}
                  </HStack>
                </Td>
                <Td>{s.timezone}</Td>
                <Td>{dayLabel(s.daysOfWeek)}</Td>
                <Td>
                  {s.startHour}:00–{s.endHour}:00
                </Td>
                <Td>
                  <HStack spacing={2}>
                    <IconButton aria-label="Edit" icon={<EditIcon />} size="sm" onClick={() => openEdit(s)} />
                    <IconButton
                      aria-label="Delete"
                      icon={<DeleteIcon />}
                      size="sm"
                      colorScheme="gray"
                      onClick={() => requestDelete(s)}
                      isDisabled={s.name === 'Default'}
                      title={s.name === 'Default' ? 'Default schedule cannot be deleted' : ''}
                    />
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editing ? 'Edit schedule' : 'Create schedule'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
              </FormControl>

              <FormControl>
                <FormLabel>Timezone</FormLabel>
                <Input value={draft.timezone} onChange={(e) => setDraft((p) => ({ ...p, timezone: e.target.value }))} />
                <Text fontSize="xs" color="gray.600" mt={1}>
                  Use an IANA timezone like <code>UTC</code>, <code>America/New_York</code>.
                </Text>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Days of week</FormLabel>
                <SimpleGrid columns={{ base: 4, md: 7 }} spacing={2}>
                  {days.map((d) => (
                    <Checkbox
                      key={d.id}
                      isChecked={draft.daysOfWeek.includes(d.id)}
                      onChange={(e) => {
                        setDraft((p) => {
                          const next = new Set(p.daysOfWeek)
                          if (e.target.checked) next.add(d.id)
                          else next.delete(d.id)
                          return { ...p, daysOfWeek: Array.from(next) }
                        })
                      }}
                    >
                      {d.label}
                    </Checkbox>
                  ))}
                </SimpleGrid>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Allowed hours</FormLabel>
                <HStack>
                  <NumberInput
                    value={draft.startHour}
                    onChange={(_, val) => setDraft((p) => ({ ...p, startHour: val ?? 9 }))}
                    min={0}
                    max={23}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <Text>to</Text>
                  <NumberInput
                    value={draft.endHour}
                    onChange={(_, val) => setDraft((p) => ({ ...p, endHour: val ?? 17 }))}
                    min={0}
                    max={23}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </HStack>
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="gray" onClick={save}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete schedule
            </AlertDialogHeader>
            <AlertDialogBody>
              Delete <strong>{deleting?.name}</strong>? Campaigns using it will fall back to their legacy send window.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="gray" ml={3} onClick={confirmDelete}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Stack>
  )
}

