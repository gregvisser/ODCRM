/**
 * Lead Sources — provider-backed imports (Cognism API first). Uses /api/lead-sources (batches + contacts).
 * Wide table for contacts.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  HStack,
  Select,
  SimpleGrid,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Checkbox,
  FormControl,
  FormLabel,
  Input,
  Tooltip,
  useToast,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { RepeatIcon, ViewIcon, AddIcon } from '@chakra-ui/icons'
import { api } from '../../../utils/api'
import { normalizeCustomersListResponse } from '../../../utils/normalizeApiResponse'
import * as leadSourceSelectionStore from '../../../platform/stores/leadSourceSelection'
import { useScopedCustomerSelection } from '../../../hooks/useCustomerScope'
import {
  getLeadSources,
  connectCognismLeadSource,
  pollLeadSource,
  getLeadSourceBatches,
  getLeadSourceContacts,
  updateLeadSourceBatchName,
  type LeadSourceType,
  type LeadSourceBatch,
} from '../../../utils/leadSourcesApi'
import { normKey } from '../../../utils/visibleColumns'
import {
  buildReviewColumnDefs,
  contactNumberCell,
  getRecommendedContactNormKeys,
  humanizeLeadSourceNormHeader,
  REVIEW_COLUMN_BATCH,
  REVIEW_COLUMN_CONTACT_NUMBER,
} from '../../../utils/leadSourceReviewColumns'

const SOURCE_LABELS: Record<LeadSourceType, string> = {
  COGNISM: 'Cognism',
  APOLLO: 'Apollo',
  SOCIAL: 'Social',
  BLACKBOOK: 'Blackbook',
}
const POLL_INTERVAL_MS = 45 * 1000

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? v : [])

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test((s || '').trim())
}

function normalizeBatchDate(s: string): string {
  return isIsoDate(s) ? s : isoToday()
}

function getLeadSourceBatchDisplayLabel(batch: LeadSourceBatch): string {
  return batch.displayLabel ?? batch.fallbackLabel ?? batch.batchKey ?? ''
}

function isoYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function getSourceOperatorStatus(src: Awaited<ReturnType<typeof getLeadSources>>['sources'][number] | undefined): {
  colorScheme: 'green' | 'orange' | 'gray' | 'red'
  label: string
  description: string
} {
  if (!src?.connected) {
    return {
      colorScheme: 'gray',
      label: 'Not connected',
      description: 'Connect a lead source before this source can provide new batches.',
    }
  }
  if (src.sourceType === 'COGNISM' && src.providerMode !== 'COGNISM_API') {
    return {
      colorScheme: 'orange',
      label: 'Needs attention',
      description: 'This Cognism source is not using native API mode. Reconnect Cognism to restore live imports.',
    }
  }
  if (src.lastError) {
    return {
      colorScheme: 'red',
      label: 'Error',
      description: `Latest import/config error: ${src.lastError}`,
    }
  }
  const tokenHint =
    src.sourceType === 'COGNISM' && src.providerMode === 'COGNISM_API' && src.cognismTokenLast4
      ? ` Token …${src.cognismTokenLast4}.`
      : ''
  return {
    colorScheme: 'green',
    label: 'Ready',
    description: src.lastFetchAt
      ? `Last refreshed ${new Date(src.lastFetchAt).toLocaleString()}.${tokenHint}`
      : `Connected and ready to review batches.${tokenHint}`,
  }
}

function SourcesOverview({
  sources,
  lastImportBySource,
  onViewBatches,
  onOpenConnect,
  onPoll,
  pollingSourceType,
}: {
  sources: Awaited<ReturnType<typeof getLeadSources>>['sources']
  lastImportBySource: Partial<Record<LeadSourceType, { atIso: string; totalRows: number; newRowsDetected: number }>>
  onViewBatches: (sourceType: LeadSourceType) => void
  onOpenConnect: (sourceType: LeadSourceType) => void
  onPoll: (sourceType: LeadSourceType) => void
  pollingSourceType: LeadSourceType | null
}) {
  return (
    <SimpleGrid id="lead-sources-overview-grid" data-testid="lead-sources-overview-grid" columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
      {(['COGNISM', 'APOLLO', 'SOCIAL', 'BLACKBOOK'] as const).map((sourceType) => {
        const src = sources.find((s) => s.sourceType === sourceType)
        const connected = !!src?.connected
        const operatorStatus = getSourceOperatorStatus(src)
        const lastImport = lastImportBySource[sourceType]
        return (
          <Card key={sourceType} id="lead-sources-source-card" data-testid="lead-sources-source-card">
            <CardHeader>
              <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                <Heading size="sm">{src?.displayName ?? SOURCE_LABELS[sourceType]}</Heading>
                <HStack spacing={2}>
                  <Badge colorScheme={operatorStatus.colorScheme}>{operatorStatus.label}</Badge>
                  {connected && src?.usingGlobalConfig && (
                    <Tooltip label="This source is shared across accounts that do not have their own connection." hasArrow>
                      <Badge colorScheme="blue" cursor="help">Shared source</Badge>
                    </Tooltip>
                  )}
                </HStack>
              </Flex>
            </CardHeader>
            <CardBody pt={0}>
              <Text fontSize="sm" color="gray.700" mb={3}>
                {operatorStatus.description}
              </Text>
              {lastImport ? (
                <Text fontSize="xs" color="gray.600" mb={3}>
                  Last import: {new Date(lastImport.atIso).toLocaleString()} - {lastImport.totalRows} row
                  {lastImport.totalRows === 1 ? '' : 's'} returned, {lastImport.newRowsDetected} new in this batch scan.
                </Text>
              ) : null}
              <VStack align="stretch" spacing={2}>
                <Button
                  id="lead-sources-view-batches-btn"
                  data-testid="lead-sources-view-batches-btn"
                  size="sm"
                  leftIcon={<ViewIcon />}
                  colorScheme={src?.connected ? 'blue' : 'gray'}
                  variant={src?.connected ? 'solid' : 'outline'}
                  isDisabled={!src?.connected}
                  onClick={() => onViewBatches(sourceType)}
                >
                  Review batches
                </Button>
                {src?.connected ? (
                  <Button
                    id="lead-sources-poll-now-btn"
                    data-testid="lead-sources-poll-now-btn"
                    size="sm"
                    leftIcon={<RepeatIcon />}
                    variant="outline"
                    isLoading={pollingSourceType === sourceType}
                    onClick={() => onPoll(sourceType)}
                  >
                    {sourceType === 'COGNISM' && src?.providerMode === 'COGNISM_API'
                      ? 'Import from Cognism'
                      : 'Import'}
                  </Button>
                ) : null}
                <Tooltip
                  label={sourceType !== 'COGNISM' ? 'Only Cognism API is available in this release.' : ''}
                  isDisabled={sourceType === 'COGNISM'}
                  hasArrow
                >
                  <Button
                    id="lead-sources-connect-btn"
                    data-testid="lead-sources-connect-btn"
                    size="sm"
                    leftIcon={<AddIcon />}
                    variant="ghost"
                    isDisabled={sourceType !== 'COGNISM'}
                    onClick={() => onOpenConnect(sourceType)}
                  >
                    {src?.connected
                      ? sourceType === 'COGNISM' && src?.providerMode === 'COGNISM_API'
                        ? 'Replace token / defaults'
                        : 'Manage connection'
                      : sourceType === 'COGNISM'
                        ? 'Connect Cognism'
                        : 'Coming soon'}
                  </Button>
                </Tooltip>
              </VStack>
            </CardBody>
          </Card>
        )
      })}
    </SimpleGrid>
  )
}

function BatchRow({
  batch,
  sourceType,
  activeBatchKey,
  savingBatchKey,
  onViewContacts,
  onUseInSequence,
  onSaveBatchName,
}: {
  batch: LeadSourceBatch
  sourceType: LeadSourceType
  activeBatchKey?: string | null
  savingBatchKey?: string | null
  onViewContacts: (batchKey: string) => void
  onUseInSequence: (batch: LeadSourceBatch) => void
  onSaveBatchName?: (batchKey: string, operatorName: string | null) => Promise<void>
}) {
  const [draft, setDraft] = useState<string>(() => (batch.batchName ?? '').trim())
  const fallbackLabel = batch.fallbackLabel ?? ''
  const isSaving = savingBatchKey === batch.batchKey
  const isDirty = draft !== (batch.batchName ?? '').trim()

  useEffect(() => {
    setDraft((batch.batchName ?? '').trim())
  }, [batch.batchKey, batch.batchName])

  const handleSave = useCallback(() => {
    if (!onSaveBatchName) return
    const value = draft.trim() || null
    onSaveBatchName(batch.batchKey, value).catch(() => {})
  }, [batch.batchKey, draft, onSaveBatchName])

  const handleClear = useCallback(() => {
    setDraft('')
    if (onSaveBatchName) onSaveBatchName(batch.batchKey, null).catch(() => {})
  }, [batch.batchKey, onSaveBatchName])

  return (
    <Tr>
      <Td maxW="320px">
        <VStack align="stretch" spacing={1}>
          <HStack spacing={2} align="center" flexWrap="wrap">
            <Input
              size="sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Optional batch name"
              maxW="200px"
              isDisabled={!onSaveBatchName || isSaving}
            />
            {onSaveBatchName && (
              <HStack spacing={1}>
                <Button size="xs" colorScheme="blue" onClick={handleSave} isLoading={isSaving} isDisabled={!isDirty}>
                  Save
                </Button>
                <Button size="xs" variant="outline" onClick={handleClear} isDisabled={isSaving}>
                  Clear
                </Button>
              </HStack>
            )}
          </HStack>
          <Text fontSize="xs" color="gray.500" noOfLines={2}>
            {fallbackLabel || batch.batchKey}
          </Text>
        </VStack>
      </Td>
      <Td whiteSpace="nowrap">{batch.dateBucket ?? '—'}</Td>
      <Td>{batch.jobTitle ?? '—'}</Td>
      <Td isNumeric>{batch.count ?? 0}</Td>
      <Td>{batch.lastSeenAt ? new Date(batch.lastSeenAt).toLocaleString() : '—'}</Td>
      <Td>
        <HStack spacing={2}>
          <Button
            size="xs"
            variant={activeBatchKey === batch.batchKey ? 'solid' : 'outline'}
            colorScheme={activeBatchKey === batch.batchKey ? 'blue' : undefined}
            onClick={() => onViewContacts(batch.batchKey)}
          >
            {activeBatchKey === batch.batchKey ? 'Reviewing contacts' : 'Review contacts'}
          </Button>
          <Button size="xs" variant="outline" onClick={() => onUseInSequence(batch)}>
            Use in sequence
          </Button>
        </HStack>
      </Td>
    </Tr>
  )
}

function BatchesBlock({
  batches,
  batchesLoading,
  batchesFallback,
  sourceLabel,
  sourceType,
  activeBatchKey,
  batchDate,
  refreshSourceLabel = 'Import from Cognism',
  refreshingSource,
  onBatchDateChange,
  onBack,
  onViewContacts,
  onUseInSequence,
  onRefreshSource,
  onSaveBatchName,
  savingBatchKey,
}: {
  batches: LeadSourceBatch[]
  batchesLoading: boolean
  batchesFallback?: boolean
  sourceLabel: string
  sourceType: LeadSourceType
  activeBatchKey?: string | null
  batchDate: string
  refreshSourceLabel?: string
  refreshingSource: boolean
  onBatchDateChange: (date: string) => void
  onBack: () => void
  onViewContacts: (batchKey: string) => void
  onUseInSequence: (batch: LeadSourceBatch) => void
  onRefreshSource: () => void
  onSaveBatchName?: (batchKey: string, operatorName: string | null) => Promise<void>
  savingBatchKey?: string | null
}) {
  const safeBatches = asArray<LeadSourceBatch>(batches)
  const [searchTerm, setSearchTerm] = useState('')
  const filteredBatches = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return safeBatches
    return safeBatches.filter((batch) =>
      [
        batch.dateBucket,
        batch.jobTitle,
        batch.batchKey,
        batch.batchName ?? '',
        batch.displayLabel ?? '',
        batch.fallbackLabel ?? '',
        batch.client,
      ].some((value) => String(value ?? '').toLowerCase().includes(query))
    )
  }, [safeBatches, searchTerm])
  return (
    <Box mt={6} id="lead-sources-batches-panel" data-testid="lead-sources-batches-panel">
      <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={3} wrap="wrap" mb={3}>
        <Box>
          <Heading size="md">Lead batches — {sourceLabel}</Heading>
          <Text fontSize="sm" color="gray.600" mt={1}>
            Each row is a batch (grouped contacts), not a single lead. Use Review contacts for full row-level fields
            (company, email, etc.). The Date column is the import-day bucket from the batch key; Job title comes from the
            batch grouping when the import mapped it.
          </Text>
        </Box>
        <HStack align="end" spacing={3} wrap="wrap">
          <FormControl width={{ base: '100%', md: '240px' }}>
            <FormLabel fontSize="sm">Filter batches</FormLabel>
            <Input
              id="lead-sources-batches-filter-input"
              data-testid="lead-sources-batches-filter-input"
              size="sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by name, date, job title, or batch key"
            />
          </FormControl>
          <FormControl width="auto">
            <FormLabel fontSize="sm">Date</FormLabel>
            <Input
              type="date"
              size="sm"
              value={normalizeBatchDate(batchDate)}
              onChange={(e) => onBatchDateChange(normalizeBatchDate(e.target.value))}
              maxW="160px"
            />
          </FormControl>
          <Button size="sm" variant="outline" leftIcon={<RepeatIcon />} onClick={onRefreshSource} isLoading={refreshingSource}>
            {refreshSourceLabel}
          </Button>
          <Button size="sm" onClick={onBack}>
            Back
          </Button>
        </HStack>
      </Flex>
      {batchesLoading && safeBatches.length === 0 ? (
        <Spinner size="sm" />
      ) : (
        <>
          {batchesFallback && (
            <Text fontSize="sm" color="gray.600" mb={2}>
              No batches were found for that date, so the most recent batches are shown instead.
            </Text>
          )}
          <Text fontSize="sm" color="gray.600" mb={2}>
            Showing {filteredBatches.length} of {safeBatches.length} batch{safeBatches.length === 1 ? '' : 'es'}, newest batch first.
          </Text>
          <Box
            overflowX="auto"
            borderWidth="1px"
            borderRadius="md"
            bg="white"
            _dark={{ bg: 'gray.800' }}
          >
            <TableContainer
              id="lead-sources-batches-table"
              data-testid="lead-sources-batches-table"
              maxH="55vh"
              overflowY="auto"
              overflowX="visible"
            >
            <Table size="sm" minW="1120px">
              <Thead>
                <Tr>
                  <Th
                    position="sticky"
                    top={0}
                    zIndex={2}
                    bg="gray.50"
                    _dark={{ bg: 'gray.800' }}
                    boxShadow="inset 0 -1px 0 rgba(0, 0, 0, 0.08)"
                  >
                    Batch name
                  </Th>
                  <Th
                    position="sticky"
                    top={0}
                    zIndex={2}
                    bg="gray.50"
                    _dark={{ bg: 'gray.800' }}
                    boxShadow="inset 0 -1px 0 rgba(0, 0, 0, 0.08)"
                  >
                    Date
                  </Th>
                  <Th
                    position="sticky"
                    top={0}
                    zIndex={2}
                    bg="gray.50"
                    _dark={{ bg: 'gray.800' }}
                    boxShadow="inset 0 -1px 0 rgba(0, 0, 0, 0.08)"
                  >
                    Job title
                  </Th>
                  <Th
                    isNumeric
                    position="sticky"
                    top={0}
                    zIndex={2}
                    bg="gray.50"
                    _dark={{ bg: 'gray.800' }}
                    boxShadow="inset 0 -1px 0 rgba(0, 0, 0, 0.08)"
                  >
                    Count
                  </Th>
                  <Th
                    position="sticky"
                    top={0}
                    zIndex={2}
                    bg="gray.50"
                    _dark={{ bg: 'gray.800' }}
                    boxShadow="inset 0 -1px 0 rgba(0, 0, 0, 0.08)"
                  >
                    Last updated
                  </Th>
                  <Th
                    position="sticky"
                    top={0}
                    zIndex={2}
                    bg="gray.50"
                    _dark={{ bg: 'gray.800' }}
                    boxShadow="inset 0 -1px 0 rgba(0, 0, 0, 0.08)"
                  >
                    Actions
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
              {filteredBatches.length === 0 ? (
                <Tr>
                  <Td colSpan={6} color="gray.500">
                    <VStack align="stretch" spacing={2} py={2}>
                      <Text>
                        {safeBatches.length === 0
                          ? "No batches were found for this date. Try yesterday's date, or run Import from Cognism again."
                          : 'No batches match that filter.'}
                      </Text>
                      <Button
                        size="sm"
                        variant="outline"
                        width="fit-content"
                        onClick={() => {
                          if (safeBatches.length === 0) {
                            onBatchDateChange(isoYesterday())
                            return
                          }
                          setSearchTerm('')
                        }}
                      >
                        {safeBatches.length === 0 ? 'Set date to yesterday' : 'Clear filter'}
                      </Button>
                    </VStack>
                  </Td>
                </Tr>
              ) : (
                filteredBatches.map((b) => (
                  <BatchRow
                    key={b.batchKey}
                    batch={b}
                    sourceType={sourceType}
                    activeBatchKey={activeBatchKey}
                    savingBatchKey={savingBatchKey}
                    onViewContacts={onViewContacts}
                    onUseInSequence={onUseInSequence}
                    onSaveBatchName={onSaveBatchName}
                  />
                ))
              )}
            </Tbody>
          </Table>
            </TableContainer>
          </Box>
        </>
      )}
    </Box>
  )
}

function ContactsBlock({
  contacts,
  contactsColumns,
  contactsConfigScope,
  contactsTotal,
  contactsLoading,
  contactsPage,
  contactsPageSize,
  contactsSearchQuery,
  sourceLabel,
  batchIdentity,
  batchDisplayLabel,
  contactsError,
  onContactsSearchChange,
  onPrevPage,
  onNextPage,
  onBack,
}: {
  contacts: Record<string, string>[]
  contactsColumns: string[]
  contactsConfigScope: 'customer' | 'all_accounts' | null
  contactsTotal: number
  contactsLoading: boolean
  contactsPage: number
  contactsPageSize: number
  contactsSearchQuery: string
  sourceLabel: string
  batchIdentity: string
  /** Operator-facing batch title (not a sheet column — avoids mistaking row data for headers). */
  batchDisplayLabel: string
  contactsError: string | null
  onContactsSearchChange: (value: string) => void
  onPrevPage: () => void
  onNextPage: () => void
  onBack: () => void
}) {
  // Normalize keys so columns and row lookups match (API uses canonical camelCase from csvToMappedRows)
  const normalizedColumns = contactsColumns.map((c) => normKey(c))
  const normToDisplay: Record<string, string> = {}
  contactsColumns.forEach((c) => {
    const n = normKey(c)
    if (!(n in normToDisplay)) normToDisplay[n] = c
  })
  const normalizedContacts = contacts.map((row) => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(row ?? {})) out[normKey(k)] = typeof v === 'string' ? v : String(v ?? '')
    return out
  })

  const normalizedColumnSet = useMemo(() => new Set(normalizedColumns), [normalizedColumns])
  const reviewColumnDefs = useMemo(() => buildReviewColumnDefs(normalizedColumnSet), [normalizedColumnSet])

  const recommendedCols = useMemo(() => getRecommendedContactNormKeys(normalizedColumns), [normalizedColumns])
  const [wideColumnMode, setWideColumnMode] = useState(false)
  const [selectedCols, setSelectedCols] = useState<string[]>([])
  const [showColumnChooser, setShowColumnChooser] = useState(false)

  useEffect(() => {
    setWideColumnMode(false)
    setShowColumnChooser(false)
    setSelectedCols([])
  }, [batchIdentity])

  useEffect(() => {
    if (!wideColumnMode) return
    setSelectedCols((current) => {
      const safe = current.filter((col) => normalizedColumns.includes(col))
      return safe.length > 0 ? safe : normalizedColumns
    })
  }, [wideColumnMode, normalizedColumns])

  const displayLabel = (normCol: string) => normToDisplay[normCol] ?? normCol

  const wideCols = selectedCols.length > 0 ? selectedCols : normalizedColumns

  const reviewCell = (columnNormKey: string, row: Record<string, string>): string => {
    if (columnNormKey === REVIEW_COLUMN_BATCH) return batchDisplayLabel
    if (columnNormKey === REVIEW_COLUMN_CONTACT_NUMBER) return contactNumberCell(row)
    if (columnNormKey === 'odcrmfirstseenat') {
      const raw = (row[columnNormKey] ?? '').trim()
      if (!raw) return ''
      const d = Date.parse(raw)
      return Number.isNaN(d) ? raw : new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    }
    return row[columnNormKey] ?? ''
  }

  return (
    <Card id="lead-sources-contacts-panel" data-testid="lead-sources-contacts-panel" overflow="visible">
      <CardHeader>
        <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} wrap="wrap">
          <Box>
            <Heading size="md">Batch contacts preview — {sourceLabel}</Heading>
            <Text fontSize="sm" color="gray.600" mt={1}>
              {contactsConfigScope === 'all_accounts'
                ? 'Using the shared Cognism connection for accounts that do not have their own source.'
                : "Using this client's imported contacts from the connected source."}{' '}
              Default view shows priority columns for sequencing review (stable headers). Use “All columns” for the full imported row.
            </Text>
          </Box>
          <HStack flexWrap="wrap">
            {!wideColumnMode ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setWideColumnMode(true)
                  setSelectedCols(normalizedColumns)
                  setShowColumnChooser(false)
                }}
              >
                All columns
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="solid"
                  colorScheme="blue"
                  onClick={() => {
                    setWideColumnMode(false)
                    setShowColumnChooser(false)
                  }}
                >
                  Priority columns
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowColumnChooser((v) => !v)}>
                  {showColumnChooser ? 'Hide column picker' : 'Choose columns'}
                </Button>
              </>
            )}
            <Button size="sm" onClick={onBack}>
              Back
            </Button>
          </HStack>
        </Flex>
      </CardHeader>
      <CardBody pt={0} overflow="visible">
        {contactsLoading && contacts.length === 0 ? (
          <HStack>
            <Spinner size="sm" />
            <Text fontSize="sm" color="gray.600">Loading imported contacts...</Text>
          </HStack>
        ) : (
          <>
            <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={3} wrap="wrap" mb={4}>
              <FormControl maxW={{ base: '100%', md: '360px' }}>
                <FormLabel fontSize="sm">Search this batch</FormLabel>
                <Input
                  id="lead-sources-contacts-search-input"
                  data-testid="lead-sources-contacts-search-input"
                  size="sm"
                  value={contactsSearchQuery}
                  onChange={(e) => onContactsSearchChange(e.target.value)}
                  placeholder="Search all loaded rows in this batch"
                />
              </FormControl>
              <Text fontSize="sm" color="gray.600">
                Showing {contacts.length} row{contacts.length === 1 ? '' : 's'} on this page, {contactsTotal} match{contactsTotal === 1 ? '' : 'es'} overall.
              </Text>
            </Flex>
            {contactsError ? (
              <Alert status="error" mb={4}>
                <AlertIcon />
                <AlertDescription>{contactsError}</AlertDescription>
              </Alert>
            ) : null}
            {wideColumnMode && showColumnChooser && (
              <Box borderWidth="1px" borderRadius="md" p={3} mb={4}>
                <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} wrap="wrap" mb={3}>
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold">
                      Visible columns (full row)
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Showing {wideCols.length} of {normalizedColumns.length} columns.
                    </Text>
                  </Box>
                  <HStack>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setSelectedCols(recommendedCols.length ? recommendedCols : normalizedColumns)}
                    >
                      Recommended subset
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setSelectedCols(normalizedColumns)}>
                      Show all
                    </Button>
                  </HStack>
                </Flex>
                <Wrap spacing={3}>
                  {normalizedColumns.map((col) => {
                    const checked = wideCols.includes(col)
                    return (
                      <WrapItem key={col}>
                        <Checkbox
                          isChecked={checked}
                          onChange={(e) => {
                            const nextChecked = e.target.checked
                            setSelectedCols((current) => {
                              const base = current.length > 0 ? current : normalizedColumns
                              if (nextChecked) return base.includes(col) ? base : [...base, col]
                              if (base.length <= 1) return base
                              return base.filter((item) => item !== col)
                            })
                          }}
                        >
                          {humanizeLeadSourceNormHeader(col, displayLabel(col))}
                        </Checkbox>
                      </WrapItem>
                    )
                  })}
                </Wrap>
              </Box>
            )}
            <TableContainer
              id="lead-sources-contacts-table"
              data-testid={wideColumnMode ? 'lead-sources-contacts-table-wide' : 'lead-sources-contacts-table-review'}
              w="100%"
              overflowX="auto"
              overflowY="auto"
              maxH="60vh"
              borderWidth="1px"
              borderRadius="md"
              bg="white"
              _dark={{ bg: 'gray.800' }}
            >
              <Table size="sm" minW={wideColumnMode ? '1100px' : '720px'}>
                <Thead>
                  <Tr>
                    {!wideColumnMode
                      ? reviewColumnDefs.map((def) => (
                          <Th
                            key={def.normKey}
                            whiteSpace="nowrap"
                            minW="120px"
                            position="sticky"
                            top={0}
                            zIndex={2}
                            bg="gray.50"
                            _dark={{ bg: 'gray.800' }}
                            boxShadow="inset 0 -1px 0 rgba(0, 0, 0, 0.08)"
                          >
                            {def.header}
                          </Th>
                        ))
                      : wideCols.map((col) => (
                          <Th
                            key={col}
                            whiteSpace="nowrap"
                            minW="120px"
                            position="sticky"
                            top={0}
                            zIndex={2}
                            bg="gray.50"
                            _dark={{ bg: 'gray.800' }}
                            boxShadow="inset 0 -1px 0 rgba(0, 0, 0, 0.08)"
                          >
                            {humanizeLeadSourceNormHeader(col, displayLabel(col))}
                          </Th>
                        ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {normalizedContacts.length === 0 ? (
                    <Tr>
                      <Td
                        colSpan={
                          wideColumnMode ? wideCols.length || 1 : Math.max(1, reviewColumnDefs.length)
                        }
                        color="gray.500"
                      >
                        {contactsSearchQuery.trim()
                          ? 'No imported contacts match this search. Clear the search to view all rows in this batch.'
                          : contactsTotal > 0
                            ? 'No rows on this page (pagination).'
                            : 'No imported contacts are available for this batch yet. Run Import from Cognism and try again.'}
                      </Td>
                    </Tr>
                  ) : !wideColumnMode ? (
                    normalizedContacts.map((row, i) => (
                      <Tr key={i}>
                        {reviewColumnDefs.map((def) => (
                          <Td key={def.normKey} whiteSpace="nowrap" minW="120px">
                            {reviewCell(def.normKey, row)}
                          </Td>
                        ))}
                      </Tr>
                    ))
                  ) : (
                    normalizedContacts.map((row, i) => (
                      <Tr key={i}>
                        {wideCols.map((col) => (
                          <Td key={col} whiteSpace="nowrap" minW="120px">
                            {row[col] ?? ''}
                          </Td>
                        ))}
                      </Tr>
                    ))
                  )}
                </Tbody>
              </Table>
            </TableContainer>
            <Flex justify="space-between" align="center" mt={4}>
              <Text fontSize="sm" color="gray.600">
                Page {contactsPage} of {Math.ceil(contactsTotal / contactsPageSize) || 1} ({contactsTotal} total)
              </Text>
              <HStack>
                <Button size="sm" isDisabled={contactsPage <= 1} onClick={onPrevPage}>
                  Previous
                </Button>
                <Button size="sm" isDisabled={contactsPage >= Math.ceil(contactsTotal / contactsPageSize)} onClick={onNextPage}>
                  Next
                </Button>
              </HStack>
            </Flex>
          </>
        )}
      </CardBody>
    </Card>
  )
}

