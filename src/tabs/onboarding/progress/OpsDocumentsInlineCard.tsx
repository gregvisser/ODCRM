import { Box, Checkbox, HStack, Text, VStack } from '@chakra-ui/react'
import { ATTACHMENT_TYPES, OPS_TEAM_ITEMS } from '../progressTrackerItems'
import { useOnboardingProgress } from './OnboardingProgressContext'
import { AttachmentInline } from './AttachmentInline'
import { StatusChip } from './InlineProgressWidgets'

const OPS_DOC_KEYS = ['ops_prepare_pack', 'ops_populate_ppt', 'ops_receive_file', 'ops_brief_campaigns'] as const

export function OpsDocumentsInlineCard() {
  const { customerId, ops, busyKey, setBusyKey, listAttachmentNames, renderMetaLine, saveItem } =
    useOnboardingProgress()

  const rows = OPS_TEAM_ITEMS.filter((i) => OPS_DOC_KEYS.includes(i.key as any))

  return (
    <Box id="onb-ops-docs" borderWidth="1px" borderRadius="xl" p={5} bg="white" borderColor="gray.200">
      <Text fontSize="lg" fontWeight="semibold" mb={1}>
        Operations documents
      </Text>
      <Text fontSize="sm" color="gray.600" mb={4}>
        Upload each item here — completion status updates next to the upload.
      </Text>
      <VStack align="stretch" spacing={4}>
        {rows.map((item) => {
          const key = item.key
          const checked = ops[key] === true
          const files =
            key === 'ops_prepare_pack'
              ? listAttachmentNames((t) => t === ATTACHMENT_TYPES.onboardingPack || t.startsWith('onboarding_pack:'))
              : key === 'ops_populate_ppt'
                ? listAttachmentNames((t) => t === ATTACHMENT_TYPES.onboardingPpt || t === 'onboarding_meeting_pptx')
                : key === 'ops_receive_file'
                  ? listAttachmentNames((t) => t === ATTACHMENT_TYPES.clientInfo || t.startsWith('onboarding_client_info:'))
                  : listAttachmentNames((t) => t === ATTACHMENT_TYPES.briefCampaigns || t === 'ops_brief_campaigns')

          const attType =
            key === 'ops_prepare_pack'
              ? ATTACHMENT_TYPES.onboardingPack
              : key === 'ops_populate_ppt'
                ? ATTACHMENT_TYPES.onboardingPpt
                : key === 'ops_receive_file'
                  ? ATTACHMENT_TYPES.clientInfo
                  : ATTACHMENT_TYPES.briefCampaigns

          return (
            <Box key={key} borderWidth="1px" borderRadius="md" p={3} borderColor="gray.100">
              <HStack justify="space-between" align="flex-start" flexWrap="wrap" spacing={2}>
                <Text fontSize="sm" fontWeight="medium" flex="1">
                  {item.label}
                </Text>
                <StatusChip done={checked} label="Ready" auto={checked} />
              </HStack>
              {renderMetaLine('ops', key)}
              {key === 'ops_brief_campaigns' ? (
                <VStack align="stretch" spacing={2} mt={1}>
                  <Checkbox
                    isChecked={checked}
                    isDisabled={busyKey === 'ops.ops_brief_campaigns'}
                    onChange={(e) => void saveItem('ops', 'ops_brief_campaigns', e.target.checked)}
                  >
                    <Text fontSize="sm">Mark brief provided to Campaigns Creator</Text>
                  </Checkbox>
                  <Text fontSize="xs" color="gray.500">
                    This step is now tracked as a boolean confirmation instead of a file upload.
                  </Text>
                </VStack>
              ) : (
                <AttachmentInline
                  customerId={customerId}
                  attachmentType={attType}
                  busyKey={busyKey}
                  setBusyKey={setBusyKey}
                  onDone={() => {}}
                  files={files}
                />
              )}
            </Box>
          )
        })}
      </VStack>
    </Box>
  )
}
