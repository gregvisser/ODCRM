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
  Alert,
  AlertIcon,
  Checkbox,
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, EditIcon, AttachmentIcon } from '@chakra-ui/icons'
import { emit, on } from '../platform/events'
import { OdcrmStorageKeys } from '../platform/keys'
import { getJson, setItem, setJson, keys, removeItem } from '../platform/storage'
import { useExportImport } from '../utils/exportImport'

export type Contact = {
  id: string
  name: string
  title: string
  accounts: string[] // Changed from single account to array to support multiple accounts
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
    accounts: ['Seven Clean Seas'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'oliver.kade@sevencleanseas.com',
    phone: '07123456789',
  },
  {
    id: '2',
    name: 'Wafi Ramadhani',
    title: 'Operations Lead',
    accounts: ['Seven Clean Seas'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'wafi.ramadhani@sevencleanseas.com',
    phone: '+6281382002114',
  },
  {
    id: '3',
    name: 'Pamela Correia',
    title: 'Co-Founder',
    accounts: ['Seven Clean Seas'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'pamela.correia@sevencleanseas.com',
    phone: '+62819625294',
  },
  {
    id: '4',
    name: 'Chris Piper',
    title: 'Business Manager',
    accounts: ['OCS'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'chris.piper@ocs.com',
    phone: '07123456789',
  },
  {
    id: '5',
    name: 'Sanjay Patel',
    title: 'Sales Director UK&I',
    accounts: ['OCS'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'sanjay.patel@ocs.com',
    phone: '07123456789',
  },
  {
    id: '6',
    name: 'Ben Windsor',
    title: 'Sales Director Catering',
    accounts: ['OCS'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'ben.windsor@ocs.com',
    phone: '07123456789',
  },
  {
    id: '7',
    name: 'Dan Stewart',
    title: 'Sales Director Cleaning and Security',
    accounts: ['OCS'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'dan.stewart@ocs.com',
    phone: '07123456789',
  },
  {
    id: '8',
    name: 'Bilal Khalid',
    title: 'Sales Director Hard Services',
    accounts: ['OCS'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'bilal.khalid@ocs.com',
    phone: '07123456789',
  },
  {
    id: '9',
    name: 'Omer Khalid',
    title: 'Sales Director Facilities',
    accounts: ['OCS'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'omer.khalid@ocs.com',
    phone: '07123456789',
  },
  {
    id: '10',
    name: 'Omer Khalid',
    title: 'COO',
    accounts: ['MaxSpace Projects'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'carlos@maxspaceprojects.co.uk',
    phone: '07123456789',
  },
  {
    id: '11',
    name: 'Rephael Barreto',
    title: 'Managing Director',
    accounts: ['Verve Connect'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'raphael.barreto@verveconnect.co.uk',
    phone: '07123456789',
  },
  {
    id: '12',
    name: 'Dan Stewart',
    title: 'Director',
    accounts: ['Shield Pest Control'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'dan.steward@shieldpestcontrol.co.uk',
    phone: '07123456789',
  },
  {
    id: '13',
    name: 'Sanjay Patel',
    title: 'Director',
    accounts: ['My Purchasing Partner'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'sanjay.patel@mypurchasingpartner.com',
    phone: '07123456789',
  },
  {
    id: '14',
    name: 'Ben Windsor',
    title: 'Director',
    accounts: ['Octavian Security'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'ben.windsor@octaviansecurity.com',
    phone: '07123456789',
  },
  {
    id: '15',
    name: 'Chris Piper',
    title: 'Director',
    accounts: ['Beauparc'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'chris.piper@beauparc.ie',
    phone: '07123456789',
  },
  {
    id: '16',
    name: 'Bilal Khalid',
    title: 'Director',
    accounts: ['FusionTek'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'bilal.khalid@fusiontek.co.uk',
    phone: '07123456789',
  },
  {
    id: '17',
    name: 'Oliver Kade',
    title: 'Director',
    accounts: ['Legionella'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'oliver.kade@legionellacontrol.com',
    phone: '07123456789',
  },
  {
    id: '18',
    name: 'Pamela Correia',
    title: 'Technical Operations Manager',
    accounts: ['P&R Morson FM'],
    tier: 'Decision maker',
    status: 'Active',
    email: 'pamela.correia@morsonfm.co.uk',
    phone: '07123456789',
  },
]

// Migration helper: convert old single account to accounts array
function migrateContact(contact: any): Contact {
  if (contact.accounts && Array.isArray(contact.accounts)) {
    return contact as Contact
  }
  // Legacy contact with single account field
  return {
    ...contact,
    accounts: contact.account ? [contact.account] : [],
  }
}

// Load deleted contacts from storage
function loadDeletedContactsFromStorage(): Set<string> {
  const parsed = getJson<string[]>(OdcrmStorageKeys.deletedContacts)
  return new Set(Array.isArray(parsed) ? parsed : [])
}

// Save deleted contacts to storage
function saveDeletedContactsToStorage(deletedIds: string[]) {
  setJson(OdcrmStorageKeys.deletedContacts, deletedIds)
}

// Load contacts from storage or use default
function loadContactsFromStorage(): Contact[] {
  const parsed = getJson<Contact[]>(OdcrmStorageKeys.contacts)
  const deletedContactsSet = loadDeletedContactsFromStorage()
  
  // CRITICAL: If there's ANY data in storage (even empty array), use ONLY that data
  // NEVER merge with defaults - this prevents deleted contacts from coming back
  if (parsed !== null && Array.isArray(parsed)) {
    // Filter out deleted contacts and migrate old format to new format
    const filtered = parsed
      .filter(c => !deletedContactsSet.has(c.id))
      .map(c => migrateContact(c)) // Migrate old single account to accounts array
    console.log('✅ Loaded contacts from storage:', filtered.length, `(filtered ${parsed.length - filtered.length} deleted)`)
    
    // If any contacts were migrated, save them back to storage
    const needsMigration = parsed.some(c => !c.accounts || !Array.isArray(c.accounts))
    if (needsMigration) {
      console.log('🔄 Migrating contacts to new format (single account -> accounts array)')
      try {
        saveContactsToStorage(filtered)
      } catch (e) {
        console.error('Failed to save migrated contacts:', e)
      }
    }
    
    return filtered
  }
  
  // ONLY if storage is completely empty and has never been initialized, use defaults
  // Check if we've ever saved contacts (indicates user has used the system)
  const hasEverSaved = localStorage.getItem(OdcrmStorageKeys.contactsLastUpdated)
  if (!hasEverSaved) {
    console.log('⚠️ No contacts in storage and never initialized, using defaults')
    // Save defaults to storage on first load
    try {
      saveContactsToStorage(defaultContacts)
      setItem(OdcrmStorageKeys.contactsLastUpdated, new Date().toISOString())
    } catch (e) {
      console.error('Failed to save default contacts:', e)
    }
    return [...defaultContacts]
  }
  
  // If storage was initialized but is now empty, return empty array (user deleted everything)
  console.log('✅ No contacts in storage (user deleted all), returning empty array')
  return []
}

// Save contacts to storage
function saveContactsToStorage(contactsData: Contact[]) {
  // Create backup before saving (keep last 5 backups)
  try {
    const currentContacts = getJson<Contact[]>(OdcrmStorageKeys.contacts)
    if (currentContacts && Array.isArray(currentContacts) && currentContacts.length > 0) {
      const backupKey = `odcrm_contacts_backup_${Date.now()}`
      setJson(backupKey, currentContacts)
      // Keep only last 5 backups
      const backupKeys = keys().filter(k => k.startsWith('odcrm_contacts_backup_')).sort()
      if (backupKeys.length > 5) {
        backupKeys.slice(0, backupKeys.length - 5).forEach(k => removeItem(k))
      }
    }
  } catch (e) {
    console.warn('Failed to create backup before save:', e)
  }
  
  setJson(OdcrmStorageKeys.contacts, contactsData)
  console.log('💾 Saved contacts to storage')
}

// Load most recent backup
function loadMostRecentBackup(): Contact[] | null {
  try {
    const backupKeys = keys()
      .filter(k => k.startsWith('odcrm_contacts_backup_'))
      .sort()
      .reverse()
    
    if (backupKeys.length === 0) return null
    
    const mostRecent = getJson<Contact[]>(backupKeys[0])
    return mostRecent && Array.isArray(mostRecent) ? mostRecent : null
  } catch (e) {
    console.warn('Failed to load backup:', e)
    return null
  }
}

// Load most recent account backup
function loadMostRecentAccountBackup(): any[] | null {
  try {
    const backupKeys = keys()
      .filter(k => k.startsWith('odcrm_accounts_backup_'))
      .sort()
      .reverse()
    
    if (backupKeys.length === 0) return null
    
    const mostRecent = getJson<any[]>(backupKeys[0])
    return mostRecent && Array.isArray(mostRecent) ? mostRecent : null
  } catch (e) {
    console.warn('Failed to load account backup:', e)
    return null
  }
}

// Restore accounts from most recent backup
function restoreAccountsFromBackup() {
  const backup = loadMostRecentAccountBackup()
  if (!backup) {
    console.warn('No account backup found')
    return false
  }

  try {
    setJson(OdcrmStorageKeys.accounts, backup)
    setItem(OdcrmStorageKeys.accountsLastUpdated, new Date().toISOString())
    emit('accountsUpdated', backup)
    console.log('✅ Restored accounts from backup')
    return true
  } catch (e) {
    console.error('Failed to restore accounts:', e)
    return false
  }
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
  account?: string
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


function ContactsTab() {
  const [contactsData, setContactsData] = useState<Contact[]>(() => {
    const loaded = loadContactsFromStorage()
    // If no contacts loaded but backups exist, try to recover from most recent backup
    if (loaded.length === 0) {
      const backup = loadMostRecentBackup()
      if (backup && backup.length > 0) {
        console.log('🔄 No contacts found, attempting recovery from backup...')
        // Migrate backup contacts to new format
        const migrated = backup.map(c => migrateContact(c))
        try {
          saveContactsToStorage(migrated)
          console.log('✅ Recovered', migrated.length, 'contacts from backup')
          return migrated
        } catch (e) {
          console.error('Failed to recover contacts from backup:', e)
        }
      }
    }
    return loaded
  })
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
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
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

  useEffect(() => {
    const refresh = () => setAvailableAccounts(loadAccountNamesFromStorage())
    refresh()

    const handleAccountsUpdated = () => {
      const names = loadAccountNamesFromStorage()
      setAvailableAccounts(names)

      // If accounts are deleted, remove those accounts from contacts (but keep contact even if all accounts deleted)
      // This prevents data loss - contacts can be reassigned to accounts later
      if (names.length > 0) {
        const setNames = new Set(names)
        setContactsData((prev) => {
          const next = prev.map((c) => {
            // Filter out deleted accounts from contact's accounts array
            const validAccounts = (c.accounts || []).filter(acc => setNames.has(acc))
            // Keep the contact even if no valid accounts remain (they can be reassigned)
            return { ...c, accounts: validAccounts }
          })
          return next
        })
      } else {
        // If no accounts exist, keep contacts but clear their accounts arrays
        // This prevents data loss
        setContactsData((prev) => {
          return prev.map((c) => ({ ...c, accounts: [] }))
        })
      }
    }

    const off = on('accountsUpdated', () => handleAccountsUpdated())
    return () => off()
  }, [])

  // Filter out invalid accounts from contacts' accounts arrays (but keep contacts even if all accounts invalid)
  // This allows contacts to exist temporarily while accounts are being created
  useEffect(() => {
    const validAccountNames = new Set(loadAccountNamesFromStorage().map(n => n.toLowerCase()))
    setContactsData(prev => {
      const updated = prev.map(c => {
        // Filter out invalid accounts from contact's accounts array
        const validAccounts = (c.accounts || []).filter(acc => validAccountNames.has(acc.toLowerCase()))
        // Keep the contact even if no valid accounts (they might be created later)
        // Just update the accounts array to only include valid ones
        return { ...c, accounts: validAccounts }
      })
      // Only update if something actually changed
      const hasChanges = updated.some((c, idx) => {
        const prevAccounts = prev[idx]?.accounts || []
        const newAccounts = c.accounts || []
        return prevAccounts.length !== newAccounts.length || 
               prevAccounts.some((acc, i) => acc !== newAccounts[i])
      })
      return hasChanges ? updated : prev
    })
  }, [availableAccounts])

  // Save contacts to localStorage whenever data changes
  useEffect(() => {
    // Mark that contacts have been saved (prevents defaults from restoring)
    setItem(OdcrmStorageKeys.contactsLastUpdated, new Date().toISOString())
    saveContactsToStorage(contactsData)
    // Dispatch event to notify other tabs (like AccountsTab) that contacts have changed
    emit('contactsUpdated', contactsData)
  }, [contactsData])

  const handleImportContacts = () => {
    // Create backup before importing
    try {
      const currentContacts = getJson<Contact[]>(OdcrmStorageKeys.contacts)
      if (currentContacts && Array.isArray(currentContacts) && currentContacts.length > 0) {
        const backupKey = `odcrm_contacts_backup_${Date.now()}`
        setJson(backupKey, currentContacts)
        console.log('💾 Created backup before import')
        // Keep only last 5 backups
        const backupKeys = keys().filter(k => k.startsWith('odcrm_contacts_backup_')).sort()
        if (backupKeys.length > 5) {
          backupKeys.slice(0, backupKeys.length - 5).forEach(k => removeItem(k))
        }
      }
    } catch (e) {
      console.warn('Failed to create backup before import:', e)
    }

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

    const nextContacts: Contact[] = [...contactsData]
    const indexByKey = new Map<string, number>()
    for (let i = 0; i < nextContacts.length; i++) {
      const c = nextContacts[i]
      // Use email or name as key (not account, since contacts can have multiple accounts)
      const key = `${(c.email || c.name).toLowerCase()}`
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

      // Only allow contacts with existing accounts - do not create new accounts
      if (!canonicalByLower.has(account.toLowerCase())) {
        // Skip this contact - account doesn't exist
        continue
      }

      const name = (row.name || '').trim()
      const email = (row.email || '').trim()
      const phone = (row.phone || '').trim()
      const title = (row.title || '').trim()

      // Use email or name as key for matching (not account)
      const key = `${(email || name || phone).toLowerCase()}`
      const existingIndex = indexByKey.get(key)

      if (existingIndex !== undefined) {
        const prev = nextContacts[existingIndex]
        // Add account to existing contact's accounts array if not already present
        const existingAccounts = prev.accounts || []
        const accountLower = account.toLowerCase()
        const hasAccount = existingAccounts.some(a => a.toLowerCase() === accountLower)
        const updatedAccounts = hasAccount ? existingAccounts : [...existingAccounts, account]
        
        const merged: Contact = {
          ...prev,
          accounts: updatedAccounts,
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
          accounts: [account],
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

    // Filter out any contacts that don't have valid accounts
    const validAccountNames = new Set(loadAccountNamesFromStorage().map(n => n.toLowerCase()))
    const filteredContacts = nextContacts.map(c => {
      // Filter out invalid accounts from contact's accounts array
      const validAccounts = (c.accounts || []).filter(acc => validAccountNames.has(acc.toLowerCase()))
      if (validAccounts.length === 0) {
        console.log(`Removing contact ${c.name} - no valid accounts`)
        return null
      }
      // Update contact with only valid accounts
      return { ...c, accounts: validAccounts }
    }).filter((c): c is Contact => c !== null)

    setContactsData(filteredContacts)
    onImportClose()
    setImportText('')

    const skippedInvalidAccount = parsed.length - created - updated - skippedDeletedAccount
    const parts: string[] = []
    if (created > 0) parts.push(`Imported ${created} new contact(s).`)
    if (updated > 0) parts.push(`Updated ${updated} existing contact(s).`)
    if (skippedDeletedAccount > 0) parts.push(`${skippedDeletedAccount} row(s) skipped (account was deleted).`)
    if (skippedInvalidAccount > 0) parts.push(`${skippedInvalidAccount} row(s) skipped (account does not exist - create account first).`)

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
    accounts: [],
    tier: 'Decision maker',
    status: 'Active',
    email: '',
    phone: '',
  })

  const handleCreateContact = () => {
    // Validate required fields
    if (!newContact.name || !newContact.accounts || newContact.accounts.length === 0 || !newContact.email) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields (Name, at least one Account, Email)',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Validate that all accounts exist
    const validAccountNames = new Set(loadAccountNamesFromStorage().map(n => n.toLowerCase()))
    const invalidAccounts = newContact.accounts.filter(acc => !validAccountNames.has(acc.toLowerCase()))
    if (invalidAccounts.length > 0) {
      toast({
        title: 'Invalid Account(s)',
        description: `Account(s) "${invalidAccounts.join(', ')}" do not exist. Please create them first in the Accounts tab.`,
        status: 'error',
        duration: 4000,
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
      accounts: [],
      tier: 'Decision maker',
      status: 'Active',
      email: '',
      phone: '',
    })

    // Close modal
    onClose()

    // Show success toast
    const accountsText = contact.accounts.length === 1 
      ? contact.accounts[0] 
      : `${contact.accounts.length} accounts`
    toast({
      title: 'Contact Created',
      description: `${contact.name} has been successfully created and linked to ${accountsText}`,
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
      accounts: contact.accounts || [],
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
    if (!newContact.name || !newContact.accounts || newContact.accounts.length === 0 || !newContact.email) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields (Name, at least one Account, Email)',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Validate that all accounts exist
    const validAccountNames = new Set(loadAccountNamesFromStorage().map(n => n.toLowerCase()))
    const invalidAccounts = newContact.accounts.filter(acc => !validAccountNames.has(acc.toLowerCase()))
    if (invalidAccounts.length > 0) {
      toast({
        title: 'Invalid Account(s)',
        description: `Account(s) "${invalidAccounts.join(', ')}" do not exist. Please create them first in the Accounts tab.`,
        status: 'error',
        duration: 4000,
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
      accounts: [],
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
      accounts: [],
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
      // Add to deleted contacts list
      const deletedContacts = loadDeletedContactsFromStorage()
      deletedContacts.add(contactToDelete.id)
      saveDeletedContactsToStorage(Array.from(deletedContacts))
      
      // Remove from contacts data
      const updated = contactsData.filter((c) => c.id !== contactToDelete.id)
      setContactsData(updated)
      
      // Remove from selected if it was selected
      setSelectedContactIds(prev => {
        const next = new Set(prev)
        next.delete(contactToDelete.id)
        return next
      })
      
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

  const handleSelectAll = (isChecked: boolean) => {
    if (isChecked) {
      setSelectedContactIds(new Set(contactsData.map(c => c.id)))
    } else {
      setSelectedContactIds(new Set())
    }
  }

  const handleSelectContact = (contactId: string, isChecked: boolean) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev)
      if (isChecked) {
        next.add(contactId)
      } else {
        next.delete(contactId)
      }
      return next
    })
  }

  const handleBulkDelete = () => {
    if (selectedContactIds.size === 0) return

    const contactsToDelete = contactsData.filter(c => selectedContactIds.has(c.id))
    const deletedContacts = loadDeletedContactsFromStorage()
    
    // Add all selected contacts to deleted list
    contactsToDelete.forEach(contact => {
      deletedContacts.add(contact.id)
    })
    saveDeletedContactsToStorage(Array.from(deletedContacts))
    
    // Remove from contacts data
    const updated = contactsData.filter(c => !selectedContactIds.has(c.id))
    setContactsData(updated)
    
    // Clear selection
    setSelectedContactIds(new Set())
    
    toast({
      title: 'Contacts Deleted',
      description: `Deleted ${contactsToDelete.length} contact(s)`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  const handleUndoLastImport = () => {
    // First, restore accounts from backup (to remove any accounts created during import)
    const accountsRestored = restoreAccountsFromBackup()
    
    // Then restore contacts
    const backup = loadMostRecentBackup()
    if (!backup) {
      // If no backup, restore to default contacts
      setContactsData(defaultContacts)
      toast({
        title: 'Contacts restored',
        description: accountsRestored 
          ? 'Restored to default contacts and accounts from backup (no contact backup found)'
          : 'Restored to default contacts (no backup found)',
        status: accountsRestored ? 'success' : 'info',
        duration: 4000,
        isClosable: true,
      })
      return
    }

    setContactsData(backup)
    toast({
      title: 'Import undone',
      description: accountsRestored
        ? 'Restored contacts and accounts from before the last import'
        : 'Restored contacts from before the last import',
      status: 'success',
      duration: 4000,
      isClosable: true,
    })
  }

  const handleUndoLastDelete = () => {
    // Restore the most recently deleted contact
    const deletedContacts = loadDeletedContactsFromStorage()
    if (deletedContacts.size === 0) {
      toast({
        title: 'Nothing to undo',
        description: 'No deleted contacts to restore',
        status: 'info',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Get the most recent backup to find the deleted contact
    const backup = loadMostRecentBackup()
    if (!backup) {
      toast({
        title: 'Cannot undo',
        description: 'No backup found to restore deleted contact',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Find contacts in backup that are in deleted list but not in current data
    const currentContactIds = new Set(contactsData.map(c => c.id))
    const deletedToRestore = backup.filter(c => deletedContacts.has(c.id) && !currentContactIds.has(c.id))
    
    if (deletedToRestore.length === 0) {
      toast({
        title: 'Nothing to undo',
        description: 'No deleted contacts found in backup',
        status: 'info',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Restore the most recently deleted contact (first one found)
    const contactToRestore = deletedToRestore[0]
    
    // Remove from deleted list
    deletedContacts.delete(contactToRestore.id)
    saveDeletedContactsToStorage(Array.from(deletedContacts))
    
    // Add back to contacts
    setContactsData([...contactsData, contactToRestore])
    
    toast({
      title: 'Contact restored',
      description: `${contactToRestore.name} has been restored`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  // Prepare contacts data for CSV export (flatten accounts array to comma-separated string)
  const contactsForExport = contactsData.map(contact => ({
    id: contact.id,
    name: contact.name,
    title: contact.title || '',
    accounts: (contact.accounts || []).join('; '), // Join multiple accounts with semicolon
    tier: contact.tier || '',
    status: contact.status || '',
    email: contact.email || '',
    phone: contact.phone || '',
  }))

  const { exportData: exportContactsData } = useExportImport({
    data: contactsForExport,
    filename: 'contacts',
    toast,
  })

  return (
    <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.100" boxShadow="sm">
      <HStack justify="space-between" p={6} pb={4} flexWrap="wrap" gap={4}>
        <Heading size="md">Contacts by account</Heading>
        <HStack spacing={3} flexWrap="wrap">
          {selectedContactIds.size > 0 && (
            <Button
              leftIcon={<DeleteIcon />}
              colorScheme="red"
              variant="solid"
              onClick={handleBulkDelete}
            >
              Delete Selected ({selectedContactIds.size})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => exportContactsData('csv')}
            isDisabled={contactsData.length === 0}
          >
            Export CSV
          </Button>
          <Button leftIcon={<AttachmentIcon />} colorScheme="blue" variant="outline" onClick={onImportOpen}>
            Import Spreadsheet
          </Button>
          <Button leftIcon={<AddIcon />} colorScheme="gray" onClick={onOpen}>
            Create Contact
          </Button>
        </HStack>
      </HStack>
      <Table variant="simple">
        <Thead bg="gray.50">
          <Tr>
            <Th>
              <Checkbox
                isChecked={selectedContactIds.size > 0 && selectedContactIds.size === contactsData.length}
                isIndeterminate={selectedContactIds.size > 0 && selectedContactIds.size < contactsData.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
                aria-label="Select all contacts"
              />
            </Th>
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
                <Checkbox
                  isChecked={selectedContactIds.has(contact.id)}
                  onChange={(e) => handleSelectContact(contact.id, e.target.checked)}
                  aria-label={`Select ${contact.name}`}
                />
              </Td>
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
                <Stack spacing={1}>
                  {contact.accounts && contact.accounts.length > 0 ? (
                    contact.accounts.map((account) => (
                      <Link
                        key={account}
                        color="text.muted"
                        fontWeight="medium"
                        cursor="pointer"
                        onClick={(e) => {
                          e.preventDefault()
                          // Trigger navigation to accounts tab and open the account
                          emit('navigateToAccount', { accountName: account })
                        }}
                        _hover={{ textDecoration: 'underline' }}
                        display="block"
                      >
                        {account}
                      </Link>
                    ))
                  ) : (
                    <Text fontSize="sm" color="gray.400">No accounts</Text>
                  )}
                </Stack>
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
                    colorScheme="gray"
                    variant="ghost"
                    onClick={() => handleEditClick(contact)}
                  />
                  <IconButton
                    aria-label="Delete contact"
                    icon={<DeleteIcon />}
                    size="sm"
                    colorScheme="gray"
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
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <Box>
                  <Text fontSize="sm" fontWeight="medium">Important:</Text>
                  <Text fontSize="xs" mt={1}>
                    Contacts can only be imported for existing accounts. If an account doesn't exist, create it first in the Accounts tab.
                  </Text>
                </Box>
              </Alert>
              <Text fontSize="xs" color="gray.500">
                Tip: Press Ctrl+Shift+U to show Data Portability if you need to export/import full snapshots.
              </Text>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onImportClose}>
              Cancel
            </Button>
            <Button colorScheme="gray" onClick={handleImportContacts} ml={3}>
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
              <FormLabel>Accounts (select one or more)</FormLabel>
              <Stack spacing={2} maxH="200px" overflowY="auto" border="1px solid" borderColor="gray.200" borderRadius="md" p={2}>
                {availableAccounts.map((account) => (
                  <Checkbox
                    key={account}
                    isChecked={newContact.accounts.includes(account)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewContact({ ...newContact, accounts: [...newContact.accounts, account] })
                      } else {
                        setNewContact({ ...newContact, accounts: newContact.accounts.filter(a => a !== account) })
                      }
                    }}
                  >
                    {account}
                  </Checkbox>
                ))}
                {availableAccounts.length === 0 && (
                  <Text fontSize="sm" color="gray.500">No accounts available. Create an account first.</Text>
                )}
              </Stack>
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
            <Button colorScheme="gray" onClick={handleCreateContact}>
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
              <FormLabel>Accounts (select one or more)</FormLabel>
              <Stack spacing={2} maxH="200px" overflowY="auto" border="1px solid" borderColor="gray.200" borderRadius="md" p={2}>
                {availableAccounts.map((account) => (
                  <Checkbox
                    key={account}
                    isChecked={newContact.accounts.includes(account)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewContact({ ...newContact, accounts: [...newContact.accounts, account] })
                      } else {
                        setNewContact({ ...newContact, accounts: newContact.accounts.filter(a => a !== account) })
                      }
                    }}
                  >
                    {account}
                  </Checkbox>
                ))}
                {availableAccounts.length === 0 && (
                  <Text fontSize="sm" color="gray.500">No accounts available. Create an account first.</Text>
                )}
              </Stack>
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
            <Button colorScheme="gray" onClick={handleUpdateContact}>
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
              <Button colorScheme="gray" onClick={handleDeleteConfirm} ml={3}>
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

