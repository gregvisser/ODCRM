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
  Select,
  Checkbox,
  Stack,
} from '@chakra-ui/react'
import { AddIcon, EditIcon, ViewIcon, DeleteIcon } from '@chakra-ui/icons'
import { settingsStore } from '../platform'
import { api } from '../utils/api'

type ContactList = {
  id: string
  customerId: string
  name: string
  description?: string
  contactCount: number
  createdAt: string
  updatedAt: string
}

type Contact = {
  id: string
  firstName: string
  lastName: string
  email: string
  companyName: string
  jobTitle?: string
  phone?: string
  status: string
  addedAt?: string
}

type ListDetail = ContactList & {
  contacts: Contact[]
}

export default function MarketingListsTab() {
  const [lists, setLists] = useState<ContactList[]>([])
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedList, setSelectedList] = useState<ListDetail | null>(null)
  const [editingList, setEditingList] = useState<ContactList | null>(null)
  const [listToDelete, setListToDelete] = useState<ContactList | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [customerId, setCustomerId] = useState<string>('')

  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure()
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure()
  const { isOpen: isAddContactsOpen, onOpen: onAddContactsOpen, onClose: onAddContactsClose } = useDisclosure()
  
  const cancelRef = useRef<HTMLButtonElement>(null)
  const toast = useToast()

  // Load current customer ID from localStorage or storage
  useEffect(() => {
    // TODO: Get actual customer ID from app context/storage
    // For now, we'll fetch customers and use the first one
    const fetchCustomerId = async () => {
      const { data } = await api.get<{ id: string }[]>('/api/contacts')
      if (data && data.length > 0 && 'customerId' in data[0]) {
        setCustomerId((data[0] as any).customerId)
      } else {
        // Default customer ID if none found
        setCustomerId(settingsStore.getCurrentCustomerId('prod-customer-1'))
      }
    }
    fetchCustomerId()
  }, [])

  const fetchLists = useCallback(async () => {
    if (!customerId) return
    
    setLoading(true)
    const { data, error } = await api.get<ContactList[]>(`/api/lists?customerId=${customerId}`)
    if (error) {
      toast({
        title: 'Error',
        description: error,
        status: 'error',
        duration: 3000,
      })
    } else if (data) {
      setLists(data)
    }
    setLoading(false)
  }, [customerId, toast])

  const fetchAllContacts = useCallback(async () => {
    if (!customerId) return
    
    const { data } = await api.get<Contact[]>('/api/contacts')
    if (data) {
      setAllContacts(data)
    }
  }, [customerId])

  useEffect(() => {
    if (customerId) {
      fetchLists()
      fetchAllContacts()
    }
  }, [customerId, fetchAllContacts, fetchLists])

  const handleCreateList = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'List name is required', status: 'error' })
      return
    }

    const { error } = await api.post('/api/lists', {
      customerId,
      name: formData.name,
      description: formData.description,
    })

    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'List created', status: 'success' })
      fetchLists()
      onCreateClose()
      setFormData({ name: '', description: '' })
    }
  }

  const handleUpdateList = async () => {
    if (!editingList || !formData.name.trim()) return

    const { error } = await api.put(`/api/lists/${editingList.id}`, {
      name: formData.name,
      description: formData.description,
    })

    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'List updated', status: 'success' })
      fetchLists()
      onEditClose()
      setEditingList(null)
      setFormData({ name: '', description: '' })
    }
  }

  const handleDeleteList = async () => {
    if (!listToDelete) return

    const { error } = await api.delete(`/api/lists/${listToDelete.id}`)

    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'List deleted', status: 'success' })
      fetchLists()
      onDeleteClose()
      setListToDelete(null)
    }
  }

  const handleViewList = async (list: ContactList) => {
    const { data, error } = await api.get<ListDetail>(`/api/lists/${list.id}`)
    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else if (data) {
      setSelectedList(data)
      onViewOpen()
    }
  }

  const handleAddContactsToList = async () => {
    if (!selectedList || selectedContacts.size === 0) return

    const { error } = await api.post(`/api/lists/${selectedList.id}/contacts`, {
      contactIds: Array.from(selectedContacts),
    })

    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({
        title: 'Success',
        description: `Added ${selectedContacts.size} contact(s) to list`,
        status: 'success',
      })
      setSelectedContacts(new Set())
      onAddContactsClose()
      // Refresh the current list view
      handleViewList(selectedList)
      fetchLists()
    }
  }

  const handleRemoveContactFromList = async (listId: string, contactId: string) => {
    const { error } = await api.delete(`/api/lists/${listId}/contacts/${contactId}`)

    if (error) {
      toast({ title: 'Error', description: error, status: 'error' })
    } else {
      toast({ title: 'Success', description: 'Contact removed from list', status: 'success' })
      // Refresh the current list view
      if (selectedList && selectedList.id === listId) {
        handleViewList(selectedList)
      }
      fetchLists()
    }
  }

  const openCreateModal = () => {
    setFormData({ name: '', description: '' })
    onCreateOpen()
  }

  const openEditModal = (list: ContactList) => {
    setEditingList(list)
    setFormData({ name: list.name, description: list.description || '' })
    onEditOpen()
  }

  const openDeleteDialog = (list: ContactList) => {
    setListToDelete(list)
    onDeleteOpen()
  }

  const openAddContactsModal = (list: ListDetail) => {
    setSelectedList(list)
    setSelectedContacts(new Set())
    onAddContactsOpen()
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
          <Heading size="lg">Lists</Heading>
          <Text fontSize="sm" color="gray.600">
            Organize contacts into targetable lists for campaigns
          </Text>
        </Box>
        <Button leftIcon={<AddIcon />} colorScheme="teal" onClick={openCreateModal}>
          Create List
        </Button>
      </HStack>

      <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
        <Table size="sm">
          <Thead bg="gray.50">
            <Tr>
              <Th>Name</Th>
              <Th>Description</Th>
              <Th isNumeric>Contacts</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {lists.length === 0 ? (
              <Tr>
                <Td colSpan={5} textAlign="center" py={8}>
                  <Text color="gray.500">No lists yet. Create your first list to get started.</Text>
                </Td>
              </Tr>
            ) : (
              lists.map((list) => (
                <Tr key={list.id}>
                  <Td fontWeight="medium">{list.name}</Td>
                  <Td>
                    <Text fontSize="sm" color="gray.600" noOfLines={1}>
                      {list.description || '-'}
                    </Text>
                  </Td>
                  <Td isNumeric>
                    <Badge colorScheme="blue">{list.contactCount}</Badge>
                  </Td>
                  <Td fontSize="sm" color="gray.600">
                    {new Date(list.createdAt).toLocaleDateString()}
                  </Td>
                  <Td>
                    <HStack spacing={1}>
                      <IconButton
                        aria-label="View list"
                        icon={<ViewIcon />}
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewList(list)}
                      />
                      <IconButton
                        aria-label="Edit list"
                        icon={<EditIcon />}
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(list)}
                      />
                      <IconButton
                        aria-label="Delete list"
                        icon={<DeleteIcon />}
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => openDeleteDialog(list)}
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Box>

      {/* Create List Modal */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New List</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>List Name</FormLabel>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Tech CEOs Q1 2026"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description for this list"
                  rows={3}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateClose}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={handleCreateList}>
              Create List
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit List Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit List</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>List Name</FormLabel>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditClose}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={handleUpdateList}>
              Update List
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete List</AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete the list "{listToDelete?.name}"? This will not delete the contacts
              themselves.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteList} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* View List Modal */}
      <Modal isOpen={isViewOpen} onClose={onViewClose} size="4xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <VStack align="start" spacing={1}>
              <Text>{selectedList?.name}</Text>
              <Text fontSize="sm" fontWeight="normal" color="gray.600">
                {selectedList?.description || 'No description'}
              </Text>
            </VStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between">
                <Badge colorScheme="blue" fontSize="md" px={3} py={1}>
                  {selectedList?.contacts.length || 0} contact(s)
                </Badge>
                <Button
                  size="sm"
                  leftIcon={<AddIcon />}
                  colorScheme="teal"
                  onClick={() => selectedList && openAddContactsModal(selectedList)}
                >
                  Add Contacts
                </Button>
              </HStack>

              <Box maxH="400px" overflowY="auto" border="1px solid" borderColor="gray.200" borderRadius="md">
                <Table size="sm">
                  <Thead bg="gray.50" position="sticky" top={0} zIndex={1}>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Email</Th>
                      <Th>Company</Th>
                      <Th>Status</Th>
                      <Th>Action</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {selectedList?.contacts.length === 0 ? (
                      <Tr>
                        <Td colSpan={5} textAlign="center" py={6}>
                          <Text color="gray.500">No contacts in this list yet</Text>
                        </Td>
                      </Tr>
                    ) : (
                      selectedList?.contacts.map((contact) => (
                        <Tr key={contact.id}>
                          <Td>
                            {contact.firstName} {contact.lastName}
                          </Td>
                          <Td fontSize="sm">{contact.email}</Td>
                          <Td fontSize="sm">{contact.companyName}</Td>
                          <Td>
                            <Badge
                              colorScheme={
                                contact.status === 'active'
                                  ? 'green'
                                  : contact.status === 'unsubscribed'
                                    ? 'orange'
                                    : 'red'
                              }
                              size="sm"
                            >
                              {contact.status}
                            </Badge>
                          </Td>
                          <Td>
                            <IconButton
                              aria-label="Remove from list"
                              icon={<DeleteIcon />}
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() =>
                                selectedList && handleRemoveContactFromList(selectedList.id, contact.id)
                              }
                            />
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onViewClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Contacts to List Modal */}
      <Modal isOpen={isAddContactsOpen} onClose={onAddContactsClose} size="3xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Contacts to "{selectedList?.name}"</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Text fontSize="sm" color="gray.600">
                Select contacts to add to this list. Contacts already in the list will be skipped.
              </Text>

              <Box maxH="400px" overflowY="auto" border="1px solid" borderColor="gray.200" borderRadius="md">
                <Table size="sm">
                  <Thead bg="gray.50" position="sticky" top={0} zIndex={1}>
                    <Tr>
                      <Th w="40px"></Th>
                      <Th>Name</Th>
                      <Th>Email</Th>
                      <Th>Company</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {allContacts.filter(
                      (c) => !selectedList?.contacts.some((lc) => lc.id === c.id)
                    ).length === 0 ? (
                      <Tr>
                        <Td colSpan={4} textAlign="center" py={6}>
                          <Text color="gray.500">All contacts are already in this list</Text>
                        </Td>
                      </Tr>
                    ) : (
                      allContacts
                        .filter((c) => !selectedList?.contacts.some((lc) => lc.id === c.id))
                        .map((contact) => (
                          <Tr key={contact.id}>
                            <Td>
                              <Checkbox
                                isChecked={selectedContacts.has(contact.id)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedContacts)
                                  if (e.target.checked) {
                                    newSelected.add(contact.id)
                                  } else {
                                    newSelected.delete(contact.id)
                                  }
                                  setSelectedContacts(newSelected)
                                }}
                              />
                            </Td>
                            <Td>
                              {contact.firstName} {contact.lastName}
                            </Td>
                            <Td fontSize="sm">{contact.email}</Td>
                            <Td fontSize="sm">{contact.companyName}</Td>
                          </Tr>
                        ))
                    )}
                  </Tbody>
                </Table>
              </Box>

              {selectedContacts.size > 0 && (
                <Badge colorScheme="teal" fontSize="sm" px={3} py={1} alignSelf="start">
                  {selectedContacts.size} contact(s) selected
                </Badge>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onAddContactsClose}>
              Cancel
            </Button>
            <Button
              colorScheme="teal"
              onClick={handleAddContactsToList}
              isDisabled={selectedContacts.size === 0}
            >
              Add Selected ({selectedContacts.size})
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
