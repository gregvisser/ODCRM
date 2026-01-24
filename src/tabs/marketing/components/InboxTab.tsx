import React from 'react'
import { Box, Heading, Text, Card, CardBody, VStack } from '@chakra-ui/react'

const InboxTab: React.FC = () => {
  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Inbox & Conversations</Heading>
          <Text color="gray.600">
            Monitor replies, track conversations, and manage follow-ups
          </Text>
        </Box>

        <Card>
          <CardBody>
            <Text fontSize="lg" textAlign="center" py={12}>
              💬 Conversation Management Coming Soon
            </Text>
            <Text textAlign="center" color="gray.600">
              Reply tracking, conversation threading, and automated follow-ups
            </Text>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  )
}

export default InboxTab