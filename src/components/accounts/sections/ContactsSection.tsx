import {
  Badge,
  Box,
  Button,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import type { CustomerContact } from '../types'

export function ContactsSection({
  contacts,
  onRowClick,
  onAddContact,
}: {
  contacts: CustomerContact[]
  onRowClick: (contact: CustomerContact) => void
  onAddContact?: () => void
}) {
  const rows = Array.isArray(contacts) ? contacts : []

  return (
    <Box>
      <HStack justify="space-between" mb={3} flexWrap="wrap" gap={3}>
        <Text fontSize="sm" color="gray.600">
          Contacts captured during onboarding (database-backed).
        </Text>
        <Button size="sm" variant="outline" onClick={onAddContact}>
          Add Contact
        </Button>
      </HStack>

      {rows.length === 0 ? (
        <Text fontSize="sm" color="gray.500">
          No contacts added yet
        </Text>
      ) : (
        <Box border="1px solid" borderColor="gray.200" borderRadius="md" overflow="hidden">
          <Table size="sm">
            <Thead bg="gray.50">
              <Tr>
                <Th>Name</Th>
                <Th>Title</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((c) => (
                <Tr
                  key={c.id}
                  cursor="pointer"
                  _hover={{ bg: 'gray.50' }}
                  onClick={() => onRowClick(c)}
                >
                  <Td>
                    <HStack spacing={2}>
                      <Text fontSize="sm" fontWeight="semibold">
                        {c.name}
                      </Text>
                      {c.isPrimary ? <Badge colorScheme="blue">Primary</Badge> : null}
                    </HStack>
                  </Td>
                  <Td>
                    <Text fontSize="sm" color={c.title ? 'gray.800' : 'gray.500'}>
                      {c.title || 'Not set'}
                    </Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm" color={c.email ? 'gray.800' : 'gray.500'}>
                      {c.email || 'Not set'}
                    </Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm" color={c.phone ? 'gray.800' : 'gray.500'}>
                      {c.phone || 'Not set'}
                    </Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm" color="gray.700">
                      {c.isPrimary ? 'Primary' : '—'}
                    </Text>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  )
}

