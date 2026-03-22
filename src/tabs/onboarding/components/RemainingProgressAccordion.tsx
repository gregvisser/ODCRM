/**
 * Manual confirmations & sign-offs not tied to a specific inline field in the main form.
 * Must render inside OnboardingProgressProvider.
 */
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Checkbox,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react'
import { AM_ITEMS, OPS_TEAM_ITEMS, SALES_TEAM_ITEMS } from '../progressTrackerItems'
import { EMBEDDED_INLINE_PROGRESS_KEYS } from '../progress/embeddedKeys'
import { useOnboardingProgress } from '../progress/OnboardingProgressContext'
import { PROGRESS_DATE_PAYLOAD } from '../progress/datePayload'

const SALES_REST = SALES_TEAM_ITEMS.filter((i) => !EMBEDDED_INLINE_PROGRESS_KEYS.has(i.key))
const OPS_REST = OPS_TEAM_ITEMS.filter((i) => !EMBEDDED_INLINE_PROGRESS_KEYS.has(i.key))
const AM_REST = AM_ITEMS.filter((i) => !EMBEDDED_INLINE_PROGRESS_KEYS.has(i.key))

export default function RemainingProgressAccordion() {
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

  const renderSalesRow = (item: (typeof SALES_TEAM_ITEMS)[number]) => {
    const key = item.key
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
              dateField && next
                ? { [dateField]: dateExtra[key] || undefined }
                : undefined
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

  const renderOpsRow = (item: (typeof OPS_TEAM_ITEMS)[number]) => {
    const key = item.key
    const dateField = PROGRESS_DATE_PAYLOAD[key as string]
    const checked = ops[key] === true
    return (
      <Box key={key} py={2} borderBottom="1px solid" borderColor="gray.100">
        <Checkbox isChecked={checked} onChange={(e) => void saveItem('ops', key, e.target.checked)} isDisabled={busyKey === `ops.${key}`}>
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

  const renderAmRow = (item: (typeof AM_ITEMS)[number]) => {
    const key = item.key
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
                  {resolveUserLabel(a.completedByUserId)} · {new Date(a.completedAt).toLocaleString()}
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
              dateField && next
                ? { [dateField]: dateExtra[key] || undefined }
                : undefined
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

  const hasAny =
    SALES_REST.length > 0 || OPS_REST.length > 0 || AM_REST.length > 0

  if (!hasAny) return null

  return (
    <Box id="onb-confirmations" borderWidth="1px" borderColor="gray.200" borderRadius="xl" p={5} bg="gray.50">
      <Text fontSize="md" fontWeight="semibold" color="gray.800" mb={1}>
        Confirmations &amp; sign-offs
      </Text>
      <Text fontSize="sm" color="gray.600" mb={4}>
        Steps that need an explicit tick or date — completion also appears inline where the work happens above.
      </Text>
      <Accordion allowMultiple defaultIndex={[0, 1, 2]}>
        {SALES_REST.length > 0 ? (
          <AccordionItem border="none">
            <AccordionButton bg="white" borderRadius="md" mb={2}>
              <Box flex="1" textAlign="left" fontWeight="semibold">
                Sales
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4} px={0}>
              <Box bg="white" borderRadius="md" p={3}>
                {SALES_REST.map((it) => renderSalesRow(it))}
              </Box>
            </AccordionPanel>
          </AccordionItem>
        ) : null}
        {OPS_REST.length > 0 ? (
          <AccordionItem border="none">
            <AccordionButton bg="white" borderRadius="md" mb={2}>
              <Box flex="1" textAlign="left" fontWeight="semibold">
                Operations
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4} px={0}>
              <Box bg="white" borderRadius="md" p={3}>
                {OPS_REST.map((it) => renderOpsRow(it))}
              </Box>
            </AccordionPanel>
          </AccordionItem>
        ) : null}
        {AM_REST.length > 0 ? (
          <AccordionItem border="none">
            <AccordionButton bg="white" borderRadius="md" mb={2}>
              <Box flex="1" textAlign="left" fontWeight="semibold">
                Account manager
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4} px={0}>
              <Box bg="white" borderRadius="md" p={3}>
                {AM_REST.map((it) => renderAmRow(it))}
              </Box>
            </AccordionPanel>
          </AccordionItem>
        ) : null}
      </Accordion>
    </Box>
  )
}
