/**
 * Shown when a tenant-scoped area is used but no active client is selected.
 * PR2: No silent fallback; user must select or create a client.
 */
import { Box, Button, Text, VStack } from '@chakra-ui/react'

const NAVIGATE_TO_CLIENTS = 'navigateToAccount'

export default function NoActiveClientEmptyState() {
  const goToClients = () => {
    window.dispatchEvent(new CustomEvent(NAVIGATE_TO_CLIENTS))
  }

  return (
    <Box p={6} borderWidth="1px" borderRadius="lg" bg="gray.50" borderColor="gray.200">
      <VStack spacing={3} align="stretch">
        <Text fontWeight="semibold" fontSize="md">
          Select a client to continue
        </Text>
        <Text fontSize="sm" color="gray.600">
          Choose a client from the selector, or create a new client.
        </Text>
        <Button size="sm" colorScheme="blue" alignSelf="flex-start" onClick={goToClients}>
          Go to Clients
        </Button>
      </VStack>
    </Box>
  )
}
