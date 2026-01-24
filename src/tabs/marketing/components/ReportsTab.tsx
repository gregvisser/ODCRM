import React from 'react'
import { Box, Heading, Text, Card, CardBody, VStack } from '@chakra-ui/react'

const ReportsTab: React.FC = () => {
  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Analytics & Reports</Heading>
          <Text color="gray.600">
            Comprehensive email performance analytics and insights
          </Text>
        </Box>

        <Card>
          <CardBody>
            <Text fontSize="lg" textAlign="center" py={12}>
              📊 Analytics Dashboard Coming Soon
            </Text>
            <Text textAlign="center" color="gray.600">
              Sequence performance, contact engagement metrics, and ROI tracking
            </Text>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  )
}

export default ReportsTab