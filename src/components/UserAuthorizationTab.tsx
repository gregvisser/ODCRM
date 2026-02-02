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
  VStack,
  Text,
  FormHelperText,
  Flex,
  Spinner,
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons'
import { useUsersFromDatabase, type DatabaseUser } from '../hooks/useUsersFromDatabase'

export type User = DatabaseUser

const parseAllowlistEmails = (): string[] => {
  const raw = import.meta.env.VITE_AUTH_ALLOWED_EMAILS
  if (!raw) return []
  return raw
    .split(/[,\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

const toDisplayName = (email: string): { firstName: string; lastName: string } => {
  const local = email.split('@')[0] || ''
  const parts = local.split(/[._-]+/).filter(Boolean)
  if (parts.length === 0) return { firstName: 'User', lastName: '' }
  const [first, ...rest] = parts
  const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
  return {
    firstName: cap(first),
    lastName: rest.map(cap).join(' ') || '',
  }
}

const buildSeedUsers = (emails: string[]): User[] => {
  const createdDate = new Date().toISOString().split('T')[0]
  return emails.map((email, index) => {
    const name = toDisplayName(email)
    const seedId = `ODS${String(Date.now() + index).slice(-8).padStart(8, '0')}`
    return {
      id: seedId,
      userId: seedId,
      firstName: name.firstName,
      lastName: name.lastName,
      email,
      username: email,
      password: '',
      phoneNumber: '',
      role: 'Operations',
      department: 'Operations',
      accountStatus: 'Active',
      lastLoginDate: 'Never',
      createdDate,
      profilePhoto: '',
    }
  })
}

// Generate a unique user ID in format ODS + 8 numbers
const generateUserId = (existingUserIds: string[]): string => {
  const existingIds = new Set(existingUserIds)
  
  let newId: string
  let attempts = 0
  do {
    // Generate 8 random digits
    const randomNum = Math.floor(10000000 + Math.random() * 90000000)
    newId = `ODS${randomNum}`
    attempts++
    if (attempts > 100) {
      // Fallback: use timestamp if we can't generate unique ID
      const timestamp = Date.now().toString().slice(-8)
      newId = `ODS${timestamp.padStart(8, '0')}`
      break
    }
  } while (existingIds.has(newId))
  
  return newId
}

function UserAuthorizationTab() {
  // Use database hook for user management
  const { users, loading, error, createUser, updateUser, deleteUser } = useUsersFromDatabase()
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const toast = useToast()

  const [formData, setFormData] = useState<Partial<User>>({
    userId: '',
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    phoneNumber: '',
    role: '',
    department: '',
    accountStatus: 'Active',
    lastLoginDate: '',
    createdDate: new Date().toISOString().split('T')[0],
    profilePhoto: '',
  })

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        userId: '',
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        password: '',
        phoneNumber: '',
        role: '',
        department: '',
        accountStatus: 'Active',
        lastLoginDate: '',
        createdDate: new Date().toISOString().split('T')[0],
        profilePhoto: '',
      })
      setSelectedUser(null)
      setIsEditing(false)
    }
  }, [isOpen])

  // Auto-set username to email when email changes (for new users)
  useEffect(() => {
    if (!isEditing && formData.email) {
      setFormData((prev) => ({ ...prev, username: formData.email || '' }))
    }
  }, [formData.email, isEditing])

  const handleCreate = () => {
    const newUserId = generateUserId(users.map(u => u.userId))
    setFormData({
      userId: newUserId,
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      phoneNumber: '',
      role: '',
      department: '',
      accountStatus: 'Active',
      lastLoginDate: '',
      createdDate: new Date().toISOString().split('T')[0],
      profilePhoto: '',
    })
    setIsEditing(false)
    setSelectedUser(null)
    onOpen()
  }

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    setFormData({
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username || user.email,
      password: '',
      phoneNumber: user.phoneNumber || '',
      role: user.role,
      department: user.department || '',
      accountStatus: user.accountStatus,
      lastLoginDate: user.lastLoginDate || '',
      createdDate: user.createdDate,
      profilePhoto: user.profilePhoto || '',
    })
    setIsEditing(true)
    onOpen()
  }

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, profilePhoto: reader.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDelete = (user: User) => {
    setSelectedUser(user)
    onDeleteOpen()
  }

  const confirmDelete = async () => {
    if (selectedUser) {
      const { error } = await deleteUser(selectedUser.id)
      
      if (error) {
        toast({
          title: 'Error',
          description: error,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        return
      }
      
      toast({
        title: 'User deleted',
        description: `${selectedUser.firstName} ${selectedUser.lastName} has been deleted.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
      onDeleteClose()
      setSelectedUser(null)
    }
  }

  const handleSave = async () => {
    // Validation
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.username ||
      !formData.role ||
      !formData.department
    ) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email || '')) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid email address.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    if (isEditing && selectedUser) {
      // Update existing user
      const { error } = await updateUser(selectedUser.id, {
        userId: formData.userId || selectedUser.userId,
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
        email: formData.email || '',
        username: formData.username || formData.email || '',
        phoneNumber: formData.phoneNumber || '',
        role: formData.role || '',
        department: formData.department || '',
        accountStatus: formData.accountStatus || 'Active',
        lastLoginDate: formData.lastLoginDate || selectedUser.lastLoginDate,
        profilePhoto: formData.profilePhoto || selectedUser.profilePhoto,
      } as Partial<User>)
      
      if (error) {
        toast({
          title: 'Error',
          description: error,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        return
      }
      
      toast({
        title: 'User updated',
        description: `${formData.firstName} ${formData.lastName} has been updated.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } else {
      // Create new user
      const newUserId = formData.userId || generateUserId(users.map(u => u.userId))
      const { error } = await createUser({
        userId: newUserId,
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
        email: formData.email || '',
        username: formData.username || formData.email || '',
        phoneNumber: formData.phoneNumber || '',
        role: formData.role || '',
        department: formData.department || '',
        accountStatus: formData.accountStatus || 'Active',
        lastLoginDate: formData.lastLoginDate || 'Never',
        createdDate: formData.createdDate || new Date().toISOString().split('T')[0],
        profilePhoto: formData.profilePhoto || '',
      })
      
      if (error) {
        toast({
          title: 'Error',
          description: error,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        return
      }
      
      toast({
        title: 'User created',
        description: `${formData.firstName} ${formData.lastName} has been created.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    }
    onClose()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'green'
      case 'Inactive':
        return 'gray'
      default:
        return 'gray'
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'Never') return 'Never'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const handleExport = (format: 'json' | 'csv' = 'json') => {
    try {
      if (format === 'json') {
        const dataStr = JSON.stringify(users, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `users-export-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } else {
        // CSV export
        const headers = [
          'User ID',
          'First Name',
          'Last Name',
          'Username',
          'Phone Number',
          'Role',
          'Department',
          'Account Status',
          'Last Login Date',
          'Created Date',
        ]
        
        const csvRows = [
          headers.join(','),
          ...users.map((user) =>
            [
              user.userId,
              `"${user.firstName.replace(/"/g, '""')}"`,
              `"${user.lastName.replace(/"/g, '""')}"`,
              `"${(user.username || user.email).replace(/"/g, '""')}"`,
              `"${(user.phoneNumber || '').replace(/"/g, '""')}"`,
              `"${user.role.replace(/"/g, '""')}"`,
              `"${user.department.replace(/"/g, '""')}"`,
              user.accountStatus,
              formatDate(user.lastLoginDate),
              formatDate(user.createdDate),
            ].join(',')
          ),
        ]
        
        const csvContent = csvRows.join('\n')
        const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
      
      toast({
        title: 'Export successful',
        description: `${users.length} user(s) exported as ${format.toUpperCase()}.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export user data.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  // Parse CSV content into array of objects
  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim())
    if (lines.length < 2) {
      return []
    }

    // Parse header row with proper CSV parsing
    const parseCSVLine = (line: string): string[] => {
      const values: string[] = []
      let current = ''
      let inQuotes = false

      for (let j = 0; j < line.length; j++) {
        const char = line[j]
        if (char === '"') {
          if (inQuotes && line[j + 1] === '"') {
            // Escaped quote
            current += '"'
            j++
          } else {
            // Toggle quote state
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          // End of field
          values.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      // Add last field
      values.push(current.trim())
      return values
    }

    const headerValues = parseCSVLine(lines[0])
    const headers = headerValues.map((h) => {
      const cleanHeader = h.trim().replace(/^"|"$/g, '')
      // Map CSV headers to user object properties
      const headerMap: Record<string, string> = {
        'User ID': 'userId',
        'First Name': 'firstName',
        'Last Name': 'lastName',
        Email: 'email',
        'Email Address': 'email',
        Username: 'username',
        'Phone Number': 'phoneNumber',
        Role: 'role',
        Department: 'department',
        'Account Status': 'accountStatus',
        'Last Login Date': 'lastLoginDate',
        'Created Date': 'createdDate',
      }
      return headerMap[cleanHeader] || cleanHeader.toLowerCase().replace(/\s+/g, '')
    })

    // Parse data rows
    const users: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line.trim()) continue

      const values = parseCSVLine(line)

      // Create user object from parsed values
      const user: any = {}
      headers.forEach((header, index) => {
        if (values[index] !== undefined && values[index] !== null) {
          let value = values[index].trim().replace(/^"|"$/g, '')
          // Handle empty values
          if (value === '' || value === 'Never' || value === '-') {
            // Skip empty values for optional fields
            if (['phoneNumber', 'username', 'lastLoginDate', 'userId'].includes(header)) {
              return
            }
          }
          
          // Handle date format conversion (DD/MM/YYYY to YYYY-MM-DD)
          if (header === 'createdDate' || header === 'lastLoginDate') {
            if (value && value !== 'Never' && value !== '-') {
              // Try to parse DD/MM/YYYY format
              const dateMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
              if (dateMatch) {
                const [, day, month, year] = dateMatch
                value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
              }
            }
          }
          
          user[header] = value
        }
      })

      // Only add user if it has at least firstName or email (userId will be auto-generated)
      if (user.firstName || user.email) {
        users.push(user)
      }
    }

    return users
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.csv'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const fileContent = event.target?.result as string
          const fileExtension = file.name.split('.').pop()?.toLowerCase()
          let importedData: any[]

          if (fileExtension === 'csv') {
            // Parse CSV
            importedData = parseCSV(fileContent)
          } else {
            // Parse JSON
            importedData = JSON.parse(fileContent)
          }

          // Validate imported data
          if (!Array.isArray(importedData)) {
            toast({
              title: 'Import failed',
              description: 'Invalid file format. Expected an array of users.',
              status: 'error',
              duration: 3000,
              isClosable: true,
            })
            return
          }

          // Validate each user has required fields and valid email
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          const invalidUsers: string[] = []
          
          const validUsers = importedData.filter((user: any, index: number) => {
            // Check required fields (userId is optional, will be auto-generated)
            if (!user.firstName || !user.lastName || !user.email || !user.role || !user.department) {
              invalidUsers.push(`Row ${index + 2}: Missing required fields (${user.firstName || ''} ${user.lastName || ''})`)
              return false
            }
            
            // Validate email format
            if (!emailRegex.test(user.email)) {
              invalidUsers.push(`Row ${index + 2}: Invalid email format (${user.email})`)
              return false
            }
            
            return true
          })

          if (validUsers.length === 0) {
            const errorDetails = invalidUsers.slice(0, 5).join('; ')
            const moreErrors = invalidUsers.length > 5 ? ` and ${invalidUsers.length - 5} more...` : ''
            toast({
              title: 'Import failed',
              description: `No valid users found. Issues: ${errorDetails}${moreErrors}`,
              status: 'error',
              duration: 5000,
              isClosable: true,
            })
            return
          }

          if (validUsers.length < importedData.length) {
            const errorDetails = invalidUsers.slice(0, 3).join('; ')
            const moreErrors = invalidUsers.length > 3 ? ` and ${invalidUsers.length - 3} more...` : ''
            toast({
              title: 'Partial import',
              description: `${validUsers.length} of ${importedData.length} users imported. Issues: ${errorDetails}${moreErrors}`,
              status: 'warning',
              duration: 6000,
              isClosable: true,
            })
          }

          // Generate IDs for imported users if missing
          const usersWithIds = validUsers.map((user: any) => ({
            ...user,
            id: user.id || generateUserId(),
            userId: user.userId || generateUserId(),
            username: user.username || user.email || '',
            password: user.password || '',
            phoneNumber: user.phoneNumber || '',
            accountStatus: user.accountStatus || 'Active',
            createdDate: user.createdDate || new Date().toISOString().split('T')[0],
            lastLoginDate: user.lastLoginDate || 'Never',
            profilePhoto: user.profilePhoto || '',
          }))

          // Ask user if they want to replace existing users or merge
          const existingUserIds = new Set(users.map((u) => u.userId))
          const duplicateUsers = usersWithIds.filter((u: User) => existingUserIds.has(u.userId))
          
          if (duplicateUsers.length > 0) {
            // Show confirmation dialog for duplicates
            const shouldReplace = window.confirm(
              `Found ${duplicateUsers.length} user(s) with existing User IDs. Do you want to replace existing users with imported data? (Click OK to replace, Cancel to skip duplicates)`
            )
            
            if (shouldReplace) {
              // Replace existing users with imported data
              const importedUserIds = new Set(usersWithIds.map((u: User) => u.userId))
              const nonDuplicateUsers = users.filter((u) => !importedUserIds.has(u.userId))
              const updatedUsers = [...nonDuplicateUsers, ...usersWithIds]
              setUsers(updatedUsers)
              saveUsersToStorage(updatedUsers)
              toast({
                title: 'Import successful',
                description: `${usersWithIds.length} user(s) imported. ${duplicateUsers.length} existing user(s) replaced.`,
                status: 'success',
                duration: 4000,
                isClosable: true,
              })
            } else {
              // Skip duplicates, only add new users
              const newUsers = usersWithIds.filter((u: User) => !existingUserIds.has(u.userId))
              if (newUsers.length > 0) {
                const updatedUsers = [...users, ...newUsers]
                setUsers(updatedUsers)
                saveUsersToStorage(updatedUsers)
                toast({
                  title: 'Import successful',
                  description: `${newUsers.length} new user(s) imported. ${duplicateUsers.length} duplicate(s) skipped.`,
                  status: 'success',
                  duration: 4000,
                  isClosable: true,
                })
              } else {
                toast({
                  title: 'Import cancelled',
                  description: 'All users in the file already exist. No new users imported.',
                  status: 'info',
                  duration: 3000,
                  isClosable: true,
                })
              }
            }
          } else {
            // No duplicates, just add all new users
            const updatedUsers = [...users, ...usersWithIds]
            setUsers(updatedUsers)
            saveUsersToStorage(updatedUsers)
            toast({
              title: 'Import successful',
              description: `${usersWithIds.length} new user(s) imported successfully.`,
              status: 'success',
              duration: 3000,
              isClosable: true,
            })
          }
        } catch (error) {
          toast({
            title: 'Import failed',
            description: 'Failed to parse the JSON file. Please check the file format.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          })
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // Prevent TS noUnusedLocals failure until import UI wiring is added.
  void handleImport

  return (
    <Box w="100%" h="100%" display="flex" flexDirection="column" overflow="hidden">
      <Box mb={6} w="100%">
        <Flex
          direction={{ base: 'column', md: 'row' }}
          justify="space-between"
          align={{ base: 'flex-start', md: 'center' }}
          gap={4}
          wrap="wrap"
        >
          <Heading size="md" color="text.muted">
            User Authorization Management
          </Heading>
          <HStack spacing={3} flexWrap="wrap">
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              isDisabled={users.length === 0 || loading}
              size={{ base: 'sm', md: 'md' }}
            >
              Export CSV
            </Button>
            <Button
              leftIcon={<AddIcon />}
              colorScheme="gray"
              onClick={handleCreate}
              isDisabled={loading}
              size={{ base: 'sm', md: 'md' }}
            >
              Create User
            </Button>
          </HStack>
        </Flex>
      </Box>

      {loading ? (
        <Box textAlign="center" py={10} flex="1">
          <Spinner size="xl" color="blue.500" mb={4} />
          <Text color="gray.500">Loading users from database...</Text>
        </Box>
      ) : error ? (
        <Box textAlign="center" py={10} flex="1">
          <Text color="red.500" mb={4}>
            Error loading users: {error}
          </Text>
        </Box>
      ) : users.length === 0 ? (
        <Box textAlign="center" py={10} flex="1">
          <Text color="gray.500" mb={4}>
            No users found. Create your first user to get started.
          </Text>
        </Box>
      ) : (
        <Box
          w="100%"
          overflowX="auto"
          overflowY="auto"
          flex="1"
          css={{
            '&::-webkit-scrollbar': {
              height: '8px',
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#888',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#555',
            },
          }}
        >
          <Table variant="simple" size="md" minW="800px">
            <Thead>
              <Tr>
                <Th whiteSpace="nowrap">Name</Th>
                <Th whiteSpace="nowrap">Surname</Th>
                <Th whiteSpace="nowrap">Role</Th>
                <Th whiteSpace="nowrap">Contact Number</Th>
                <Th whiteSpace="nowrap">Email Address</Th>
                <Th whiteSpace="nowrap">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {users.map((user) => (
                <Tr key={user.id}>
                  <Td>
                    <HStack spacing={2}>
                      <Avatar
                        size="sm"
                        name={`${user.firstName} ${user.lastName}`}
                        src={user.profilePhoto}
                        flexShrink={0}
                      />
                      <Text fontWeight="medium" noOfLines={1}>
                        {user.firstName}
                      </Text>
                    </HStack>
                  </Td>
                  <Td>
                    <Text fontWeight="medium" noOfLines={1}>
                      {user.lastName}
                    </Text>
                  </Td>
                  <Td>
                    <Badge colorScheme="blue" variant="subtle" whiteSpace="nowrap">
                      {user.role}
                    </Badge>
                  </Td>
                  <Td>
                    <Text noOfLines={1} fontSize="sm">
                      {user.phoneNumber || '-'}
                    </Text>
                  </Td>
                  <Td>
                    <Text noOfLines={1} fontSize="sm" color="blue.600">
                      {user.email}
                    </Text>
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      <IconButton
                        aria-label="Edit user"
                        icon={<EditIcon />}
                        size="sm"
                        variant="ghost"
                        colorScheme="blue"
                        onClick={() => handleEdit(user)}
                      />
                      <IconButton
                        aria-label="Delete user"
                        icon={<DeleteIcon />}
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => handleDelete(user)}
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{isEditing ? 'Edit User' : 'Create New User'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>User ID</FormLabel>
                <Input
                  value={formData.userId}
                  isReadOnly
                  bg="gray.50"
                  fontFamily="mono"
                  fontSize="sm"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Auto-generated unique identifier (ODS + 8 numbers)
                </Text>
              </FormControl>

              {/* Profile Photo */}
              <FormControl>
                <FormLabel>Profile Photo</FormLabel>
                <HStack spacing={4}>
                  <Avatar
                    size="lg"
                    name={`${formData.firstName} ${formData.lastName}`}
                    src={formData.profilePhoto}
                  />
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePhotoChange}
                    size="sm"
                    pt={1}
                  />
                </HStack>
                <FormHelperText>Upload a profile photo for the user</FormHelperText>
              </FormControl>

              <HStack spacing={4} w="100%">
                <FormControl isRequired>
                  <FormLabel>First Name</FormLabel>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Enter first name"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Last Name</FormLabel>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Enter last name"
                  />
                </FormControl>
              </HStack>

              <FormControl isRequired>
                <FormLabel>Email Address</FormLabel>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Username</FormLabel>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Username (defaults to email)"
                />
                <FormHelperText>Username will be used for login (defaults to email address)</FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel>Password</FormLabel>
                <Input type="text" value="Managed by Microsoft SSO" isReadOnly isDisabled />
                <FormHelperText>
                  Passwords are not stored here. Microsoft account MFA controls access.
                </FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel>Phone Number</FormLabel>
                <Input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="+44 123 456 7890"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Role</FormLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="Select role"
                >
                  <option value="Chief Financial Officer">Chief Financial Officer</option>
                  <option value="Telemarketing Executive">Telemarketing Executive</option>
                  <option value="Telesales Team Leader">Telesales Team Leader</option>
                  <option value="Sales representitive">Sales representitive</option>
                  <option value="Account Manager">Account Manager</option>
                  <option value="Campaigns Team Leader">Campaigns Team Leader</option>
                  <option value="Operations Co-ordinator">Operations Co-ordinator</option>
                  <option value="Head of Operations">Head of Operations</option>
                  <option value="Chief Executive Officer">Chief Executive Officer</option>
                  <option value="Growth Director">Growth Director</option>
                  <option value="Head of AI">Head of AI</option>
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Department</FormLabel>
                <Select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Select department"
                >
                  <option value="Management">Management</option>
                  <option value="Operations">Operations</option>
                  <option value="Campaigns">Campaigns</option>
                  <option value="Telesales">Telesales</option>
                  <option value="Sales">Sales</option>
                  <option value="Account Management">Account Management</option>
                  <option value="General">General</option>
                  <option value="Administration">Administration</option>
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Account Status</FormLabel>
                <Select
                  value={formData.accountStatus}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      accountStatus: e.target.value as 'Active' | 'Inactive',
                    })
                  }
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </FormControl>

              <HStack spacing={4} w="100%">
                <FormControl>
                  <FormLabel>Last Login Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.lastLoginDate}
                    onChange={(e) => setFormData({ ...formData, lastLoginDate: e.target.value })}
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Leave empty for "Never"
                  </Text>
                </FormControl>

                <FormControl>
                  <FormLabel>Created Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.createdDate}
                    onChange={(e) => setFormData({ ...formData, createdDate: e.target.value })}
                  />
                </FormControl>
              </HStack>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="gray" onClick={handleSave}>
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete User
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete{' '}
              {selectedUser
                ? `${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email})`
                : 'this user'}
              ? This action cannot be undone.
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
    </Box>
  )
}

export default UserAuthorizationTab

