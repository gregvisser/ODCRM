import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Select,
  Stack,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useToast,
  VStack,
  Divider,
} from '@chakra-ui/react'
import { api } from '../../utils/api'
import { emit } from '../../platform/events'
import { useCustomersFromDatabase } from '../../hooks/useCustomersFromDatabase'
import { onboardingDebug, onboardingError, onboardingWarn } from './utils/debug'

// Stable keys for checklist items (NEVER change these - they're persisted in DB)
const SALES_TEAM_ITEMS = [
  { key: 'sales_client_agreement', label: 'Client Agreement and Approval' },
  { key: 'sales_additional_services', label: 'Additional Services Confirmed' },
  { key: 'sales_expectations_documented', label: 'Realistic Client Expectations and Deliverables Documented (timeframes)' },
  { key: 'sales_validate_ops', label: 'Validate with Ops Team what can be delivered & when.' },
  { key: 'sales_contract_signed', label: 'Contract Signed & Filed' },
  { key: 'sales_start_date', label: 'Start Date Agreed' },
  { key: 'sales_assign_am', label: 'Assign Account Manager' },
  { key: 'sales_first_payment', label: 'First Payment Received' },
  { key: 'sales_handover', label: 'Handover to Ops Team; with additional services, contract details & timeframes.' },
  { key: 'sales_team_signoff', label: 'Sales Team Member Sign Off:' },
  { key: 'sales_finance_signoff', label: 'Finance Manager Sign Off:' },
  { key: 'sales_ops_signon', label: 'Ops Team Member Sign On:' },
]

const OPS_TEAM_ITEMS = [
  { key: 'ops_details_reviewed', label: 'Client Details Reviewed for Completion and Accuracy' },
  { key: 'ops_added_crm', label: 'Client Added to CRM System & Back Up Folder' },
  { key: 'ops_brief_am', label: 'Internal Onboarding Brief with AM' },
  { key: 'ops_prepare_pack', label: 'Prepare Client Onboarding Pack with Relevant Information' },
  { key: 'ops_welcome_email', label: 'Send Welcome Email and Onboarding Pack with Information Requests' },
  { key: 'ops_schedule_meeting', label: 'Agree & Schedule Onboarding Meeting with Client & Account Manager' },
  { key: 'ops_populate_ppt', label: 'Populate Onboarding Meeting PPT' },
  { key: 'ops_receive_file', label: 'Receive & File Onboarding Information Received from Client' },
  { key: 'ops_create_emails', label: 'Create/Set Up Emails for Outreach with Agreed Auto Signatures' },
  { key: 'ops_create_ddi', label: 'Create Client DDI & Test' },
  { key: 'ops_lead_tracker', label: 'Add Client to Lead Tracker' },
  { key: 'ops_brief_campaigns', label: 'Brief Campaigns Creator' },
  { key: 'ops_team_signoff', label: 'Ops Team Member Sign Off:' },
  { key: 'ops_am_signon', label: 'Account Manager Sign On:' },
]

