/**
 * Renders a subset of manual onboarding checklist rows (same PUT /progress-tracker contract as inline widgets).
 */
import { Box, Checkbox, Input, Text, VStack, Button } from '@chakra-ui/react'
import { AM_ITEMS, SALES_TEAM_ITEMS, OPS_TEAM_ITEMS } from '../progressTrackerItems'
import { useOnboardingProgress } from '../progress/OnboardingProgressContext'
import { PROGRESS_DATE_PAYLOAD } from '../progress/datePayload'

type Group = 'sales' | 'ops' | 'am'

function itemByKey(group: Group, key: string) {
  if (group === 'sales') return SALES_TEAM_ITEMS.find((i) => i.key === key)
  if (group === 'ops') return OPS_TEAM_ITEMS.find((i) => i.key === key)
  return AM_ITEMS.find((i) => i.key === key)
}

export type ManualConfirmationBlockProps = {
  id?: string
  title: string
  description?: string
  /** Tuples of (group, itemKey) in display order */
  rows: ReadonlyArray<{ group: Group; key: string }>
}

export function ManualConfirmationBlock({ id, title, description, rows }: ManualConfirmationBlockProps) {
  const {
    sales,
    ops,
    am,
    busyKey,
    dateExtra,
    setDateExtra,
    saveItem,
    resolveUserLabel,
    metaFor,
    renderMetaLine,
  } = useOnboardingProgress()

  const renderSalesRow = (key: string) => {
    const item = itemByKey('sales', key)
    if (!item) return null
    const checked = sales[key] === true
    const dateField = PROGRESS_DATE_PAYLOAD[key as string]
    return (
      <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
        <Checkbox
          isChecked={checked}
          isDisabled={busyKey === `sales.${key}`}
          onChange={(e) => {
            const next = e.target.checked
            const vp =
              dateField && next ? { [dateField]: dateExtra[key] || undefined } : undefined
            void saveItem('sales', key, next, vp)
          }}
        >
          <Text fontSize="sm" as="span">
            {item.label}
          </Text>
        </Checkbox>
        {dateField ? (
          <Input
            type="date"
            size="sm"
            mt={1}
            maxW="220px"
            value={dateExtra[key] ?? ''}
            onChange={(e) => setDateExtra((p) => ({ ...p, [key]: e.target.value }))}
          />
        ) : null}
        {renderMetaLine('sales', key)}
      </Box>
    )
  }

  const renderOpsRow = (key: string) => {
    const item = itemByKey('ops', key)
    if (!item) return null
    const dateField = PROGRESS_DATE_PAYLOAD[key as string]
    const checked = ops[key] === true
    return (
      <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
        <Checkbox
          isChecked={checked}
          onChange={(e) => void saveItem('ops', key, e.target.checked)}
          isDisabled={busyKey === `ops.${key}`}
        >
          <Text fontSize="sm" as="span">
            {item.label}
          </Text>
        </Checkbox>
        {dateField ? (
          <Input
            type="date"
            size="sm"
            mt={1}
            maxW="220px"
            value={dateExtra[key] ?? ''}
            onChange={(e) => setDateExtra((p) => ({ ...p, [key]: e.target.value }))}
          />
        ) : null}
        {renderMetaLine('ops', key)}
      </Box>
    )
  }

  const renderAmRow = (key: string) => {
    const item = itemByKey('am', key)
    if (!item) return null
    if (key === 'am_campaigns_launched') {
      const m = metaFor('am', key)
      const acks = Array.isArray(m.acknowledgements) ? m.acknowledgements : []
      return (
        <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
          <Text fontSize="sm" fontWeight="medium" mb={1}>
            {item.label}
          </Text>
          <Text fontSize="xs" color="gray.600" mb={2}>
            Record one or more confirmations (e.g. different team members). Each click adds an acknowledgement.
          </Text>
          <Button
            size="sm"
            colorScheme="teal"
            variant="outline"
            isLoading={busyKey === 'am.am_campaigns_launched'}
            onClick={() => void saveItem('am', key, true)}
          >
            Record confirmation
          </Button>
          {acks.length > 0 ? (
            <VStack align="stretch" mt={2} spacing={1}>
              {acks.map((a, i) => (
                <Text key={i} fontSize="xs" color="gray.700">
                  {resolveUserLabel(a.completedByUserId) || 'Recorded'} · {new Date(a.completedAt).toLocaleString()}
                </Text>
              ))}
            </VStack>
          ) : null}
        </Box>
      )
    }

    const dateField = PROGRESS_DATE_PAYLOAD[key as string]
    const checked = am[key] === true
    return (
      <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
        <Checkbox
          isChecked={checked}
          onChange={(e) => {
            const next = e.target.checked
            const vp =
              dateField && next ? { [dateField]: dateExtra[key] || undefined } : undefined
            void saveItem('am', key, next, vp)
          }}
          isDisabled={busyKey === `am.${key}`}
        >
          <Text fontSize="sm" as="span">
            {item.label}
          </Text>
        </Checkbox>
        {dateField ? (
          <Input
            type="date"
            size="sm"
            mt={1}
            maxW="220px"
            value={dateExtra[key] ?? ''}
            onChange={(e) => setDateExtra((p) => ({ ...p, [key]: e.target.value }))}
          />
        ) : null}
        {renderMetaLine('am', key)}
      </Box>
    )
  }

  const renderRow = (group: Group, key: string) => {
    if (group === 'sales') return renderSalesRow(key)
    if (group === 'ops') return renderOpsRow(key)
    return renderAmRow(key)
  }

  if (rows.length === 0) return null

  return (
    <Box
      id={id}
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="lg"
      p={4}
      bg="gray.50"
    >
      <Text fontSize="sm" fontWeight="semibold" color="gray.800" mb={description ? 1 : 3}>
        {title}
      </Text>
      {description ? (
        <Text fontSize="xs" color="gray.600" mb={3}>
          {description}
        </Text>
      ) : null}
      <Box bg="white" borderRadius="md" p={3} borderWidth="1px" borderColor="gray.100">
        {rows.map((r) => renderRow(r.group, r.key))}
      </Box>
    </Box>
  )
}
