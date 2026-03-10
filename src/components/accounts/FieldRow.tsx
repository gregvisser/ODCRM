import type { ReactNode } from 'react'
import { EditIcon } from '@chakra-ui/icons'
import { Box, HStack, IconButton, Stack, Text } from '@chakra-ui/react'

type FieldRowProps = {
  label: string
  children: ReactNode
  editable?: boolean
  onEdit?: () => void
  isEditing?: boolean
}

export default function FieldRow({ label, children, editable, onEdit, isEditing }: FieldRowProps) {
  return (
    <Box
      p={4}
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.100"
      bg="gray.50"
      _hover={{ borderColor: 'gray.200', bg: 'white' }}
      transition="all 0.2s"
    >
      <Stack spacing={3}>
        <HStack justify="space-between" align="center">
          <Text fontSize="sm" fontWeight="semibold" color="gray.700" letterSpacing="0.02em">
            {label}
          </Text>
          {editable && !isEditing && onEdit && (
            <IconButton
              aria-label={`Edit ${label}`}
              icon={<EditIcon />}
              size="sm"
              variant="ghost"
              colorScheme="gray"
              onClick={onEdit}
            />
          )}
        </HStack>
        <Box fontSize="md" color="gray.800" fontWeight="normal">
          {children}
        </Box>
      </Stack>
    </Box>
  )
}