export default function LeadSourcesTabNew({
  onNavigateToSequences,
}: {
  onNavigateToSequences?: () => void
} = {}) {
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([])
  const { canSelectCustomer, customerId, setCustomerId } = useScopedCustomerSelection()
  const [sources, setSources] = useState<Awaited<ReturnType<typeof getLeadSources>>['sources']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewBatchesSource, setViewBatchesSource] = useState<LeadSourceType | null>(null)
  const [batches, setBatches] = useState<LeadSourceBatch[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [batchesFallback, setBatchesFallback] = useState(false)
  const [batchDate, setBatchDate] = useState<string>(isoToday())
  const [contactsBatchKey, setContactsBatchKey] = useState<{ sourceType: LeadSourceType; batchKey: string } | null>(null)
  const [contacts, setContacts] = useState<Record<string, string>[]>([])
  const [contactsColumns, setContactsColumns] = useState<string[]>([])
  const [contactsConfigScope, setContactsConfigScope] = useState<'customer' | 'all_accounts' | null>(null)
  const [contactsPage, setContactsPage] = useState(1)
  const [contactsTotal, setContactsTotal] = useState(0)
  const [contactsPageSize] = useState(50)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsError, setContactsError] = useState<string | null>(null)
  const [contactsSearchQuery, setContactsSearchQuery] = useState('')
  const [connectName, setConnectName] = useState('')
  const [connectSubmitting, setConnectSubmitting] = useState(false)
  const [connectApplyToAllAccounts, setConnectApplyToAllAccounts] = useState(false)
  const [connectCognismToken, setConnectCognismToken] = useState('')
  const [cognismCompanies, setCognismCompanies] = useState('')
  const [cognismJobTitles, setCognismJobTitles] = useState('')
  const [cognismRegions, setCognismRegions] = useState('')
  const [pollingSourceType, setPollingSourceType] = useState<LeadSourceType | null>(null)
  const [lastImportBySource, setLastImportBySource] = useState<
    Partial<Record<LeadSourceType, { atIso: string; totalRows: number; newRowsDetected: number }>>
  >({})
  const [savingBatchKey, setSavingBatchKey] = useState<string | null>(null)
  const { isOpen: isConnectOpen, onOpen: onConnectOpen, onClose: onConnectClose } = useDisclosure()
  const toast = useToast()

  const loadCustomers = useCallback(async () => {
    const res = await api.get('/api/customers')
    if (res.error) return
    try {
      const list = normalizeCustomersListResponse(res.data) as Array<{ id: string; name: string }>
      setCustomers(list.map((c) => ({ id: c.id, name: c.name })))
    } catch {
      setCustomers([])
    }
  }, [])

  const loadSources = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getLeadSources(customerId)
      setSources(data.sources)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sources')
      setSources([])
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    if (customerId) loadSources()
  }, [customerId, loadSources])

  useEffect(() => {
    if (!customerId || !viewBatchesSource) return
    const safeDate = normalizeBatchDate(batchDate)
    if (safeDate !== batchDate) {
      setBatchDate(safeDate)
      return
    }
    let cancelled = false
    const run = async () => {
      setBatchesLoading(true)
      try {
        const data = await getLeadSourceBatches(customerId, viewBatchesSource, safeDate)
        const list = Array.isArray(data) ? data : (data?.batches ?? [])
        const safeList = asArray<LeadSourceBatch>(list)
        if (!cancelled) {
          setBatches(safeList)
          setBatchesFallback(!!(data && 'batchesFallback' in data && data.batchesFallback))
          if (safeList.length === 0) {
            setContactsBatchKey(null)
            setContacts([])
            setContactsColumns([])
            setContactsConfigScope(null)
            setContactsError(null)
            setContactsTotal(0)
            setContactsPage(1)
          } else {
            const currentBatchStillValid =
              contactsBatchKey &&
              contactsBatchKey.sourceType === viewBatchesSource &&
              safeList.some((batch) => batch.batchKey === contactsBatchKey.batchKey)

            if (!currentBatchStillValid) {
              setContactsBatchKey({ sourceType: viewBatchesSource, batchKey: safeList[0].batchKey })
              setContacts([])
              setContactsColumns([])
              setContactsConfigScope(null)
              setContactsError(null)
              setContactsTotal(0)
              setContactsPage(1)
            }
          }
          if (import.meta.env.DEV) console.log('[LeadSources] batches[0]=', safeList?.[0])
        }
      } catch {
        if (!cancelled) {
          setBatches([])
          setBatchesFallback(false)
        }
      } finally {
        if (!cancelled) setBatchesLoading(false)
      }
    }
    run()
    const t = setInterval(run, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [contactsBatchKey, customerId, viewBatchesSource, batchDate])

  const loadContacts = useCallback(
    async (opts?: { keepPrevious: boolean }) => {
      if (!customerId || !contactsBatchKey) return
      if (!opts?.keepPrevious) setContactsLoading(true)
      setContactsError(null)
      try {
        const data = await getLeadSourceContacts(
          customerId,
          contactsBatchKey.sourceType,
          contactsBatchKey.batchKey,
          contactsPage,
          contactsPageSize,
          contactsSearchQuery
        )
        if (import.meta.env.DEV) {
          console.log('[LeadSources] contacts columns:', data?.columns)
          console.log('[LeadSources] contacts[0] keys:', Object.keys(data?.contacts?.[0] ?? {}))
          console.log('[LeadSources] contacts[0] row:', data?.contacts?.[0])
        }
        setContacts(asArray<Record<string, string>>(data?.contacts))
        setContactsColumns(asArray<string>(data?.columns))
        setContactsConfigScope(data?.configScope ?? null)
        setContactsTotal(Number(data?.total ?? 0))
      } catch {
        setContactsError('Failed to load contacts for this batch. Try refreshing the source and opening this batch again.')
        if (!opts?.keepPrevious) {
          setContacts([])
          setContactsColumns([])
          setContactsConfigScope(null)
          setContactsTotal(0)
        }
      } finally {
        setContactsLoading(false)
      }
    },
    [customerId, contactsBatchKey, contactsPage, contactsPageSize, contactsSearchQuery]
  )

  useEffect(() => {
    if (contactsBatchKey) loadContacts()
  }, [contactsBatchKey, contactsPage, loadContacts])

  // Poll contacts every 45s when viewing a batch; keep previous data while refreshing (no flicker)
  useEffect(() => {
    if (!customerId || !contactsBatchKey) return
    const t = setInterval(() => loadContacts({ keepPrevious: true }), POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [customerId, contactsBatchKey, contactsPage, contactsPageSize, loadContacts])

  const handleCustomerChange = (id: string) => {
    setCustomerId(id)
    setViewBatchesSource(null)
    setContactsBatchKey(null)
    setContactsConfigScope(null)
    setContactsError(null)
    setContactsSearchQuery('')
    setLastImportBySource({})
  }

  const handlePoll = async (sourceType: LeadSourceType) => {
    setPollingSourceType(sourceType)
    try {
      const result = await pollLeadSource(customerId, sourceType)
      setLastImportBySource((prev) => ({
        ...prev,
        [sourceType]: {
          atIso: result.lastFetchAt,
          totalRows: result.totalRows,
          newRowsDetected: result.newRowsDetected,
        },
      }))
      if (result.totalRows === 0) {
        toast({
          title: 'Import returned no contacts',
          description: `${SOURCE_LABELS[sourceType]} returned zero contacts. Adjust filters or the linked source and try again.`,
          status: 'info',
          duration: 6000,
        })
      } else {
        toast({
          title: 'Import complete',
          description: `${result.totalRows} row${result.totalRows === 1 ? '' : 's'} returned, ${result.newRowsDetected} new.`,
          status: 'success',
          duration: 4000,
        })
      }
      loadSources()
      if (viewBatchesSource === sourceType) {
        const data = await getLeadSourceBatches(customerId, sourceType, normalizeBatchDate(batchDate))
        const list = Array.isArray(data) ? data : (data?.batches ?? [])
        setBatches(list)
        setBatchesFallback(!!(data && 'batchesFallback' in data && data.batchesFallback))
        if (contactsBatchKey?.sourceType === sourceType) {
          await loadContacts({ keepPrevious: true })
        }
      }
    } catch (e) {
      toast({ title: 'Poll failed', description: e instanceof Error ? e.message : 'Error', status: 'error', duration: 5000 })
    } finally {
      setPollingSourceType(null)
    }
  }

  const openConnect = (sourceType: LeadSourceType) => {
    if (sourceType !== 'COGNISM') return
    setConnectName(SOURCE_LABELS[sourceType])
    setConnectApplyToAllAccounts(false)
    setConnectCognismToken('')
    setCognismCompanies('')
    setCognismJobTitles('')
    setCognismRegions('')
    onConnectOpen()
  }

  const submitConnect = async () => {
    if (!connectName.trim()) return
    if (!connectCognismToken.trim()) return
    const companies = cognismCompanies
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const jobs = cognismJobTitles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const regions = cognismRegions
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const searchDefaults: Record<string, unknown> = {}
    if (companies.length > 0) searchDefaults.account = { names: companies }
    if (jobs.length > 0) searchDefaults.jobTitles = jobs
    if (regions.length > 0) searchDefaults.regions = regions
    setConnectSubmitting(true)
    try {
      await connectCognismLeadSource(customerId, {
        apiToken: connectCognismToken.trim(),
        displayName: connectName.trim(),
        applyToAllAccounts: connectApplyToAllAccounts,
        searchDefaults,
      })
      toast({ title: 'Cognism API connected', status: 'success', duration: 3000 })
      onConnectClose()
      loadSources()
    } catch (e) {
      toast({
        title: 'Cognism connect failed',
        description: e instanceof Error ? e.message : 'Error',
        status: 'error',
        duration: 7000,
      })
    } finally {
      setConnectSubmitting(false)
    }
  }

  const handleUseInSequence = (batch: LeadSourceBatch) => {
    if ((batch.count ?? 0) <= 0) {
      toast({
        title: 'No contacts to materialize',
        description: 'This batch currently has no imported contacts. Run Import from Cognism and review the batch again.',
        status: 'warning',
        duration: 5000,
      })
      return
    }
    const source = viewBatchesSource ?? (batch.sourceType ?? contactsBatchKey?.sourceType as LeadSourceType)
    const key = batch.batchKey
    leadSourceSelectionStore.setLeadSourceBatchSelection({
      sourceType: source,
      batchKey: key,
      batchName: batch.batchName ?? null,
      displayLabel: batch.displayLabel ?? batch.fallbackLabel ?? undefined,
    })
    toast({
      title: 'Batch selected for sequence',
      description: 'Go to Sequences to preview recipients and use this batch.',
      status: 'info',
      duration: 5000,
    })
    onNavigateToSequences?.()
  }

  const handleSaveBatchName = useCallback(
    async (batchKey: string, operatorName: string | null) => {
      if (!customerId || !viewBatchesSource) return
      setSavingBatchKey(batchKey)
      const adminSecret = import.meta.env.VITE_ADMIN_SECRET as string | undefined
      try {
        await updateLeadSourceBatchName(customerId, viewBatchesSource, batchKey, operatorName, adminSecret)
        toast({ title: 'Batch name saved', status: 'success', duration: 3000 })
        const data = await getLeadSourceBatches(customerId, viewBatchesSource, normalizeBatchDate(batchDate))
        const list = Array.isArray(data) ? data : (data?.batches ?? [])
        setBatches(asArray<LeadSourceBatch>(list))
      } catch (e) {
        toast({
          title: 'Failed to save batch name',
          description: e instanceof Error ? e.message : 'Error',
          status: 'error',
          duration: 5000,
        })
      } finally {
        setSavingBatchKey(null)
      }
    },
    [customerId, viewBatchesSource, batchDate, toast]
  )

  const buildVersion = import.meta.env.VITE_GIT_SHA ?? 'unknown'
  const viewBatchSourceConfig = useMemo(
    () => (viewBatchesSource ? sources.find((s) => s.sourceType === viewBatchesSource) : undefined),
    [sources, viewBatchesSource]
  )
  const cognismApiMode = viewBatchesSource === 'COGNISM' && viewBatchSourceConfig?.providerMode === 'COGNISM_API'
  const sourceSummary = useMemo(() => {
    const connected = sources.filter((source) => source.connected).length
    const needsAttention = sources.filter((source) => source.connected && !!source.lastError).length
    const shared = sources.filter((source) => source.connected && source.usingGlobalConfig).length
    const ready = sources.filter((source) => source.connected && !source.lastError).length

    return {
      total: sources.length,
      connected,
      ready,
      needsAttention,
      shared,
    }
  }, [sources])

  return (
    <Box p={4} id="lead-sources-tab-panel" data-testid="lead-sources-tab-panel">
      <VStack align="stretch" spacing={6}>
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
          <Box>
            <Heading size="lg">Lead Sources</Heading>
            <Text fontSize="sm" color="gray.600" mt={1}>
              See which lead sources are ready, review the latest batches for a client, and pass the right batch into Sequences.
            </Text>
            {import.meta.env.DEV && (
              <Text fontSize="xs" color="gray.500" mt={0.5}>
                build: {buildVersion}
              </Text>
            )}
          </Box>
          <Select
            id="lead-sources-customer-select"
            data-testid="lead-sources-customer-select"
            maxW="280px"
            value={customerId}
            onChange={(e) => handleCustomerChange(e.target.value)}
            placeholder="Select client"
            isDisabled={!canSelectCustomer}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Flex>

        {!customerId ? (
          <Alert status="info" id="lead-sources-no-customer-state" data-testid="lead-sources-no-customer-state">
            <AlertIcon />
            <Box>
              <AlertTitle>Select a client to review lead sources</AlertTitle>
              <AlertDescription>
                Choose a client above to see which sources are ready, review batches, and send the right batch into Sequences.
              </AlertDescription>
            </Box>
          </Alert>
        ) : (
          <>
            {loading && (
              <Flex justify="center" py={8}>
                <Spinner size="lg" />
              </Flex>
            )}
            {error && (
              <Alert id="lead-sources-error-state" data-testid="lead-sources-error-state" status="error">
                <AlertIcon />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!loading && customerId && (
              <>
                {sourceSummary.connected === 0 ? (
                  <Alert status="info">
                    <AlertIcon />
                    <Box>
                      <AlertTitle>No lead sources connected yet</AlertTitle>
                      <AlertDescription>
                        Connect at least one source below, then review its batches to choose which contacts should move into Sequences.
                      </AlertDescription>
                    </Box>
                  </Alert>
                ) : sourceSummary.needsAttention > 0 ? (
                  <Alert status="warning">
                    <AlertIcon />
                    <Box>
                      <AlertTitle>Some lead sources need attention</AlertTitle>
                      <AlertDescription>
                        {sourceSummary.needsAttention} connected source{sourceSummary.needsAttention === 1 ? '' : 's'} reported a refresh issue. Review the source status first, then use the setup section below if you need to refresh or reconnect.
                      </AlertDescription>
                    </Box>
                  </Alert>
                ) : (
                  <Alert status="success">
                    <AlertIcon />
                    <Box>
                      <AlertTitle>Lead sources are ready to review</AlertTitle>
                      <AlertDescription>
                        Start with the source cards below to open the latest batches and choose which batch should move into Sequences.
                      </AlertDescription>
                    </Box>
                  </Alert>
                )}
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                  <Card>
                    <CardBody>
                      <Text fontSize="2xl" fontWeight="bold">{sourceSummary.connected}</Text>
                      <Text fontSize="sm" color="gray.600">Connected sources</Text>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody>
                      <Text fontSize="2xl" fontWeight="bold">{sourceSummary.ready}</Text>
                      <Text fontSize="sm" color="gray.600">Ready to use</Text>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody>
                      <Text fontSize="2xl" fontWeight="bold">{sourceSummary.needsAttention}</Text>
                      <Text fontSize="sm" color="gray.600">Need attention</Text>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody>
                      <Text fontSize="2xl" fontWeight="bold">{sourceSummary.shared}</Text>
                      <Text fontSize="sm" color="gray.600">Using shared source</Text>
                    </CardBody>
                  </Card>
                </SimpleGrid>
                <Box>
                  <Heading size="md" mb={1}>Source status</Heading>
                  <Text fontSize="sm" color="gray.600">
                    Start here to see which lead sources are ready and open the batch you want to review next.
                  </Text>
                </Box>
                <SourcesOverview
                  sources={sources}
                  lastImportBySource={lastImportBySource}
                  onPoll={handlePoll}
                  pollingSourceType={pollingSourceType}
                  onViewBatches={(sourceType) => {
                    setViewBatchesSource(sourceType)
                    setContactsBatchKey(null)
                    setContactsSearchQuery('')
                    setBatchDate((prev) => normalizeBatchDate(prev))
                    setBatches([])
                    setBatchesFallback(false)
                  }}
                  onOpenConnect={(sourceType) => openConnect(sourceType)}
                />
                {viewBatchesSource ? (
                  <BatchesBlock
                    sourceLabel={SOURCE_LABELS[viewBatchesSource]}
                    sourceType={viewBatchesSource}
                    batches={batches}
                    batchesLoading={batchesLoading}
                    batchesFallback={batchesFallback}
                    activeBatchKey={contactsBatchKey?.batchKey ?? null}
                    batchDate={batchDate}
                    refreshSourceLabel={cognismApiMode ? 'Import from Cognism' : 'Import'}
                    refreshingSource={pollingSourceType === viewBatchesSource}
                    onBatchDateChange={(next) => setBatchDate(next)}
                    onRefreshSource={() => handlePoll(viewBatchesSource)}
                    onBack={() => {
                      setViewBatchesSource(null)
                      setContactsBatchKey(null)
                      setContactsSearchQuery('')
                      setContacts([])
                      setContactsColumns([])
                      setContactsConfigScope(null)
                      setContactsError(null)
                      setContactsTotal(0)
                      setContactsPage(1)
                    }}
                    onViewContacts={(batchKey) => {
                      setContactsSearchQuery('')
                      setContacts([])
                      setContactsColumns([])
                      setContactsConfigScope(null)
                      setContactsError(null)
                      setContactsTotal(0)
                      setContactsPage(1)
                      setContactsBatchKey({ sourceType: viewBatchesSource, batchKey })
                      requestAnimationFrame(() => {
                        document.getElementById('lead-sources-contacts-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      })
                    }}
                    onUseInSequence={(batch) => handleUseInSequence(batch)}
                    onSaveBatchName={handleSaveBatchName}
                    savingBatchKey={savingBatchKey}
                  />
                ) : null}
                {contactsBatchKey ? (
                  <ContactsBlock
                    key={`${contactsBatchKey.sourceType}:${contactsBatchKey.batchKey}`}
                    batchIdentity={`${contactsBatchKey.sourceType}:${contactsBatchKey.batchKey}`}
                    batchDisplayLabel={getLeadSourceBatchDisplayLabel(
                      batches.find((b) => b.batchKey === contactsBatchKey.batchKey) ??
                        ({ batchKey: contactsBatchKey.batchKey } as LeadSourceBatch),
                    )}
                    sourceLabel={SOURCE_LABELS[contactsBatchKey.sourceType]}
                    contacts={contacts}
                    contactsColumns={contactsColumns}
                    contactsConfigScope={contactsConfigScope}
                    contactsTotal={contactsTotal}
                    contactsLoading={contactsLoading}
                    contactsPage={contactsPage}
                    contactsPageSize={contactsPageSize}
                    contactsSearchQuery={contactsSearchQuery}
                    contactsError={contactsError}
                    onContactsSearchChange={(value) => {
                      setContactsPage(1)
                      setContactsSearchQuery(value)
                    }}
                    onPrevPage={() => setContactsPage((p) => Math.max(1, p - 1))}
                    onNextPage={() => setContactsPage((p) => p + 1)}
                    onBack={() => {
                      setContactsBatchKey(null)
                      setContactsSearchQuery('')
                      setContacts([])
                      setContactsColumns([])
                      setContactsConfigScope(null)
                      setContactsError(null)
                      setContactsTotal(0)
                      setContactsPage(1)
                    }}
                  />
                ) : null}
                <Card>
                  <CardHeader pb={2}>
                    <Heading size="md">Source setup &amp; troubleshooting</Heading>
                    <Text fontSize="sm" color="gray.600" mt={1}>
                      Use the source cards above to import, review batches, and manage the Cognism connection.
                    </Text>
                  </CardHeader>
                  <CardBody pt={0}>
                    <Alert id="lead-sources-provider-truth-banner" data-testid="lead-sources-provider-truth-banner" status="info" mb={4}>
                      <AlertIcon />
                      <AlertDescription fontSize="sm">
                        Lead Sources uses provider-backed imports stored in ODCRM. Cognism connects via API token; other providers are not yet available. Imported rows are the source of truth for batches and contacts.
                      </AlertDescription>
                    </Alert>
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                      <Box borderWidth="1px" borderRadius="md" p={4}>
                        <Heading size="sm" mb={2}>Import and review</Heading>
                        <Text fontSize="sm" color="gray.600">
                          Run Import from Cognism on a connected card, then review batches and contacts in the same flow.
                        </Text>
                      </Box>
                      <Box borderWidth="1px" borderRadius="md" p={4}>
                        <Heading size="sm" mb={2}>Reconnect safely</Heading>
                        <Text fontSize="sm" color="gray.600">
                          Use Replace token / defaults when the Cognism token or search filters change. Shared scope applies to accounts without their own connection.
                        </Text>
                      </Box>
                      <Box borderWidth="1px" borderRadius="md" p={4}>
                        <Heading size="sm" mb={2}>Troubleshooting</Heading>
                        <Text fontSize="sm" color="gray.600">
                          If batches look empty, run import again and confirm search defaults return results in Cognism.
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </CardBody>
                </Card>
              </>
            )}
          </>
        )}
      </VStack>

      <Modal isOpen={isConnectOpen} onClose={onConnectClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Connect Cognism — API token</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired mb={3}>
              <FormLabel>Cognism API token</FormLabel>
              <Input
                type="password"
                autoComplete="off"
                value={connectCognismToken}
                onChange={(e) => setConnectCognismToken(e.target.value)}
                placeholder="Paste API key (Bearer token)"
              />
              <Text fontSize="sm" color="gray.600" mt={1}>
                The token is stored encrypted on the server and is never shown again after save.
              </Text>
            </FormControl>
            <FormControl mb={3}>
              <FormLabel>Company names (optional)</FormLabel>
              <Input
                value={cognismCompanies}
                onChange={(e) => setCognismCompanies(e.target.value)}
                placeholder="Comma-separated, e.g. Acme Ltd, Contoso"
              />
              <Text fontSize="sm" color="gray.600" mt={1}>
                Mapped to Cognism search account.names. Add at least one filter if your search returns too many results.
              </Text>
            </FormControl>
            <FormControl mb={3}>
              <FormLabel>Job titles (optional)</FormLabel>
              <Input
                value={cognismJobTitles}
                onChange={(e) => setCognismJobTitles(e.target.value)}
                placeholder="Comma-separated, e.g. Chief Revenue Officer"
              />
            </FormControl>
            <FormControl mb={3}>
              <FormLabel>Regions (optional)</FormLabel>
              <Input
                value={cognismRegions}
                onChange={(e) => setCognismRegions(e.target.value)}
                placeholder="Comma-separated, e.g. EMEA, North America"
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Display name</FormLabel>
              <Input
                placeholder="e.g. Cognism"
                value={connectName}
                onChange={(e) => setConnectName(e.target.value)}
              />
            </FormControl>
            <FormControl mt={3}>
              <Checkbox
                isChecked={connectApplyToAllAccounts}
                onChange={(e) => setConnectApplyToAllAccounts(e.target.checked)}
              >
                Apply to all accounts (use this connection for every customer that does not have their own)
              </Checkbox>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onConnectClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={submitConnect}
              isLoading={connectSubmitting}
              isDisabled={!connectCognismToken.trim() || !connectName.trim()}
            >
              Connect
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
