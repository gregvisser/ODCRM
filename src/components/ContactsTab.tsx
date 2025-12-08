import { useState, useEffect, useRef } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Heading,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Link,
  Button,
  HStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  FormControl,
  FormLabel,
  Input,
  Select,
  IconButton,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons'
import { accounts } from './AccountsTab'
import { ExportImportButtons } from './ExportImportButtons'

export type Contact = {
  id: string
  name: string
  title: string
  account: string
  tier: string
  status: string
  email: string
  phone: string
}

// Default contacts with IDs
const defaultContacts: Contact[] = [
  {
    id: '1',
    name: 'Oliver Kade',
    title: 'CTO & UK Country Manager',
    account: 'Seven Clean Seas',
    tier: 'Decision maker',
    status: 'Active',
    email: 'oliver.kade@sevencleanseas.com',
    phone: '07123456789',
  },
  {
    id: '2',
    name: 'Wafi Ramadhani',
    title: 'Operations Lead',
    account: 'Seven Clean Seas',
    tier: 'Decision maker',
    status: 'Active',
    email: 'wafi.ramadhani@sevencleanseas.com',
    phone: '+6281382002114',
  },
  {
    id: '3',
    name: 'Pamela Correia',
    title: 'Co-Founder',
    account: 'Seven Clean Seas',
    tier: 'Decision maker',
    status: 'Active',
    email: 'pamela.correia@sevencleanseas.com',
    phone: '+62819625294',
  },
  {
    id: '4',
    name: 'Chris Piper',
    title: 'Business Manager',
    account: 'OCS',
    tier: 'Decision maker',
    status: 'Active',
    email: 'chris.piper@ocs.com',
    phone: '07123456789',
  },
  {
    id: '5',
    name: 'Sanjay Patel',
    title: 'Sales Director UK&I',
    account: 'OCS',
    tier: 'Decision maker',
    status: 'Active',
    email: 'sanjay.patel@ocs.com',
    phone: '07123456789',
  },
  {
    id: '6',
    name: 'Ben Windsor',
    title: 'Sales Director Catering',
    account: 'OCS',
    tier: 'Decision maker',
    status: 'Active',
    email: 'ben.windsor@ocs.com',
    phone: '07123456789',
  },
  {
    id: '7',
    name: 'Dan Stewart',
    title: 'Sales Director Cleaning and Security',
    account: 'OCS',
    tier: 'Decision maker',
    status: 'Active',
    email: 'dan.stewart@ocs.com',
    phone: '07123456789',
  },
  {
    id: '8',
    name: 'Bilal Khalid',
    title: 'Sales Director Hard Services',
    account: 'OCS',
    tier: 'Decision maker',
    status: 'Active',
    email: 'bilal.khalid@ocs.com',
    phone: '07123456789',
  },
  {
    id: '9',
    name: 'Omer Khalid',
    title: 'Sales Director Facilities',
    account: 'OCS',
    tier: 'Decision maker',
    status: 'Active',
    email: 'omer.khalid@ocs.com',
    phone: '07123456789',
  },
  {
    id: '10',
    name: 'Omer Khalid',
    title: 'COO',
    account: 'MaxSpace Projects',
    tier: 'Decision maker',
    status: 'Active',
    email: 'carlos@maxspaceprojects.co.uk',
    phone: '07123456789',
  },
  {
    id: '11',
    name: 'Rephael Barreto',
    title: 'Managing Director',
    account: 'Verve Connect',
    tier: 'Decision maker',
    status: 'Active',
    email: 'raphael.barreto@verveconnect.co.uk',
    phone: '07123456789',
  },
  {
    id: '12',
    name: 'Dan Stewart',
    title: 'Director',
    account: 'Shield Pest Control',
    tier: 'Decision maker',
    status: 'Active',
    email: 'dan.steward@shieldpestcontrol.co.uk',
    phone: '07123456789',
  },
  {
    id: '13',
    name: 'Sanjay Patel',
    title: 'Director',
    account: 'My Purchasing Partner',
    tier: 'Decision maker',
    status: 'Active',
    email: 'sanjay.patel@mypurchasingpartner.com',
    phone: '07123456789',
  },
  {
    id: '14',
    name: 'Ben Windsor',
    title: 'Director',
    account: 'Octavian Security',
    tier: 'Decision maker',
    status: 'Active',
    email: 'ben.windsor@octaviansecurity.com',
    phone: '07123456789',
  },
  {
    id: '15',
    name: 'Chris Piper',
    title: 'Director',
    account: 'Beauparc',
    tier: 'Decision maker',
    status: 'Active',
    email: 'chris.piper@beauparc.ie',
    phone: '07123456789',
  },
  {
    id: '16',
    name: 'Bilal Khalid',
    title: 'Director',
    account: 'FusionTek',
    tier: 'Decision maker',
    status: 'Active',
    email: 'bilal.khalid@fusiontek.co.uk',
    phone: '07123456789',
  },
  {
    id: '17',
    name: 'Oliver Kade',
    title: 'Director',
    account: 'Legionella',
    tier: 'Decision maker',
    status: 'Active',
    email: 'oliver.kade@legionellacontrol.com',
    phone: '07123456789',
  },
  {
    id: '18',
    name: 'Pamela Correia',
    title: 'Technical Operations Manager',
    account: 'P&R Morson FM',
    tier: 'Decision maker',
    status: 'Active',
    email: 'pamela.correia@morsonfm.co.uk',
    phone: '07123456789',
  },
]

