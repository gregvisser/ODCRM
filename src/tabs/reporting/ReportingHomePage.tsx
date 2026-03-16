import { Box, Text, VStack } from '@chakra-ui/react'
import ReportingDashboard from '../marketing/components/ReportingDashboard'

export type DashboardViewId = 'reporting-dashboard'

export default function DashboardHomePage({
  view,
}: {
  view?: string
}) {
  void view

  return (
    <div data-testid="dashboard-home-panel">
      <Box mb={4} data-testid="dashboard-home-guidance">
        <VStack align="start" spacing={1}>
          <Text fontSize="lg" fontWeight="700">
            Dashboard
          </Text>
          <Text fontSize="sm" color="gray.600">
            Cross-system operator dashboard for truthful outreach performance, sourcing, funnel health, conversion pressure, and compliance visibility.
          </Text>
        </VStack>
      </Box>
      <ReportingDashboard />
    </div>
  )
}
