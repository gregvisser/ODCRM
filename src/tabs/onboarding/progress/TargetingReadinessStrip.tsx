import { SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { AM_ITEMS } from '../progressTrackerItems'
import { useOnboardingProgress } from './OnboardingProgressContext'
import { StatusChip } from './InlineProgressWidgets'

const READINESS_KEYS = [
  'am_target_list',
  'am_qualifying_questions',
  'am_weekly_target',
  'am_campaign_template',
  'am_templates_reviewed',
  'am_populate_icp',
  'am_client_live',
] as const

function labelFor(key: string): string {
  const row = AM_ITEMS.find((i) => i.key === key)
  return row ? row.label : key
}

/** Inline readiness row: targeting, ICP, templates, weekly target, first outreach / live — next to profile work. */
export function TargetingReadinessStrip() {
  const { am, renderMetaLine } = useOnboardingProgress()

  return (
    <VStack align="stretch" spacing={3} pt={2}>
      <Text fontSize="sm" fontWeight="semibold" color="gray.700">
        Campaign readiness (updates when you save profile, targets, templates, and when outreach sends)
      </Text>
      <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={2}>
        {READINESS_KEYS.map((key) => {
          const done = am[key] === true
          return (
            <VStack key={key} align="stretch" spacing={0} borderWidth="1px" borderRadius="md" p={2} borderColor="gray.100" bg="gray.50">
              <Text fontSize="xs" color="gray.600" noOfLines={2}>
                {labelFor(key)}
              </Text>
              <StatusChip done={done} label={done ? 'Done' : 'Pending'} auto={done} />
              {renderMetaLine('am', key)}
            </VStack>
          )
        })}
      </SimpleGrid>
    </VStack>
  )
}
