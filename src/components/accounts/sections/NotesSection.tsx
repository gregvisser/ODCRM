import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Text,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { AddIcon } from '@chakra-ui/icons'
import type { AccountNote } from '../types'
import { api } from '../../../utils/api'
import { useUsersFromDatabase } from '../../../hooks/useUsersFromDatabase'
import { useUserPreferencesContext } from '../../../contexts/UserPreferencesContext'

function formatTimestamp(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-GB', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function NotesSection({
  customerId,
  notes,
  onAfterAdd,
}: {
  customerId: string
  notes: AccountNote[]
  onAfterAdd: () => Promise<void> | void
}) {
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { users } = useUsersFromDatabase()
  const { userEmail } = useUserPreferencesContext()

  const activeUsers = useMemo(() => users.filter((u) => u.accountStatus === 'Active'), [users])
  const [authorId, setAuthorId] = useState<string>('')
  const [content, setContent] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const byEmail = userEmail
      ? activeUsers.find((u) => u.email.toLowerCase().trim() === userEmail.toLowerCase().trim())?.id || ''
      : ''
    const existing = notes.find((n) => n.userId)?.userId || ''
    const fallback = activeUsers[0]?.id || ''
    setAuthorId(byEmail || existing || fallback)
  }, [activeUsers, notes, userEmail])

  const sorted = useMemo(() => {
    const list = Array.isArray(notes) ? [...notes] : []
    list.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
    return list
  }, [notes])

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed) return
    if (!authorId) {
      toast({
        title: 'Select an author',
        description: 'Pick a user from User Authorization before saving a note.',
        status: 'warning',
        duration: 3500,
        isClosable: true,
      })
      return
    }

    setIsSaving(true)
    const { error } = await api.post(`/api/customers/${customerId}/notes`, {
      content: trimmed,
      userId: authorId,
      userEmail: userEmail || undefined,
    })
    setIsSaving(false)

    if (error) {
      toast({ title: 'Failed to add note', description: error, status: 'error', duration: 5000, isClosable: true })
      return
    }

    toast({ title: 'Note added', status: 'success', duration: 2000 })
    setContent('')
    onClose()
    await onAfterAdd()
  }

  return (
    <Box>
      <HStack justify="space-between" mb={3} flexWrap="wrap" gap={3}>
        <Text fontSize="sm" color="gray.600">
          Chronological notes (database-backed).
        </Text>
        <Button size="sm" colorScheme="teal" leftIcon={<AddIcon />} onClick={onOpen}>
          Add Note
        </Button>
      </HStack>

      {sorted.length === 0 ? (
        <Text fontSize="sm" color="gray.500">
          No notes added yet
        </Text>
      ) : (
        <Stack spacing={3}>
          {sorted.map((n) => (
            <Box key={n.id} border="1px solid" borderColor="gray.200" borderRadius="md" p={3} bg="white">
              <HStack justify="space-between" align="start" gap={4}>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold">
                    {n.user || 'Unknown'}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    {n.timestamp ? formatTimestamp(n.timestamp) : 'Unknown time'}
                  </Text>
                </Box>
              </HStack>
              <Text mt={2} fontSize="sm" whiteSpace="pre-wrap">
                {n.content}
              </Text>
            </Box>
          ))}
        </Stack>
      )}

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add note</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <FormControl>
                <FormLabel fontSize="sm">Author</FormLabel>
                <Select size="sm" value={authorId} onChange={(e) => setAuthorId(e.target.value)}>
                  <option value="">Select author</option>
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {`${u.firstName} ${u.lastName}`.trim()} ({u.email})
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Content</FormLabel>
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Write a note..." />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={() => void handleSubmit()} isLoading={isSaving}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}