// Export for backward compatibility
export const contacts = defaultContacts

// localStorage key
const STORAGE_KEY_CONTACTS = 'odcrm_contacts'

// Load contacts from localStorage or use default
function loadContactsFromStorage(): Contact[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CONTACTS)
    if (stored) {
      const parsed = JSON.parse(stored) as Contact[]
      console.log('✅ Loaded contacts from localStorage:', parsed.length)
      return parsed
    }
  } catch (error) {
    console.warn('Failed to load contacts from localStorage:', error)
  }
  return defaultContacts
}

// Save contacts to localStorage
function saveContactsToStorage(contactsData: Contact[]) {
  try {
    localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contactsData))
    console.log('💾 Saved contacts to localStorage')
  } catch (error) {
    console.warn('Failed to save contacts to localStorage:', error)
  }
}

function ContactsTab() {
  const [contactsData, setContactsData] = useState<Contact[]>(() => loadContactsFromStorage())
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
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const toast = useToast()
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Load accounts from localStorage (same pattern as AccountsTab)
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([])

  useEffect(() => {
    // Load accounts from localStorage
    try {
      const stored = localStorage.getItem('odcrm_accounts')
      if (stored) {
        const parsed = JSON.parse(stored) as Array<{ name: string }>
        const accountNames = parsed.map((acc) => acc.name)
        setAvailableAccounts(accountNames)
      } else {
        // Fallback to exported accounts
        const accountNames = accounts.map((acc) => acc.name)
        setAvailableAccounts(accountNames)
      }
    } catch (error) {
      // Fallback to exported accounts
      const accountNames = accounts.map((acc) => acc.name)
      setAvailableAccounts(accountNames)
    }
  }, [])

  // Save contacts to localStorage whenever data changes
  useEffect(() => {
    saveContactsToStorage(contactsData)
  }, [contactsData])

  // Form state
  const [newContact, setNewContact] = useState<Omit<Contact, 'id'>>({
    name: '',
    title: '',
    account: '',
    tier: 'Decision maker',
    status: 'Active',
    email: '',
    phone: '',
  })

  const handleCreateContact = () => {
    // Validate required fields
    if (!newContact.name || !newContact.account || !newContact.email) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields (Name, Account, Email)',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Create new contact with unique ID
    const contactId = Date.now().toString()
    const contact: Contact = {
      id: contactId,
      ...newContact,
    }

    // Add to contacts
    setContactsData([...contactsData, contact])

    // Reset form
    setNewContact({
      name: '',
      title: '',
      account: '',
      tier: 'Decision maker',
      status: 'Active',
      email: '',
      phone: '',
    })

    // Close modal
    onClose()

    // Show success toast
    toast({
      title: 'Contact Created',
      description: `${contact.name} has been successfully created and linked to ${contact.account}`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  const handleEditClick = (contact: Contact) => {
    setContactToEdit(contact)
    setIsEditMode(true)
    // Populate form with contact data
    setNewContact({
      name: contact.name,
      title: contact.title,
      account: contact.account,
      tier: contact.tier,
      status: contact.status,
      email: contact.email,
      phone: contact.phone,
    })
    onEditOpen()
  }

  const handleUpdateContact = () => {
    if (!contactToEdit) return

    // Validate required fields
    if (!newContact.name || !newContact.account || !newContact.email) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields (Name, Account, Email)',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Update contact
    const updatedContact: Contact = {
      id: contactToEdit.id,
      ...newContact,
    }

    // Update in contacts array
    setContactsData(
      contactsData.map((c) => (c.id === contactToEdit.id ? updatedContact : c)),
    )

    // Reset form and state
    setNewContact({
      name: '',
      title: '',
      account: '',
      tier: 'Decision maker',
      status: 'Active',
      email: '',
      phone: '',
    })
    setContactToEdit(null)
    setIsEditMode(false)
    onEditClose()

    // Show success toast
    toast({
      title: 'Contact Updated',
      description: `${updatedContact.name} has been successfully updated`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  const handleCloseModal = () => {
    // Reset form and state
    setNewContact({
      name: '',
      title: '',
      account: '',
      tier: 'Decision maker',
      status: 'Active',
      email: '',
      phone: '',
    })
    setContactToEdit(null)
    setIsEditMode(false)
    onClose()
    onEditClose()
  }

  const handleDeleteClick = (contact: Contact) => {
    setContactToDelete(contact)
    onDeleteOpen()
  }

  const handleDeleteConfirm = () => {
    if (contactToDelete) {
      setContactsData(contactsData.filter((c) => c.id !== contactToDelete.id))
      toast({
        title: 'Contact Deleted',
        description: `${contactToDelete.name} has been permanently deleted`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
      setContactToDelete(null)
      onDeleteClose()
    }
  }

  return (
    <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.100" boxShadow="sm">
      <HStack justify="space-between" p={6} pb={4} flexWrap="wrap" gap={4}>
        <Heading size="md">Contacts by account</Heading>
        <HStack spacing={3} flexWrap="wrap">
          <ExportImportButtons
            data={contactsData}
            filename="contacts"
            validateItem={(contact) => {
              return !!(contact.name && contact.email && contact.account)
            }}
            getItemId={(contact) => contact.id}
            onImport={(items) => {
              setContactsData(items)
              saveContactsToStorage(items)
            }}
          />
          <Button leftIcon={<AddIcon />} colorScheme="teal" onClick={onOpen}>
            Create Contact
          </Button>
        </HStack>
      </HStack>
      <Table variant="simple">
        <Thead bg="gray.50">
          <Tr>
            <Th>Contact</Th>
            <Th>Title</Th>
            <Th>Email address</Th>
            <Th>Contact number</Th>
            <Th>Account</Th>
            <Th>Tier</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {contactsData.map((contact) => (
            <Tr key={contact.id}>
              <Td>
                <Box display="flex" alignItems="center" gap="3">
                  <Avatar name={contact.name} size="sm" />
                  <Heading size="sm">{contact.name}</Heading>
                </Box>
              </Td>
              <Td>{contact.title}</Td>
              <Td>{contact.email}</Td>
              <Td>{contact.phone}</Td>
              <Td>
                <Link
                  color="teal.600"
                  fontWeight="medium"
                  cursor="pointer"
                  onClick={(e) => {
                    e.preventDefault()
                    // Trigger navigation to accounts tab and open the account
                    const event = new CustomEvent('navigateToAccount', {
                      detail: { accountName: contact.account },
                    })
                    window.dispatchEvent(event)
                  }}
                  _hover={{ textDecoration: 'underline' }}
                >
                  {contact.account}
                </Link>
              </Td>
              <Td>
                <Badge colorScheme={contact.tier === 'Decision maker' ? 'purple' : 'blue'}>
                  {contact.tier}
                </Badge>
              </Td>
              <Td>
                <Badge
                  colorScheme={
                    contact.status === 'Engaged' || contact.status === 'Active'
                      ? 'green'
                      : contact.status === 'Nurture'
                        ? 'yellow'
                        : 'gray'
                  }
                >
                  {contact.status}
                </Badge>
              </Td>
              <Td>
                <HStack spacing={2}>
                  <IconButton
                    aria-label="Edit contact"
                    icon={<EditIcon />}
                    size="sm"
                    colorScheme="teal"
                    variant="ghost"
                    onClick={() => handleEditClick(contact)}
                  />
                  <IconButton
                    aria-label="Delete contact"
                    icon={<DeleteIcon />}
                    size="sm"
                    colorScheme="red"
                    variant="ghost"
                    onClick={() => handleDeleteClick(contact)}
                  />
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Create Contact Modal */}
      <Modal isOpen={isOpen} onClose={handleCloseModal} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Contact</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired mb={4}>
              <FormLabel>Name</FormLabel>
              <Input
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="Enter contact name"
              />
            </FormControl>
            <FormControl mb={4}>
              <FormLabel>Title</FormLabel>
              <Input
                value={newContact.title}
                onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                placeholder="Enter job title"
              />
            </FormControl>
            <FormControl isRequired mb={4}>
              <FormLabel>Account</FormLabel>
              <Select
                value={newContact.account}
                onChange={(e) => setNewContact({ ...newContact, account: e.target.value })}
                placeholder="Select an account"
              >
                {availableAccounts.map((account) => (
                  <option key={account} value={account}>
                    {account}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl isRequired mb={4}>
              <FormLabel>Email</FormLabel>
              <Input
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                placeholder="Enter email address"
              />
            </FormControl>
            <FormControl mb={4}>
              <FormLabel>Phone</FormLabel>
              <Input
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </FormControl>
            <FormControl mb={4}>
              <FormLabel>Tier</FormLabel>
              <Select
                value={newContact.tier}
                onChange={(e) => setNewContact({ ...newContact, tier: e.target.value })}
              >
                <option value="Decision maker">Decision maker</option>
                <option value="Influencer">Influencer</option>
                <option value="User">User</option>
              </Select>
            </FormControl>
            <FormControl mb={4}>
              <FormLabel>Status</FormLabel>
              <Select
                value={newContact.status}
                onChange={(e) => setNewContact({ ...newContact, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Engaged">Engaged</option>
                <option value="Nurture">Nurture</option>
              </Select>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={handleCreateContact}>
              Create Contact
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Contact Modal */}
      <Modal isOpen={isEditOpen} onClose={handleCloseModal} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Contact</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired mb={4}>
              <FormLabel>Name</FormLabel>
              <Input
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="Enter contact name"
              />
            </FormControl>
            <FormControl mb={4}>
              <FormLabel>Title</FormLabel>
              <Input
                value={newContact.title}
                onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                placeholder="Enter job title"
              />
            </FormControl>
            <FormControl isRequired mb={4}>
              <FormLabel>Account</FormLabel>
              <Select
                value={newContact.account}
                onChange={(e) => setNewContact({ ...newContact, account: e.target.value })}
                placeholder="Select an account"
              >
                {availableAccounts.map((account) => (
                  <option key={account} value={account}>
                    {account}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl isRequired mb={4}>
              <FormLabel>Email</FormLabel>
              <Input
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                placeholder="Enter email address"
              />
            </FormControl>
            <FormControl mb={4}>
              <FormLabel>Phone</FormLabel>
              <Input
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </FormControl>
            <FormControl mb={4}>
              <FormLabel>Tier</FormLabel>
              <Select
                value={newContact.tier}
                onChange={(e) => setNewContact({ ...newContact, tier: e.target.value })}
              >
                <option value="Decision maker">Decision maker</option>
                <option value="Influencer">Influencer</option>
                <option value="User">User</option>
              </Select>
            </FormControl>
            <FormControl mb={4}>
              <FormLabel>Status</FormLabel>
              <Select
                value={newContact.status}
                onChange={(e) => setNewContact({ ...newContact, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Engaged">Engaged</option>
                <option value="Nurture">Nurture</option>
              </Select>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={handleUpdateContact}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog isOpen={isDeleteOpen} onClose={onDeleteClose} leastDestructiveRef={cancelRef}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Contact
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete {contactToDelete?.name}? This action cannot be undone
              and the contact will be permanently removed.
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
    </Box>
  )
}

export default ContactsTab

