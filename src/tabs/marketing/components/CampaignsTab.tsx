import React from 'react'
import { Box, Heading, Text, Card, CardBody, VStack } from '@chakra-ui/react'

const CampaignsTab: React.FC = () => {
  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Email Campaigns</Heading>
          <Text color="gray.600">
            Send one-off email campaigns to targeted contact lists
          </Text>
        </Box>

        <Card>
          <CardBody>
            <Text fontSize="lg" textAlign="center" py={12}>
              📧 Campaign Management Coming Soon
            </Text>
            <Text textAlign="center" color="gray.600">
              One-off email sends, A/B testing, and campaign analytics
            </Text>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  )
}

export default CampaignsTab