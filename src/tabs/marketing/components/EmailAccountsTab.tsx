import React from 'react'
import { Box, Heading, Text, Card, CardBody, VStack } from '@chakra-ui/react'

const EmailAccountsTab: React.FC = () => {
  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Email Accounts</Heading>
          <Text color="gray.600">
            Manage sending accounts, warm-up status, and deliverability monitoring
          </Text>
        </Box>

        <Card>
          <CardBody>
            <Text fontSize="lg" textAlign="center" py={12}>
              📮 Email Infrastructure Coming Soon
            </Text>
            <Text textAlign="center" color="gray.600">
              SMTP configuration, OAuth setup, sending limits, and reputation monitoring
            </Text>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  )
}

export default EmailAccountsTab