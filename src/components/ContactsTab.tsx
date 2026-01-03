import { useState, useEffect, useRef } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Heading,
  Text,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Link,
  Button,
  HStack,
  Stack,
  Textarea,
  Checkbox,
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
import { ExportImportButtons } from './ExportImportButtons'
import { emit, on } from '../platform/events'
import { OdcrmStorageKeys } from '../platform/keys'
import { getJson, setItem, setJson } from '../platform/storage'

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

// Load contacts from storage or use default
function loadContactsFromStorage(): Contact[] {
  const parsed = getJson<Contact[]>(OdcrmStorageKeys.contacts)
  if (parsed && Array.isArray(parsed)) {
    console.log('✅ Loaded contacts from storage:', parsed.length)
    return parsed
  }
  return defaultContacts
}

// Save contacts to storage
function saveContactsToStorage(contactsData: Contact[]) {
  setJson(OdcrmStorageKeys.contacts, contactsData)
  console.log('💾 Saved contacts to storage')
}

function loadAccountNamesFromStorage(): string[] {
  const parsed = getJson<Array<{ name: string }>>(OdcrmStorageKeys.accounts)
  if (!parsed || !Array.isArray(parsed)) return []
  return parsed.map((acc) => acc?.name).filter(Boolean)
}

function loadDeletedAccountsFromStorage(): Set<string> {
  const parsed = getJson<string[]>(OdcrmStorageKeys.deletedAccounts)
  return new Set(Array.isArray(parsed) ? parsed : [])
}

type ParsedContactRow = {
  account: string
  name: string
  title?: string
  email?: string
  phone?: string
}

function detectDelimiter(text: string): '\t' | ',' {
  const firstLine = text.split(/\r?\n/)[0] || ''
  return firstLine.includes('\t') ? '\t' : ','
}

function parseSpreadsheetContacts(text: string): ParsedContactRow[] {
  const raw = text.trim()
  if (!raw) return []

  const delimiter = detectDelimiter(raw)
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return []

  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase())
  const rows = lines.slice(1)

  const pick = (cells: string[], aliases: string[]) => {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias)
      if (idx >= 0) {
        const v = (cells[idx] ?? '').trim()
        if (v) return v
      }
    }
    return ''
  }

  const accountAliases = ['account name', 'account', 'client', 'company']
  const nameAliases = ['client contact name', 'contact name', 'name']
  const titleAliases = ['job title', 'title']
  const emailAliases = ['email address', 'contact email', 'email']
  const phoneAliases = ['telephone number', 'contact number', 'main office number', 'phone', 'contact phone']

  const parsed: ParsedContactRow[] = []

  for (const line of rows) {
    const cells = line.split(delimiter).map((c) => c.trim())
    const account = pick(cells, accountAliases)
    const name = pick(cells, nameAliases)
    const title = pick(cells, titleAliases) || undefined
    const email = pick(cells, emailAliases) || undefined
    const phone = pick(cells, phoneAliases) || undefined

    // Skip fully empty lines
    if (!account && !name && !email && !phone) continue
    parsed.push({ account, name, title, email, phone })
  }

  return parsed
}

