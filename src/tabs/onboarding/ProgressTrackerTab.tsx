import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Checkbox,
  Heading,
  Stack,
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

interface ProgressTrackerTabProps {
  customerId: string
}

export default function ProgressTrackerTab({ customerId }: ProgressTrackerTabProps) {
  const toast = useToast()
  const [salesChecklist, setSalesChecklist] = useState<ChecklistState>({})
  const [opsChecklist, setOpsChecklist] = useState<ChecklistState>({})
  const [amChecklist, setAmChecklist] = useState<ChecklistState>({})
  const [isLoading, setIsLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState(0)

  // Load checklist state from database
  const loadChecklistState = useCallback(async () => {
    if (!customerId) return
    setIsLoading(true)
    const { data, error } = await api.get<{ accountData?: { progressTracker?: any } }>(
      `/api/customers/${customerId}`,
    )
    if (error) {
      toast({
        title: 'Failed to load progress tracker',
        description: error,
        status: 'error',
        duration: 4000,
      })
      setIsLoading(false)
      return
    }

    const progressTracker = data?.accountData?.progressTracker
    if (progressTracker) {
      setSalesChecklist(progressTracker.sales || {})
      setOpsChecklist(progressTracker.ops || {})
      setAmChecklist(progressTracker.am || {})
    }
    setIsLoading(false)
  }, [customerId, toast])

  useEffect(() => {
    void loadChecklistState()
  }, [loadChecklistState])

  // Save checklist state to database
  const saveChecklistState = useCallback(
    async (group: 'sales' | 'ops' | 'am', itemKey: string, checked: boolean) => {
      if (!customerId) return

      // Optimistically update UI
      const updateState = (prev: ChecklistState) => ({ ...prev, [itemKey]: checked })
      if (group === 'sales') setSalesChecklist(updateState)
      if (group === 'ops') setOpsChecklist(updateState)
      if (group === 'am') setAmChecklist(updateState)

      // Get current customer data first (need full customer for validation)
      const { data: customerData, error: fetchError } = await api.get<any>(
        `/api/customers/${customerId}`,
      )
      if (fetchError) {
        toast({
          title: 'Save failed',
          description: fetchError,
          status: 'error',
          duration: 4000,
        })
        void loadChecklistState() // Revert to server state
        return
      }

      const currentAccountData = customerData?.accountData || {}
      const currentProgressTracker = currentAccountData.progressTracker || {}

      const updatedProgressTracker = {
        ...currentProgressTracker,
        [group]: {
          ...(currentProgressTracker[group] || {}),
          [itemKey]: checked,
        },
      }

      const updatedAccountData = {
        ...currentAccountData,
        progressTracker: updatedProgressTracker,
      }

      // Save to database with complete customer payload (required by validation schema)
      const { error } = await api.put(`/api/customers/${customerId}`, {
        name: customerData.name, // Required by backend validation
        domain: customerData.domain || null,
        accountData: updatedAccountData,
        website: customerData.website || null,
        whatTheyDo: customerData.whatTheyDo || null,
        accreditations: customerData.accreditations || null,
        keyLeaders: customerData.keyLeaders || null,
        companyProfile: customerData.companyProfile || null,
        recentNews: customerData.recentNews || null,
        companySize: customerData.companySize || null,
        headquarters: customerData.headquarters || null,
        foundingYear: customerData.foundingYear || null,
        socialPresence: customerData.socialPresence || null,
        leadsReportingUrl: customerData.leadsReportingUrl || null,
        sector: customerData.sector || null,
        clientStatus: customerData.clientStatus || 'active',
        targetJobTitle: customerData.targetJobTitle || null,
        prospectingLocation: customerData.prospectingLocation || null,
        monthlyIntakeGBP: customerData.monthlyIntakeGBP ? parseFloat(customerData.monthlyIntakeGBP) : null,
        defcon: customerData.defcon || null,
        weeklyLeadTarget: customerData.weeklyLeadTarget || null,
        weeklyLeadActual: customerData.weeklyLeadActual || null,
        monthlyLeadTarget: customerData.monthlyLeadTarget || null,
        monthlyLeadActual: customerData.monthlyLeadActual || null,
      })

      if (error) {
        toast({
          title: 'Save failed',
          description: error,
          status: 'error',
          duration: 4000,
        })
        void loadChecklistState() // Revert to server state
      }
    },
    [customerId, toast, loadChecklistState],
  )

  // Check if all items in a group are checked
  const isGroupComplete = useCallback((items: typeof SALES_TEAM_ITEMS, state: ChecklistState) => {
    return items.every((item) => state[item.key] === true)
  }, [])

  const salesComplete = useMemo(
    () => isGroupComplete(SALES_TEAM_ITEMS, salesChecklist),
    [isGroupComplete, salesChecklist],
  )
  const opsComplete = useMemo(
    () => isGroupComplete(OPS_TEAM_ITEMS, opsChecklist),
    [isGroupComplete, opsChecklist],
  )
  const amComplete = useMemo(() => isGroupComplete(AM_ITEMS, amChecklist), [isGroupComplete, amChecklist])

  // Color for sub-tab: light red by default, green when complete
  const getTabBg = (isComplete: boolean) => (isComplete ? 'green.100' : 'red.50')
  const getTabColor = (isComplete: boolean) => (isComplete ? 'green.800' : 'red.800')
  const getTabBorderColor = (isComplete: boolean) => (isComplete ? 'green.300' : 'red.200')

  if (isLoading) {
    return (
      <Box p={6}>
        <Text>Loading progress tracker...</Text>
      </Box>
    )
  }

  return (
    <Box>
      <Stack spacing={4} mb={4}>
        <Heading size="md">Progress Tracker</Heading>
        <Text color="gray.600" fontSize="sm">
          Track onboarding progress across Sales, Operations, and Account Management teams. Checklist state is saved
          per customer.
        </Text>
      </Stack>

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
    </Box>
  )
}
