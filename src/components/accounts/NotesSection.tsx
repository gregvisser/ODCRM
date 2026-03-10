import { useEffect, useMemo, useState } from 'react'
import { CheckIcon } from '@chakra-ui/icons'
import { Box, Button, FormControl, FormLabel, HStack, Select, Stack, Text, Textarea, useToast } from '@chakra-ui/react'
import type { DatabaseUser } from '../../hooks/useUsersFromDatabase'
import { api } from '../../utils/api'
import type { Account, AccountNote } from '../AccountsTab'

type NotesSectionProps = {
  account: Account
  customerId: string | null
  updateAccount: (accountName: string, updates: Partial<Account>) => void
  toast: ReturnType<typeof useToast>
  users: DatabaseUser[]
  currentUserEmail: string | null
}

export default function NotesSection({ account, customerId, updateAccount, toast, users, currentUserEmail }: NotesSectionProps) {
  const [noteContent, setNoteContent] = useState('')
  const [noteUserId, setNoteUserId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeUsers = useMemo(() => users.filter((u) => u.accountStatus === 'Active'), [users])

  useEffect(() => {
    // Default author priority:
    // 1) Currently signed-in email (if it matches a User Authorization record)
    // 2) Existing note author (if any)
    // 3) First active user
    const matchByEmail = currentUserEmail
      ? activeUsers.find((u) => u.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim())?.id || ''
      : ''
    const existing = (account.notes || []).find((n) => n.userId)?.userId || ''
    const fallback = activeUsers[0]?.id || ''
    setNoteUserId(matchByEmail || existing || fallback)
  }, [account.name, account.notes, activeUsers, currentUserEmail])

  const handleAddNote = async () => {
    const content = noteContent.trim()
    if (!content) return

    if (!customerId) {
      toast({
        title: 'Cannot add note',
        description: 'This account is not linked to a database customer yet.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      })
      return
    }

    if (!noteUserId) {
      toast({
        title: 'Select an author',
        description: 'Pick a user from User Authorization before saving a note.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    setIsSubmitting(true)
    const { data, error } = await api.post<{ note: AccountNote; notes: AccountNote[] }>(`/api/customers/${customerId}/notes`, {
      content,
      userId: noteUserId,
    })
    setIsSubmitting(false)

    if (error) {
      toast({
        title: 'Failed to add note',
        description: error,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    if (data?.notes) {
      updateAccount(account.name, { notes: data.notes })
    }

    setNoteContent('')
    toast({ title: 'Note added', status: 'success', duration: 2000, isClosable: true })
  }

  return (
    <Stack spacing={4}>
      {/* Add new note form */}
      <Box
        p={4}
        border="1px solid"
        borderColor="gray.200"
        borderRadius="md"
        bg="gray.50"
      >
        <Stack spacing={3}>
          <FormControl>
            <FormLabel fontSize="xs" mb={1}>
              Author (from User Authorization)
            </FormLabel>
            <Select size="sm" value={noteUserId} onChange={(e) => setNoteUserId(e.target.value)}>
              <option value="">Select author</option>
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {`${u.firstName} ${u.lastName}`.trim()} ({u.email})
                </option>
              ))}
            </Select>
          </FormControl>
          <Textarea
            placeholder="Add a note..."
            size="sm"
            rows={3}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
          />
          <Button
            size="sm"
            colorScheme="gray"
            leftIcon={<CheckIcon />}
            onClick={() => void handleAddNote()}
            isLoading={isSubmitting}
          >
            Add Note
          </Button>
        </Stack>
      </Box>

      {/* Display existing notes */}
      <Stack spacing={3}>
        {(account.notes || []).length === 0 ? (
          <Text fontSize="sm" color="gray.500" fontStyle="italic">
            No notes yet. Add your first note above.
          </Text>
        ) : (
          (account.notes || []).map((note) => (
            <Box
              key={note.id}
              p={3}
              border="1px solid"
              borderColor="gray.200"
              borderRadius="md"
              bg="white"
            >
              <Stack spacing={2}>
                <HStack justify="space-between" align="flex-start">
                  <Text fontSize="sm" fontWeight="medium" color="gray.700">
                    {note.content}
                  </Text>
                </HStack>
                <HStack spacing={2} fontSize="xs" color="gray.500">
                  <Text fontWeight="medium">
                    {(() => {
                      const user =
                        (note.userId ? users.find((u) => u.id === note.userId) : null) ||
                        (note.userEmail ? users.find((u) => u.email === note.userEmail) : null) ||
                        null
                      return user ? `${user.firstName} ${user.lastName}`.trim() : note.user
                    })()}
                  </Text>
                  <Text>•</Text>
                  <Text>
                    {new Date(note.timestamp).toLocaleString('en-GB', {
                      timeZone: 'Europe/London',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </HStack>
              </Stack>
            </Box>
          ))
        )}
      </Stack>
    </Stack>
  )
}
