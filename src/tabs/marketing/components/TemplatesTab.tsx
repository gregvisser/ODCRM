import React from 'react'
import { Box, Heading, Text, Card, CardBody, VStack } from '@chakra-ui/react'

const TemplatesTab: React.FC = () => {
  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Email Templates</Heading>
          <Text color="gray.600">
            Create and manage reusable email templates with merge tags
          </Text>
        </Box>

        <Card>
          <CardBody>
            <Text fontSize="lg" textAlign="center" py={12}>
              📝 Template Library Coming Soon
            </Text>
            <Text textAlign="center" color="gray.600">
              Rich text editor, merge tag support, and template categories
            </Text>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  )
}

export default TemplatesTab