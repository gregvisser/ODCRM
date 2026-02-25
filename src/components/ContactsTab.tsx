import { useMemo, useState } from 'react'
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
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Tooltip,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon } from '@chakra-ui/icons'
import { api } from '../utils/api'
import { useCustomersFromDatabase, type DatabaseCustomer } from '../hooks/useCustomersFromDatabase'

type ClientContactRow = {
  id: string
  customerId: string
  customerName: string
  name: string
  email?: string | null
  phone?: string | null
  title?: string | null
  isPrimary: boolean
}

export default function ContactsTab() {
  const toast = useToast()
  const { customers, loading, error, refetch } = useCustomersFromDatabase()
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all')

  const { isOpen, onOpen, onClose } = useDisclosure()
  const [isSaving, setIsSaving] = useState(false)

  const [newContact, setNewContact] = useState({
    customerId: '',
    name: '',
    email: '',
    phone: '',
    title: '',
    isPrimary: false,
  })

  const rows: ClientContactRow[] = useMemo(() => {
    const list: ClientContactRow[] = []
    for (const c of customers) {
      const contactRows = Array.isArray((c as any).customerContacts) ? (c as any).customerContacts : []
      for (const contact of contactRows) {
        list.push({
          id: contact.id,
          customerId: c.id,
          customerName: c.name,
          name: contact.name,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          title: contact.title ?? null,
          isPrimary: Boolean(contact.isPrimary),
        })
      }
    }
    return list.sort((a, b) => a.customerName.localeCompare(b.customerName) || a.name.localeCompare(b.name))
  }, [customers])

  const filteredRows = useMemo(() => {
    if (selectedCustomerId === 'all') return rows
    return rows.filter((r) => r.customerId === selectedCustomerId)
  }, [rows, selectedCustomerId])

  const handleDelete = async (row: ClientContactRow) => {
    if (!confirm(`Delete contact "${row.name}" for ${row.customerName}?`)) return
    const { error: deleteError } = await api.delete(`/api/customers/${row.customerId}/contacts/${row.id}`)
    if (deleteError) {
      toast({
        title: 'Failed to delete contact',
        description: deleteError,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }
    toast({ title: 'Contact deleted', status: 'success', duration: 2000 })
    await refetch()
  }

  const handleOpenAdd = () => {
    onOpen()
    setNewContact({
      customerId: selectedCustomerId !== 'all' ? selectedCustomerId : '',
      name: '',
      email: '',
      phone: '',
      title: '',
      isPrimary: false,
    })
  }

  const handleCreate = async () => {
    if (!newContact.customerId) {
      toast({ title: 'Select a client', status: 'warning', duration: 2500 })
      return
    }
    if (!newContact.name.trim()) {
      toast({ title: 'Name required', status: 'warning', duration: 2500 })
      return
    }

    setIsSaving(true)
    const { error: createError } = await api.post(`/api/customers/${newContact.customerId}/contacts`, {
      name: newContact.name.trim(),
      email: newContact.email.trim() || null,
      phone: newContact.phone.trim() || null,
      title: newContact.title.trim() || null,
      isPrimary: newContact.isPrimary,
    })
    setIsSaving(false)

    if (createError) {
      toast({
        title: 'Failed to add contact',
        description: createError,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    toast({ title: 'Contact added', status: 'success', duration: 2000 })
    onClose()
    await refetch()
  }

  if (loading) {
    return (
      <Stack py={10} align="center" spacing={4}>
        <Spinner size="xl" />
        <Text color="gray.600">Loading contacts from database...</Text>
      </Stack>
    )
  }

  if (error) {
    return (
      <Box p={6}>
        <Text color="red.600" fontSize="sm">
          Failed to load contacts: {error}
        </Text>
        <Button mt={3} size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </Box>
    )
  }

  return (
    <Box p={2}>
      <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
        <Box>
          <Heading size="md">Client Contacts</Heading>
          <Text fontSize="sm" color="gray.600">
            Contacts saved during onboarding (database-backed).
          </Text>
        </Box>

        <HStack spacing={3}>
          <FormControl>
            <FormLabel fontSize="xs" mb={1}>
              Client
            </FormLabel>
            <Select
              size="sm"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              minW={{ base: '220px', md: '280px' }}
            >
              <option value="all">All clients</option>
              {customers.map((c: DatabaseCustomer) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormControl>

          <Tooltip label="Add a new client contact">
            <Button size="sm" colorScheme="teal" leftIcon={<AddIcon />} onClick={handleOpenAdd}>
              Add contact
            </Button>
          </Tooltip>
        </HStack>
      </HStack>

      <Box border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" overflow="hidden">
        {filteredRows.length === 0 ? (
          <Box p={6}>
            <Text fontSize="sm" color="gray.600">
              No contacts found.
            </Text>
          </Box>
        ) : (
          <Stack spacing={0}>
            {filteredRows.map((row) => (
              <HStack
                key={row.id}
                px={4}
                py={3}
                borderBottom="1px solid"
                borderColor="gray.100"
                justify="space-between"
                align="start"
              >
                <Box>
                  <HStack spacing={2}>
                    <Text fontWeight="semibold">{row.name}</Text>
                    {row.isPrimary ? <Badge colorScheme="blue">Primary</Badge> : null}
                  </HStack>
                  <Text fontSize="xs" color="gray.600">
                    {row.customerName}
                  </Text>
                  <HStack spacing={4} mt={1} fontSize="sm" color="gray.700" flexWrap="wrap">
                    {row.title ? <Text>{row.title}</Text> : null}
                    {row.email ? <Text>{row.email}</Text> : null}
                    {row.phone ? <Text>{row.phone}</Text> : null}
                  </HStack>
                </Box>
                <IconButton
                  aria-label="Delete contact"
                  icon={<DeleteIcon />}
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => void handleDelete(row)}
                />
              </HStack>
            ))}
          </Stack>
        )}
      </Box>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add client contact</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Client</FormLabel>
                <Select
                  value={newContact.customerId}
                  onChange={(e) => setNewContact((p) => ({ ...p, customerId: e.target.value }))}
                >
                  <option value="">Select client</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <FormControl isRequired>
                  <FormLabel>Name</FormLabel>
                  <Input value={newContact.name} onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))} />
                </FormControl>
                <FormControl>
                  <FormLabel>Title</FormLabel>
                  <Input
                    value={newContact.title}
                    onChange={(e) => setNewContact((p) => ({ ...p, title: e.target.value }))}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Email</FormLabel>
                  <Input
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Phone</FormLabel>
                  <Input
                    value={newContact.phone}
                    onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))}
                  />
                </FormControl>
              </SimpleGrid>

              <Checkbox
                isChecked={newContact.isPrimary}
                onChange={(e) => setNewContact((p) => ({ ...p, isPrimary: e.target.checked }))}
              >
                Mark as primary
              </Checkbox>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={() => void handleCreate()} isLoading={isSaving}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}

