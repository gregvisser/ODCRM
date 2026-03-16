import { Box, Text, VStack } from '@chakra-ui/react'
import ReportingDashboard from '../marketing/components/ReportingDashboard'

export type ReportingViewId = 'reporting-dashboard'

export default function ReportingHomePage({
  view,
}: {
  view?: string
}) {
  void view

  return (
    <div data-testid="reporting-home-panel">
      <Box mb={4} data-testid="reporting-home-guidance">
        <VStack align="start" spacing={1}>
          <Text fontSize="lg" fontWeight="700">
            Reporting
          </Text>
          <Text fontSize="sm" color="gray.600">
            Cross-system operator dashboard for truthful outreach performance, target progress, funnel health, and mailbox activity.
          </Text>
        </VStack>
      </Box>
      <ReportingDashboard />
    </div>
  )
}