const AM_ITEMS = [
  { key: 'am_prepare_meeting', label: 'Prepare for Onboarding Meeting*' },
  { key: 'am_introduce_team', label: 'Introduce the Team' },
  { key: 'am_confirm_go_live', label: 'Confirm Go Live Date' },
  { key: 'am_populate_icp', label: 'Populate Ideal Customer Profile*' },
  { key: 'am_check_info_received', label: 'Check All Requested Client Info Has Been Received*. Inc DNC List' },
  { key: 'am_send_dnc', label: 'Send DNC List to Ops Team for loading to CRM' },
  { key: 'am_target_list', label: 'Desired Target Prospect List' },
  { key: 'am_qualifying_questions', label: 'Confirm What Qualifies as a Lead for Client (qualifying questions)' },
  { key: 'am_weekly_target', label: 'Confirm Weekly Lead Target' },
  { key: 'am_campaign_template', label: 'Campaign Template Discussion' },
  { key: 'am_report_format', label: 'Confirm Preferred Week Day & Format for Weekly Report' },
  { key: 'am_communication', label: 'Agree Preferred Communication Channel & Schedule Weekly/Bi Weekly Meeting' },
  { key: 'am_face_to_face', label: 'Schedule Two Month Face to Face Meeting' },
  { key: 'am_file_info', label: 'File all Information in Client Folder. Ops Team to Update CRM' },
  { key: 'am_strategy_meeting', label: 'Internal Strategy Meeting with Assigned Team' },
  { key: 'am_template_brief', label: 'Internal Template Brief with Campaigns Creator' },
  { key: 'am_confirm_start', label: 'Confirm start date of Telesales Campaigns' },
  { key: 'am_templates_reviewed', label: 'Templates Reviewed and Agreed with Client' },
  { key: 'am_client_live', label: 'Client is Live' },
  { key: 'am_campaigns_launched', label: 'Email/LinkedIn Campaigns Launched' },
  { key: 'am_signoff', label: 'Account Manager Sign Off:' },
  { key: 'am_ops_signon', label: 'Ops Team Member Sign On:' },
  { key: 'am_quality_check', label: 'Full Team Quality Check of Progress' },
]

type ChecklistState = Record<string, boolean>

function isGroupComplete(items: { key: string }[], state: ChecklistState): boolean {
  return items.every((item) => state[item.key] === true)
}

function computeOverallComplete(progressTracker: any): boolean {
  const sales = progressTracker?.sales || {}
  const ops = progressTracker?.ops || {}
  const am = progressTracker?.am || {}
  return (
    isGroupComplete(SALES_TEAM_ITEMS, sales) &&
    isGroupComplete(OPS_TEAM_ITEMS, ops) &&
    isGroupComplete(AM_ITEMS, am)
  )
}

