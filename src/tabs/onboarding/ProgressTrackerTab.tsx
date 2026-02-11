import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Checkbox, Flex, Heading, HStack, Select, Stack, Switch, Text, useToast } from '@chakra-ui/react'
import { api } from '../../utils/api'
import { emit } from '../../platform/events'
import { useCustomersFromDatabase } from '../../hooks/useCustomersFromDatabase'
import { onboardingDebug, onboardingError, onboardingWarn } from './utils/debug'

type OnboardingProgressStepKey = 'company' | 'ownership' | 'leadSource' | 'documents' | 'contacts' | 'notes'

type OnboardingProgress = {
  version: number
  updatedAt: string
  updatedByUserId: string
  steps: Record<OnboardingProgressStepKey, { complete: boolean; updatedAt: string | null }>
  percentComplete: number
  isComplete: boolean
}

const STEP_DEFS: Array<{ key: OnboardingProgressStepKey; label: string; description: string }> = [
  { key: 'company', label: 'Company', description: 'Company overview fields captured' },
  { key: 'ownership', label: 'Ownership', description: 'Assigned manager and ownership details set' },
  { key: 'leadSource', label: 'Lead Source', description: 'Lead source configuration completed' },
  { key: 'documents', label: 'Documents', description: 'Required documents uploaded and visible' },
  { key: 'contacts', label: 'Contacts', description: 'Contacts added and verified' },
  { key: 'notes', label: 'Notes', description: 'Notes captured (if required)' },
]

function emptyProgress(): OnboardingProgress {
  const steps: any = {}
  for (const def of STEP_DEFS) steps[def.key] = { complete: false, updatedAt: null }
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    updatedByUserId: 'unknown',
    steps,
    percentComplete: 0,
    isComplete: false,
  }
}

