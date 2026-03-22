import { Box, HStack, Link, Text } from '@chakra-ui/react'
import { AM_ITEMS, OPS_TEAM_ITEMS, SALES_TEAM_ITEMS } from '../progressTrackerItems'
import { useOnboardingProgress } from './OnboardingProgressContext'

function countTrue(g: Record<string, boolean>): number {
  return Object.values(g).filter(Boolean).length
}

export function StickyProgressSummary() {
  const { sales, ops, am } = useOnboardingProgress()
  const sDone = countTrue(sales)
  const oDone = countTrue(ops)
  const aDone = countTrue(am)
  const sTot = SALES_TEAM_ITEMS.length
  const oTot = OPS_TEAM_ITEMS.length
  const aTot = AM_ITEMS.length

  return (
    <Box
      position="sticky"
      top={0}
      zIndex={2}
      bg="white"
      borderBottomWidth="1px"
      borderColor="gray.200"
      py={3}
      px={1}
      mb={2}
      shadow="sm"
    >
      <HStack justify="space-between" flexWrap="wrap" spacing={3} align="center">
        <Text fontSize="sm" fontWeight="semibold" color="gray.700">
          Onboarding progress
        </Text>
        <HStack spacing={4} flexWrap="wrap" fontSize="sm">
          <Text>
            Sales{' '}
            <Text as="span" fontWeight="bold" color="teal.600">
              {sDone}/{sTot}
            </Text>
          </Text>
          <Text>
            Ops{' '}
            <Text as="span" fontWeight="bold" color="teal.600">
              {oDone}/{oTot}
            </Text>
          </Text>
          <Text>
            AM{' '}
            <Text as="span" fontWeight="bold" color="teal.600">
              {aDone}/{aTot}
            </Text>
          </Text>
        </HStack>
      </HStack>
      <HStack spacing={4} mt={2} fontSize="xs" flexWrap="wrap">
        <Link href="#onb-commercial" color="blue.600">
          Commercial
        </Link>
        <Link href="#onb-team" color="blue.600">
          Team &amp; data
        </Link>
        <Link href="#onb-ops-coordination" color="blue.600">
          Ops coordination
        </Link>
        <Link href="#onb-emails" color="blue.600">
          Emails
        </Link>
        <Link href="#onb-ops-docs" color="blue.600">
          Ops docs
        </Link>
        <Link href="#onb-profile" color="blue.600">
          Profile
        </Link>
        <Link href="#onb-delivery-launch" color="blue.600">
          Delivery &amp; launch
        </Link>
        <Link href="#onb-confirmations" color="blue.600">
          Final sign-offs
        </Link>
      </HStack>
    </Box>
  )
}
