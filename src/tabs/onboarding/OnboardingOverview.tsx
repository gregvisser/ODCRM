import { Box, Heading, Text, VStack, Stack, Divider } from '@chakra-ui/react'
import { CompleteOnboardingButton } from './components/CompleteOnboardingButton'

interface OnboardingOverviewProps {
  customerId?: string
  customerName?: string
  currentStatus?: string
  onStatusUpdated?: () => void
}

export default function OnboardingOverview({
  customerId,
  customerName,
  currentStatus,
  onStatusUpdated,
}: OnboardingOverviewProps = {}) {
  return (
    <Box display="flex" justifyContent="center" py={8} px={4}>
      <Box
        maxW="3xl"
        w="100%"
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="xl"
        boxShadow="sm"
        p={{ base: 5, md: 8 }}
      >
        {/* Header with OPENDOORS branding */}
        <Box display="flex" justifyContent="flex-end" mb={6}>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            letterSpacing="0.15em"
            textTransform="uppercase"
            color="gray.600"
          >
            OPENDOORS
          </Text>
        </Box>

        {/* Centered title */}
        <VStack spacing={8} align="stretch">
          <Heading as="h1" size="xl" textAlign="center" color="gray.800" mb={4}>
            New Client Onboarding Checklist
          </Heading>

          {/* Checklist Overview Section */}
          <Stack spacing={4}>
            <Heading as="h2" size="md" color="gray.700">
              Checklist Overview:
            </Heading>
            <Text fontSize="md" color="gray.700" lineHeight="tall">
              This checklist is used to ensure that all new clients are onboarded accurately, consistently, and in
              line with operational standards. It provides clear step-by-step checks to confirm that client details
              are authorised, correctly recorded, and fully set up across all required systems.
            </Text>
            <Text fontSize="md" color="gray.700" lineHeight="tall">
              Completion of this checklist helps maintain data integrity, reduce errors, and ensure a smooth
              transition to <Text as="span" fontWeight="bold">live status</Text>.
            </Text>
          </Stack>

          {/* Checklist Use Section */}
          <Stack spacing={4}>
            <Heading as="h2" size="md" color="gray.700">
              Checklist Use:
            </Heading>
            <Text fontSize="md" color="gray.700" lineHeight="tall">
              This checklist is designed for use by the Sales Team, Account Managers, and the Operations Team to
              ensure a consistent and accurate client onboarding process. It provides shared visibility and clear
              accountability across teams, ensuring that all required steps are completed ensure before a client is
              marked as live.
            </Text>
            <Text fontSize="md" color="gray.700" lineHeight="tall">
              This checklist can be used alongside the{' '}
              <Text as="span" fontWeight="bold">
                SOP for Onboarding a New Client to the Company
              </Text>
              .
            </Text>
          </Stack>

          {/* Complete Onboarding Section */}
          {customerId && customerName && (
            <>
              <Divider my={4} />
              <Stack spacing={4}>
                <Heading as="h2" size="md" color="gray.700">
                  Completion:
                </Heading>
                <CompleteOnboardingButton
                  customerId={customerId}
                  customerName={customerName}
                  currentStatus={currentStatus || 'unknown'}
                  onStatusUpdated={onStatusUpdated}
                />
              </Stack>
            </>
          )}
        </VStack>
      </Box>
    </Box>
  )
}