export default function ProgressTrackerTab() {
  const toast = useToast()
  const { customers, loading, error } = useCustomersFromDatabase()

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [salesChecklist, setSalesChecklist] = useState<ChecklistState>({})
  const [opsChecklist, setOpsChecklist] = useState<ChecklistState>({})
  const [amChecklist, setAmChecklist] = useState<ChecklistState>({})
  const [isLoadingProgress, setIsLoadingProgress] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState(0)

  const filteredCustomers = useMemo(() => {
    const list = Array.isArray(customers) ? customers : []
    if (showCompleted) return list
    return list.filter((c: any) => !computeOverallComplete(c?.accountData?.progressTracker))
  }, [customers, showCompleted])

  const loadChecklistState = useCallback(
    async (customerId: string) => {
      if (!customerId) return
      onboardingDebug('📥 ProgressTrackerTab: Loading progressTracker for customerId:', customerId)
      setIsLoadingProgress(true)
      const { data, error: fetchError } = await api.get<any>(`/api/customers/${customerId}`)
      if (fetchError) {
        toast({
          title: 'Failed to load progress tracker',
          description: fetchError,
          status: 'error',
          duration: 4000,
        })
        setIsLoadingProgress(false)
        return
      }

      const progressTracker = data?.accountData?.progressTracker
      setSalesChecklist(progressTracker?.sales || {})
      setOpsChecklist(progressTracker?.ops || {})
      setAmChecklist(progressTracker?.am || {})
      setIsLoadingProgress(false)
    },
    [toast],
  )

  useEffect(() => {
    if (!selectedCustomerId) return
    void loadChecklistState(selectedCustomerId)
  }, [selectedCustomerId, loadChecklistState])

  // AUTO-REMOVE completed customers when Show completed is OFF.
  useEffect(() => {
    if (!selectedCustomerId) return
    if (showCompleted) return

    const isCompleteNow =
      isGroupComplete(SALES_TEAM_ITEMS, salesChecklist) &&
      isGroupComplete(OPS_TEAM_ITEMS, opsChecklist) &&
      isGroupComplete(AM_ITEMS, amChecklist)

    if (!isCompleteNow) return

    // Remove from dropdown by clearing selection and optionally selecting next incomplete
    const next = filteredCustomers.find((c: any) => c.id !== selectedCustomerId)?.id || ''
    setSelectedCustomerId(next)
    toast({
      title: 'Onboarding complete',
      description: next ? 'Auto-selected next incomplete customer.' : 'Select another customer.',
      status: 'success',
      duration: 5000,
      isClosable: true,
    })
  }, [amChecklist, filteredCustomers, opsChecklist, salesChecklist, selectedCustomerId, showCompleted, toast])

  const saveChecklistState = useCallback(
    async (group: 'sales' | 'ops' | 'am', itemKey: string, checked: boolean) => {
      if (!selectedCustomerId) {
        onboardingWarn('⚠️ ProgressTrackerTab: No selectedCustomerId, skipping save')
        return
      }

      onboardingDebug('💾 ProgressTrackerTab: Saving progressTracker item:', {
        customerId: selectedCustomerId,
        group,
        itemKey,
        checked,
      })

      // Optimistically update UI
      const updateState = (prev: ChecklistState) => ({ ...prev, [itemKey]: checked })
      if (group === 'sales') setSalesChecklist(updateState)
      if (group === 'ops') setOpsChecklist(updateState)
      if (group === 'am') setAmChecklist(updateState)

      const { data, error: saveError } = await api.put<{ success: boolean; progressTracker: any }>(
        `/api/customers/${selectedCustomerId}/progress-tracker`,
        { group, itemKey, checked },
      )

      if (saveError || !data?.progressTracker) {
        onboardingError('❌ Progress Tracker save failed:', { selectedCustomerId, group, itemKey, checked, saveError })
        toast({
          title: 'Save failed',
          description: saveError || 'Unable to save progress',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        void loadChecklistState(selectedCustomerId) // Revert to server truth
        return
      }

      // Rehydrate UI from response (DB truth)
      setSalesChecklist(data.progressTracker?.sales || {})
      setOpsChecklist(data.progressTracker?.ops || {})
      setAmChecklist(data.progressTracker?.am || {})
      emit('customerUpdated', { id: selectedCustomerId })
    },
    [loadChecklistState, selectedCustomerId, toast],
  )

  const salesComplete = useMemo(() => isGroupComplete(SALES_TEAM_ITEMS, salesChecklist), [salesChecklist])
  const opsComplete = useMemo(() => isGroupComplete(OPS_TEAM_ITEMS, opsChecklist), [opsChecklist])
  const amComplete = useMemo(() => isGroupComplete(AM_ITEMS, amChecklist), [amChecklist])

  // Color for sub-tab: light red by default, green when complete
  const getTabBg = (isComplete: boolean) => (isComplete ? 'green.100' : 'red.50')
  const getTabColor = (isComplete: boolean) => (isComplete ? 'green.800' : 'red.800')
  const getTabBorderColor = (isComplete: boolean) => (isComplete ? 'green.300' : 'red.200')

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
          Track onboarding progress across Sales, Operations, and Account Management teams. Checklist state is saved per customer.
        </Text>

        <Flex gap={4} align="center" wrap="wrap">
          <Box minW={{ base: '100%', md: '360px' }}>
            <Text fontSize="sm" fontWeight="semibold" color="gray.700" mb={1}>
              Customer
            </Text>
            <Select
              value={selectedCustomerId}
              placeholder={filteredCustomers.length || showCompleted ? 'Select customer' : 'No incomplete onboardings'}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              size="sm"
            >
              {(showCompleted ? customers : filteredCustomers).map((c: any) => (
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
          <Text>Loading progress tracker…</Text>
        </Box>
      ) : (
        <Tabs index={activeSubTab} onChange={setActiveSubTab} variant="unstyled">
          <TabList gap={2} mb={4} flexWrap="wrap">
            <Tab
              bg={getTabBg(salesComplete)}
              color={getTabColor(salesComplete)}
              border="2px solid"
              borderColor={getTabBorderColor(salesComplete)}
              borderRadius="md"
              px={4}
              py={2}
              fontWeight="semibold"
              _selected={{
                bg: salesComplete ? 'green.200' : 'red.100',
                borderColor: salesComplete ? 'green.400' : 'red.300',
              }}
              _hover={{
                bg: salesComplete ? 'green.150' : 'red.75',
              }}
            >
              Sales Team {salesComplete ? '✓' : ''}
            </Tab>
            <Tab
              bg={getTabBg(opsComplete)}
              color={getTabColor(opsComplete)}
              border="2px solid"
              borderColor={getTabBorderColor(opsComplete)}
              borderRadius="md"
              px={4}
              py={2}
              fontWeight="semibold"
              _selected={{
                bg: opsComplete ? 'green.200' : 'red.100',
                borderColor: opsComplete ? 'green.400' : 'red.300',
              }}
              _hover={{
                bg: opsComplete ? 'green.150' : 'red.75',
              }}
            >
              Operations Team {opsComplete ? '✓' : ''}
            </Tab>
            <Tab
              bg={getTabBg(amComplete)}
              color={getTabColor(amComplete)}
              border="2px solid"
              borderColor={getTabBorderColor(amComplete)}
              borderRadius="md"
              px={4}
              py={2}
              fontWeight="semibold"
              _selected={{
                bg: amComplete ? 'green.200' : 'red.100',
                borderColor: amComplete ? 'green.400' : 'red.300',
              }}
              _hover={{
                bg: amComplete ? 'green.150' : 'red.75',
              }}
            >
              Account Manager {amComplete ? '✓' : ''}
            </Tab>
          </TabList>

          <TabPanels>
            {/* Sales Team Panel */}
            <TabPanel px={0} py={4}>
              <Box border="1px solid" borderColor="gray.200" borderRadius="xl" p={6} bg="white">
                <VStack align="stretch" spacing={3}>
                  <Heading size="sm" mb={2}>
                    Sales Team Checklist
                  </Heading>
                  {SALES_TEAM_ITEMS.map((item, idx) => (
                    <Box key={item.key}>
                      <Checkbox
                        isChecked={salesChecklist[item.key] || false}
                        onChange={(e) => void saveChecklistState('sales', item.key, e.target.checked)}
                        size="md"
                      >
                        <Text fontSize="sm">{item.label}</Text>
                      </Checkbox>
                      {(idx === 8 || idx === 10) && <Divider my={2} />}
                    </Box>
                  ))}
                </VStack>
              </Box>
            </TabPanel>

            {/* Operations Team Panel */}
            <TabPanel px={0} py={4}>
              <Box border="1px solid" borderColor="gray.200" borderRadius="xl" p={6} bg="white">
                <VStack align="stretch" spacing={3}>
                  <Heading size="sm" mb={2}>
                    Operations Team Checklist
                  </Heading>
                  {OPS_TEAM_ITEMS.map((item, idx) => (
                    <Box key={item.key}>
                      <Checkbox
                        isChecked={opsChecklist[item.key] || false}
                        onChange={(e) => void saveChecklistState('ops', item.key, e.target.checked)}
                        size="md"
                      >
                        <Text fontSize="sm">{item.label}</Text>
                      </Checkbox>
                      {(idx === 11 || idx === 12) && <Divider my={2} />}
                    </Box>
                  ))}
                </VStack>
              </Box>
            </TabPanel>

            {/* Account Manager Panel */}
            <TabPanel px={0} py={4}>
              <Box border="1px solid" borderColor="gray.200" borderRadius="xl" p={6} bg="white">
                <VStack align="stretch" spacing={3}>
                  <Heading size="sm" mb={2}>
                    Account Manager Checklist
                  </Heading>
                  {AM_ITEMS.map((item, idx) => (
                    <Box key={item.key}>
                      <Checkbox
                        isChecked={amChecklist[item.key] || false}
                        onChange={(e) => void saveChecklistState('am', item.key, e.target.checked)}
                        size="md"
                      >
                        <Text fontSize="sm">{item.label}</Text>
                      </Checkbox>
                      {(idx === 19 || idx === 21) && <Divider my={2} />}
                    </Box>
                  ))}
                </VStack>
              </Box>
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </Box>
  )
}
