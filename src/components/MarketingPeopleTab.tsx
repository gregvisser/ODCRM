import { useEffect, useMemo, useState, useRef } from 'react'
import {
  Box,
  Heading,
  HStack,
  Input,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Badge,
  Button,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  VStack,
  FormControl,
  FormLabel,
  useToast,
  Alert,
  AlertIcon,
  Code,
} from '@chakra-ui/react'
import { AddIcon } from '@chakra-ui/icons'
import { api } from '../utils/api'
import Papa from 'papaparse'

type Contact = {
  id: string
  customerId: string
  firstName: string
  lastName: string
  jobTitle?: string | null
  companyName: string
  email: string
  phone?: string | null
  source?: string
  status?: string
  createdAt: string
  updatedAt: string
}

type ContactFormState = {
  id?: string
  email: string
  firstName: string
  lastName: string
  companyName: string
  jobTitle: string
  phone: string
  status: string
}

export default function MarketingPeopleTab() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Contact[]>([])
  const [q, setQ] = useState('')
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [contactForm, setContactForm] = useState<ContactFormState>({
    email: '',
    firstName: '',
    lastName: '',
    companyName: '',
    jobTitle: '',
    phone: '',
    status: 'active',
  })
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  
  const { isOpen: isImportOpen, onOpen: onImportOpen, onClose: onImportClose } = useDisclosure()
  const { isOpen: isContactFormOpen, onOpen: onContactFormOpen, onClose: onContactFormClose } = useDisclosure()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()
  const toast = useToast()

  const fetchContacts = async () => {
    setLoading(true)
    const { data } = await api.get<Contact[]>('/api/contacts')
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchContacts()
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return items
    return items.filter((c) =>
      [c.firstName, c.lastName, c.email, c.companyName, c.jobTitle, c.phone, c.source]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [items, q])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          // Map CSV columns to our format
          const mapped = results.data.map((row: any) => ({
            email: row.email || row.Email || row['Email Address'] || '',
            firstName: row.firstName || row.FirstName || row['First Name'] || '',
            lastName: row.lastName || row.LastName || row['Last Name'] || '',
            companyName: row.companyName || row.company || row.Company || row.Organization || '',
            jobTitle: row.jobTitle || row.title || row.Title || row['Job Title'] || '',
            phone: row.phone || row.Phone || row['Phone Number'] || '',
            source: 'csv_import',
          }))

          // Filter out rows without email
          const valid = mapped.filter((c: any) => c.email && c.email.includes('@'))
          setImportPreview(valid)
          onImportOpen()
        },
      })
    }
    reader.readAsText(file)
  }

  const handleImportConfirm = async () => {
    if (importPreview.length === 0) return

    setImporting(true)
    try {
      const { data, error } = await api.post('/api/contacts/bulk-upsert', {
        contacts: importPreview,
      })

      if (error) {
        toast({
          title: 'Import Error',
          description: error,
          status: 'error',
          duration: 5000,
        })
      } else if (data) {
        toast({
          title: 'Import Successful',
          description: `Created ${(data as any).created || 0}, updated ${(data as any).updated || 0} contact(s)`,
          status: 'success',
          duration: 5000,
        })
        onImportClose()
        setImportPreview([])
        fetchContacts()
      }
    } catch (err: any) {
      toast({
        title: 'Import Failed',
        description: err.message || 'Unknown error',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setImporting(false)
    }
  }

  const handleCreateContact = () => {
    setEditingContact(null)
    setContactForm({
      email: '',
      firstName: '',
      lastName: '',
      companyName: '',
      jobTitle: '',
      phone: '',
      status: 'active',
    })
    onContactFormOpen()
  }

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setContactForm({
      id: contact.id,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      companyName: contact.companyName,
      jobTitle: contact.jobTitle || '',
      phone: contact.phone || '',
      status: contact.status || 'active',
    })
    onContactFormOpen()
  }

  const handleSaveContact = async () => {
    if (!contactForm.email || !contactForm.companyName) {
      toast({
        title: 'Validation Error',
        description: 'Email and Company are required',
        status: 'error',
        duration: 3000,
      })
      return
    }

    const payload = {
      email: contactForm.email,
      firstName: contactForm.firstName,
      lastName: contactForm.lastName,
      companyName: contactForm.companyName,
      jobTitle: contactForm.jobTitle || undefined,
      phone: contactForm.phone || undefined,
      source: editingContact ? editingContact.source : 'manual',
    }

    // Note: This endpoint doesn't exist yet in ODCRM - would need to create it
    // For now, this is a placeholder for the full migration
    const endpoint = editingContact
      ? `/api/contacts/${editingContact.id}`
      : '/api/contacts'
    
    const method = editingContact ? 'PUT' : 'POST'

    try {
      const apiUrl = window.location.hostname.includes('localhost') 
        ? 'http://localhost:3001' 
        : 'https://odcrm-api.onrender.com'
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Failed to save contact')
      }

      toast({
        title: 'Success',
        description: editingContact ? 'Contact updated' : 'Contact created',
        status: 'success',
        duration: 3000,
      })

      onContactFormClose()
      fetchContacts()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save contact',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleDeleteClick = (contact: Contact) => {
    setContactToDelete(contact)
    onDeleteOpen()
  }

  const handleDeleteConfirm = async () => {
    if (!contactToDelete) return

    try {
      const apiUrl = window.location.hostname.includes('localhost') 
        ? 'http://localhost:3001' 
        : 'https://odcrm-api.onrender.com'
      const response = await fetch(`${apiUrl}/api/contacts/${contactToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete contact')
      }

      toast({
        title: 'Success',
        description: 'Contact deleted',
        status: 'success',
        duration: 3000,
      })

      onDeleteClose()
      fetchContacts()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete contact',
        status: 'error',
        duration: 3000,
      })
    }
    setContactToDelete(null)
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
      <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
        <Box>
          <Heading size="lg">People</Heading>
          <Text fontSize="sm" color="gray.600">
            Imported contacts (Cognism → Contacts). This mirrors Reply.io “People”.
          </Text>
        </Box>
        <HStack>
          <Box textAlign="right" mr={2}>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, company..." size="sm" />
            <Text fontSize="xs" color="gray.500" mt={1}>
              Showing <strong>{filtered.length}</strong> of {items.length}
            </Text>
          </Box>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="teal"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Import CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </HStack>
      </HStack>

      <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200" overflowX="auto">
        <Table size="sm">
          <Thead bg="gray.50">
            <Tr>
              <Th>Name</Th>
              <Th>Company</Th>
              <Th>Email</Th>
              <Th>Title</Th>
              <Th>Source</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.slice(0, 1000).map((c) => (
              <Tr key={c.id}>
                <Td>
                  {c.firstName} {c.lastName}
                </Td>
                <Td>{c.companyName}</Td>
                <Td>{c.email}</Td>
                <Td>{c.jobTitle || '-'}</Td>
                <Td>
                  <Badge colorScheme={c.source === 'cognism' ? 'purple' : 'gray'}>{c.source || 'unknown'}</Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      {/* Import Preview Modal */}
      <Modal isOpen={isImportOpen} onClose={onImportClose} size="4xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Import Contacts - Preview</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Alert status="info">
                <AlertIcon />
                <Text fontSize="sm">
                  Previewing <strong>{importPreview.length}</strong> contact(s). Duplicate emails will be updated.
                </Text>
              </Alert>

              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  CSV Column Mapping:
                </Text>
                <Text fontSize="xs" color="gray.600">
                  We automatically map columns like <Code>email</Code>, <Code>firstName</Code>, <Code>lastName</Code>,{' '}
                  <Code>company</Code>, <Code>jobTitle</Code>, <Code>phone</Code>
                </Text>
              </Box>

              <Box maxH="300px" overflowY="auto" border="1px solid" borderColor="gray.200" borderRadius="md">
                <Table size="sm">
                  <Thead bg="gray.50" position="sticky" top={0} zIndex={1}>
                    <Tr>
                      <Th>Email</Th>
                      <Th>First Name</Th>
                      <Th>Last Name</Th>
                      <Th>Company</Th>
                      <Th>Title</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {importPreview.slice(0, 100).map((contact, idx) => (
                      <Tr key={idx}>
                        <Td fontSize="xs">{contact.email}</Td>
                        <Td fontSize="xs">{contact.firstName || '-'}</Td>
                        <Td fontSize="xs">{contact.lastName || '-'}</Td>
                        <Td fontSize="xs">{contact.companyName || '-'}</Td>
                        <Td fontSize="xs">{contact.jobTitle || '-'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>

              {importPreview.length > 100 && (
                <Text fontSize="xs" color="gray.500">
                  Showing first 100 of {importPreview.length} contacts
                </Text>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onImportClose} isDisabled={importing}>
              Cancel
            </Button>
            <Button
              colorScheme="teal"
              onClick={handleImportConfirm}
              isLoading={importing}
              loadingText="Importing..."
            >
              Confirm Import ({importPreview.length})
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}

