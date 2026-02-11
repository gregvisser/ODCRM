import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  HStack,
  Text,
  IconButton,
  useToast,
  Divider,
  Badge,
  SimpleGrid,
  Heading,
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, EmailIcon, PhoneIcon } from '@chakra-ui/icons'

interface CustomerContact {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  title?: string | null
  isPrimary: boolean
  notes?: string | null
}

interface CustomerContactsSectionProps {
  contacts: CustomerContact[]
  onChange: (next: CustomerContact[]) => void
}

export function CustomerContactsSection({ contacts, onChange }: CustomerContactsSectionProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  
  // New contact form state
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
  })
  
  const toast = useToast()

  const additionalContacts = useMemo(() => {
    const list = Array.isArray(contacts) ? contacts : []
    return list.filter((c) => !c.isPrimary)
  }, [contacts])

  // Add new contact
  const handleAddContact = async () => {
    if (!newContact.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Contact name is required',
        status: 'warning',
        duration: 2000,
      })
      return
    }

    setIsAdding(true)
    try {
      const next: CustomerContact = {
        id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: newContact.name.trim(),
        email: newContact.email.trim() || null,
        phone: newContact.phone.trim() || null,
        title: newContact.title.trim() || null,
        isPrimary: false,
        notes: null,
      }

      onChange([...(Array.isArray(contacts) ? contacts : []), next])

      // Reset form
      setNewContact({ name: '', email: '', phone: '', title: '' })
      setShowAddForm(false)
    } catch (err) {
      console.error('Error adding contact:', err)
    } finally {
      setIsAdding(false)
    }
  }

  // Delete contact
  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Delete this contact?')) return

    try {
      onChange((Array.isArray(contacts) ? contacts : []).filter((c) => c.id !== contactId))
    } catch (err) {
      console.error('Error deleting contact:', err)
    }
  }

  return (
    <Box>
      <Heading size="sm" mb={1}>
        Contacts
      </Heading>
      <Text fontSize="sm" color="gray.600" mb={4}>
        Additional contacts are saved when you click “Save Onboarding”.
      </Text>

      {/* Existing contacts list */}
      {additionalContacts.length > 0 && (
        <VStack align="stretch" spacing={3} mb={4}>
          {additionalContacts.map((contact) => (
            <Box
              key={contact.id}
              p={3}
              bg="gray.50"
              borderRadius="md"
              border="1px solid"
              borderColor="gray.200"
            >
              <HStack justify="space-between">
                <VStack align="start" spacing={1} flex={1}>
                  <HStack>
                    <Text fontWeight="medium">{contact.name}</Text>
                    {contact.isPrimary && (
                      <Badge colorScheme="blue" fontSize="xs">
                        Primary
                      </Badge>
                    )}
                  </HStack>
                  {contact.title && (
                    <Text fontSize="sm" color="gray.600">
                      {contact.title}
                    </Text>
                  )}
                  <HStack spacing={3} fontSize="sm" color="gray.600">
                    {contact.email && (
                      <HStack spacing={1}>
                        <EmailIcon boxSize={3} />
                        <Text>{contact.email}</Text>
                      </HStack>
                    )}
                    {contact.phone && (
                      <HStack spacing={1}>
                        <PhoneIcon boxSize={3} />
                        <Text>{contact.phone}</Text>
                      </HStack>
                    )}
                  </HStack>
                </VStack>
                <IconButton
                  aria-label="Delete contact"
                  icon={<DeleteIcon />}
                  size="sm"
                  colorScheme="red"
                  variant="ghost"
                  onClick={() => handleDeleteContact(contact.id)}
                />
              </HStack>
            </Box>
          ))}
        </VStack>
      )}

      {/* Add contact form */}
      {showAddForm ? (
        <Box p={4} bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.200">
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Name</FormLabel>
              <Input
                size="sm"
                bg="white"
                value={newContact.name}
                onChange={(e) => setNewContact((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Full name"
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Job Title</FormLabel>
              <Input
                size="sm"
                bg="white"
                value={newContact.title}
                onChange={(e) => setNewContact((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Job title"
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Email</FormLabel>
              <Input
                size="sm"
                bg="white"
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="email@company.com"
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Phone</FormLabel>
              <Input
                size="sm"
                bg="white"
                value={newContact.phone}
                onChange={(e) => setNewContact((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone number"
              />
            </FormControl>
          </SimpleGrid>
          <HStack mt={3} spacing={2}>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={handleAddContact}
              isLoading={isAdding}
              isDisabled={!newContact.name.trim()}
            >
              Save Contact
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAddForm(false)
                setNewContact({ name: '', email: '', phone: '', title: '' })
              }}
              isDisabled={isAdding}
            >
              Cancel
            </Button>
          </HStack>
        </Box>
      ) : (
        <Button
          size="sm"
          leftIcon={<AddIcon />}
          colorScheme="blue"
          variant="outline"
          onClick={() => setShowAddForm(true)}
        >
          Add Contact
        </Button>
      )}
    </Box>
  )
}