export default function ProgressTrackerTab() {
  const toast = useToast()
  const { customers, loading, error } = useCustomersFromDatabase()

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [progress, setProgress] = useState<OnboardingProgress>(() => emptyProgress())
  const [isLoadingProgress, setIsLoadingProgress] = useState(false)

  const filteredCustomers = useMemo(() => {
    const list = Array.isArray(customers) ? customers : []
    if (showCompleted) return list
    return list.filter((c: any) => c?.accountData?.onboardingProgress?.isComplete !== true)
  }, [customers, showCompleted])

  // Immediate auto-hide: if current selection is complete and showCompleted is off, hide it from options.
  const dropdownCustomers = useMemo(() => {
    if (showCompleted) return filteredCustomers
    if (!selectedCustomerId) return filteredCustomers
    if (!progress?.isComplete) return filteredCustomers
    return filteredCustomers.filter((c) => c.id !== selectedCustomerId)
  }, [filteredCustomers, progress?.isComplete, selectedCustomerId, showCompleted])

  const loadCustomerProgress = useCallback(
    async (customerId: string) => {
      if (!customerId) return
      onboardingDebug('📥 ProgressTrackerTab: Loading onboardingProgress for customerId:', customerId)
      setIsLoadingProgress(true)
      const { data, error: fetchError } = await api.get<any>(`/api/customers/${customerId}`)
      if (fetchError) {
        toast({
          title: 'Failed to load progress',
          description: fetchError,
          status: 'error',
          duration: 5000,
        })
        setIsLoadingProgress(false)
        return
      }

      const fromDb = data?.accountData?.onboardingProgress
      setProgress(fromDb && typeof fromDb === 'object' ? fromDb : emptyProgress())
      setIsLoadingProgress(false)
    },
    [toast],
  )

  useEffect(() => {
    if (!selectedCustomerId) return
    void loadCustomerProgress(selectedCustomerId)
  }, [selectedCustomerId, loadCustomerProgress])

  // Keep selection valid when filtering changes (auto-remove completed when Show completed is OFF)
  useEffect(() => {
    if (!selectedCustomerId) return
    const stillVisible = dropdownCustomers.some((c) => c.id === selectedCustomerId)
    if (!stillVisible) {
      setSelectedCustomerId('')
      toast({
        title: 'Onboarding complete',
        description: 'Select another customer.',
        status: 'info',
        duration: 4000,
        isClosable: true,
      })
    }
  }, [dropdownCustomers, selectedCustomerId, toast])

  const updateStep = useCallback(
    async (stepKey: OnboardingProgressStepKey, checked: boolean) => {
      if (!selectedCustomerId) {
        onboardingWarn('⚠️ ProgressTrackerTab: No selectedCustomerId, skipping update')
        return
      }

      onboardingDebug('💾 ProgressTrackerTab: Updating onboardingProgress:', {
        customerId: selectedCustomerId,
        stepKey,
        checked,
      })

      // Optimistic UI
      setProgress((prev) => ({
        ...prev,
        steps: { ...prev.steps, [stepKey]: { ...(prev.steps?.[stepKey] || { updatedAt: null }), complete: checked } },
      }))

      const { data, error: saveError } = await api.put<{ success: boolean; onboardingProgress: OnboardingProgress }>(
        `/api/customers/${selectedCustomerId}/onboarding-progress`,
        { steps: { [stepKey]: { complete: checked } } },
      )

      if (saveError || !data?.onboardingProgress) {
        onboardingError('❌ ProgressTrackerTab: Save failed:', saveError)
        toast({
          title: 'Save failed',
          description: saveError || 'Unable to update progress',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        void loadCustomerProgress(selectedCustomerId)
        return
      }

      setProgress(data.onboardingProgress)
      emit('customerUpdated', { id: selectedCustomerId })

      // AUTO-REMOVE completed customers from dropdown when Show completed is OFF
      if (data.onboardingProgress.isComplete && !showCompleted) {
        const next = dropdownCustomers.find((c) => c.id !== selectedCustomerId)?.id || ''
        setSelectedCustomerId(next)
        toast({
          title: 'Onboarding complete',
          description: next ? 'Auto-selected next incomplete customer.' : 'Select another customer.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        })
      }
    },
    [dropdownCustomers, loadCustomerProgress, selectedCustomerId, showCompleted, toast],
  )

  const percentComplete = typeof progress?.percentComplete === 'number' ? progress.percentComplete : 0
  const isComplete = Boolean(progress?.isComplete)

  if (loading) {
    return (
      <Box p={6}>
        <Text>Loading customers…</Text>
      </Box>
    )
  }

  if (error) {
    return (
      <Box p={6}>
        <Text color="red.500" fontSize="sm">
          Failed to load customers: {error}
        </Text>
      </Box>
    )
  }

  return (
    <Box>
      <Stack spacing={4} mb={4}>
        <Heading size="md">Progress Tracker</Heading>
        <Text color="gray.600" fontSize="sm">
          Progress is stored per customer in the database (accountData.onboardingProgress). Completed customers are hidden by default.
        </Text>

        <Flex gap={4} align="center" wrap="wrap">
          <Box minW={{ base: '100%', md: '360px' }}>
            <Text fontSize="sm" fontWeight="semibold" color="gray.700" mb={1}>
              Customer
            </Text>
            <Select
              value={selectedCustomerId}
              placeholder={dropdownCustomers.length ? 'Select customer' : 'No incomplete onboardings'}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              size="sm"
            >
              {dropdownCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Box>

          <HStack spacing={2}>
            <Switch isChecked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />
            <Text fontSize="sm" color="gray.700">
              Show completed
            </Text>
          </HStack>

          <Box>
            <Text fontSize="sm" color={isComplete ? 'green.700' : 'gray.700'} fontWeight="semibold">
              {percentComplete}% complete {isComplete ? '✓' : ''}
            </Text>
            {progress?.updatedAt ? (
              <Text fontSize="xs" color="gray.500">
                Updated {new Date(progress.updatedAt).toLocaleString()}
              </Text>
            ) : null}
          </Box>
        </Flex>
      </Stack>

      {!selectedCustomerId ? (
        <Box p={6} border="1px solid" borderColor="gray.200" borderRadius="xl" bg="white">
          <Text color="gray.600" fontSize="sm">
            Select a customer to view and update progress.
          </Text>
        </Box>
      ) : isLoadingProgress ? (
        <Box p={6}>
          <Text>Loading progress…</Text>
        </Box>
      ) : (
        <Box border="1px solid" borderColor="gray.200" borderRadius="xl" p={6} bg="white">
          <Stack spacing={3}>
            {STEP_DEFS.map((step) => (
              <Checkbox
                key={step.key}
                isChecked={Boolean(progress?.steps?.[step.key]?.complete)}
                onChange={(e) => void updateStep(step.key, e.target.checked)}
                size="md"
              >
                <Stack spacing={0}>
                  <Text fontSize="sm" fontWeight="semibold">
                    {step.label}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    {step.description}
                  </Text>
                </Stack>
              </Checkbox>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  )
}
