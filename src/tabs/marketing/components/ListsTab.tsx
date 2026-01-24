import React from 'react'
import { Box, Heading, Text, Card, CardBody, VStack } from '@chakra-ui/react'

const ListsTab: React.FC = () => {
  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Contact Lists & Segmentation</Heading>
          <Text color="gray.600">
            Create dynamic segments and organize your contacts for targeted campaigns
          </Text>
        </Box>

        <Card>
          <CardBody>
            <Text fontSize="lg" textAlign="center" py={12}>
              📋 Lists Management Coming Soon
            </Text>
            <Text textAlign="center" color="gray.600">
              Static and dynamic list creation, contact segmentation, and bulk operations
            </Text>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  )
}

export default ListsTab