function buildBlankAccount(name: string) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setFullYear(end.getFullYear() + 1)
  const isoDate = (d: Date) => d.toISOString().split('T')[0]

  return {
    name,
    website: '',
    status: 'Active',
    sector: 'To be determined',
    targetLocation: [],
    targetTitle: '',
    monthlySpendGBP: 0,
    defcon: 3,
    contractStart: isoDate(start),
    contractEnd: isoDate(end),
    days: 1,
    contacts: 0,
    leads: 0,
    weeklyTarget: 0,
    weeklyActual: 0,
    monthlyTarget: 0,
    monthlyActual: 0,
    weeklyReport: '',
    clientLeadsSheetUrl: '',
    aboutSections: {
      whatTheyDo: 'Information will be populated via AI research.',
      accreditations: 'Information will be populated via AI research.',
      keyLeaders: 'Information will be populated via AI research.',
      companyProfile: 'Information will be populated via AI research.',
      recentNews: 'Information will be populated via AI research.',
    },
    socialMedia: [],
    agreements: [],
    users: [],
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
  const [, setIsEditMode] = useState(false)
  const toast = useToast()
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Load accounts from localStorage (same pattern as AccountsTab)
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([])
  const {
    isOpen: isImportOpen,
    onOpen: onImportOpen,
    onClose: onImportClose,
  } = useDisclosure()
  const [importText, setImportText] = useState<string>('')
  const [createMissingAccounts, setCreateMissingAccounts] = useState<boolean>(true)

  useEffect(() => {
    const refresh = () => setAvailableAccounts(loadAccountNamesFromStorage())
    refresh()

    const handleAccountsUpdated = () => {
      const names = loadAccountNamesFromStorage()
      setAvailableAccounts(names)

      // If accounts are deleted, remove linked contacts so the system stays in sync.
      if (names.length > 0) {
        const setNames = new Set(names)
        setContactsData((prev) => {
          const next = prev.filter((c) => setNames.has(c.account))
          return next
        })
      }
    }

    const off = on('accountsUpdated', () => handleAccountsUpdated())
    return () => off()
  }, [])

  // Save contacts to localStorage whenever data changes
  useEffect(() => {
    saveContactsToStorage(contactsData)
    // Dispatch event to notify other tabs (like AccountsTab) that contacts have changed
    emit('contactsUpdated', contactsData)
  }, [contactsData])

  const handleImportContacts = () => {
    const parsed = parseSpreadsheetContacts(importText)
    if (parsed.length === 0) {
      toast({
        title: 'Nothing to import',
        description: 'Paste a spreadsheet (with headers) into the box first.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    const existingAccountNames = loadAccountNamesFromStorage()
    const canonicalByLower = new Map(existingAccountNames.map((n) => [n.trim().toLowerCase(), n] as const))
    const deleted = loadDeletedAccountsFromStorage()

    const normalizeAccount = (rawAccount: string) => {
      const cleaned = rawAccount.trim()
      const canonical = canonicalByLower.get(cleaned.toLowerCase())
      return canonical || cleaned
    }

    const missingAccounts = new Set<string>()
    const nextContacts: Contact[] = [...contactsData]
    const indexByKey = new Map<string, number>()
    for (let i = 0; i < nextContacts.length; i++) {
      const c = nextContacts[i]
      const key = `${c.account.toLowerCase()}|${(c.email || c.name).toLowerCase()}`
      indexByKey.set(key, i)
    }

    let created = 0
    let updated = 0
    let skippedDeletedAccount = 0

    for (const row of parsed) {
      const account = normalizeAccount(row.account || '')
      if (!account) continue
      if (deleted.has(account)) {
        skippedDeletedAccount++
        continue
      }

      if (!canonicalByLower.has(account.toLowerCase()) && createMissingAccounts) {
        missingAccounts.add(account)
      }

      const name = (row.name || '').trim()
      const email = (row.email || '').trim()
      const phone = (row.phone || '').trim()
      const title = (row.title || '').trim()

      const key = `${account.toLowerCase()}|${(email || name || phone).toLowerCase()}`
      const existingIndex = indexByKey.get(key)

      if (existingIndex !== undefined) {
        const prev = nextContacts[existingIndex]
        const merged: Contact = {
          ...prev,
          account,
          name: name || prev.name,
          title: title || prev.title,
          email: email || prev.email,
          phone: phone || prev.phone,
          tier: prev.tier || 'Decision maker',
          status: prev.status || 'Active',
        }
        nextContacts[existingIndex] = merged
        updated++
      } else {
        nextContacts.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          account,
          name: name || '(Unnamed contact)',
          title: title || '',
          email: email || '',
          phone: phone || '',
          tier: 'Decision maker',
          status: 'Active',
        })
        indexByKey.set(key, nextContacts.length - 1)
        created++
      }
    }

    // Optionally create missing accounts so contacts are linked.
    let createdAccountsCount = 0
    if (createMissingAccounts && missingAccounts.size > 0) {
      try {
        const accounts = getJson<any[]>(OdcrmStorageKeys.accounts) || []
        const existingLower = new Set(accounts.map((a) => String(a?.name || '').toLowerCase()).filter(Boolean))

        for (const name of missingAccounts) {
          if (existingLower.has(name.toLowerCase())) continue
          accounts.push(buildBlankAccount(name))
          existingLower.add(name.toLowerCase())
          createdAccountsCount++
        }

        setJson(OdcrmStorageKeys.accounts, accounts)
        setItem(OdcrmStorageKeys.accountsLastUpdated, new Date().toISOString())
        emit('accountsUpdated', accounts)
      } catch (e) {
        console.warn('Failed to create missing accounts during contacts import', e)
      }
    }

    setContactsData(nextContacts)
    onImportClose()
    setImportText('')

    const parts: string[] = []
    if (created > 0) parts.push(`Imported ${created} new contact(s).`)
    if (updated > 0) parts.push(`Updated ${updated} existing contact(s).`)
    if (createdAccountsCount > 0) parts.push(`Created ${createdAccountsCount} new account(s).`)
    if (skippedDeletedAccount > 0) parts.push(`${skippedDeletedAccount} row(s) skipped (account was deleted).`)

    toast({
      title: 'Contacts imported',
      description: parts.join(' '),
      status: 'success',
      duration: 6000,
      isClosable: true,
    })
  }

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
          <Button variant="outline" onClick={onImportOpen}>
            Import Spreadsheet
          </Button>
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
                    emit('navigateToAccount', { accountName: contact.account })
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

      {/* Spreadsheet Import Modal */}
      <Modal isOpen={isImportOpen} onClose={onImportClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Import contacts from spreadsheet</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Text fontSize="sm" color="gray.600">
                Paste a table copied from Excel/Google Sheets (include the header row). Supported headers include:
                Account/Client, Contact Name, Job Title, Email Address, Telephone/Contact Number.
              </Text>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste spreadsheet here (Ctrl+V)..."
                minH="220px"
                fontFamily="mono"
                fontSize="sm"
              />
              <Checkbox
                isChecked={createMissingAccounts}
                onChange={(e) => setCreateMissingAccounts(e.target.checked)}
              >
                Create missing accounts automatically (recommended to keep links in sync)
              </Checkbox>
              <Text fontSize="xs" color="gray.500">
                Tip: Press Ctrl+Shift+U to show Data Portability if you need to export/import full snapshots.
              </Text>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onImportClose}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={handleImportContacts} ml={3}>
              Import
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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

