import { Box, Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react'
import EmailCampaignsTab from '../../components/EmailCampaignsTab'
import EmailSettingsTab from '../../components/EmailSettingsTab'
import MarketingInboxTab from '../../components/MarketingInboxTab'
import MarketingCognismProspectsTab from '../../components/MarketingCognismProspectsTab'
import MarketingEmailTemplatesTab from '../../components/MarketingEmailTemplatesTab'
import MarketingLeadsTab from '../../components/MarketingLeadsTab'
import MarketingListsTab from '../../components/MarketingListsTab'
import MarketingPeopleTab from '../../components/MarketingPeopleTab'
import MarketingReportsTab from '../../components/MarketingReportsTab'
import MarketingSchedulesTab from '../../components/MarketingSchedulesTab'
import MarketingSequencesTab from '../../components/MarketingSequencesTab'
import MarketingDashboard from '../../components/MarketingDashboard'

export type MarketingViewId =
  | 'overview'
  | 'campaigns'
  | 'sequences'
  | 'people'
  | 'lists'
  | 'inbox'
  | 'reports'
  | 'templates'
  | 'email-accounts'
  | 'schedules'
  | 'cognism-prospects'
  | 'leads'

function coerceMarketingViewId(view?: string): MarketingViewId {
  if (
    view === 'leads' ||
    view === 'campaigns' ||
    view === 'sequences' ||
    view === 'people' ||
    view === 'lists' ||
    view === 'inbox' ||
    view === 'reports' ||
    view === 'templates' ||
    view === 'email-accounts' ||
    view === 'schedules' ||
    view === 'cognism-prospects'
  )
    return view
  return 'overview'
}

export default function MarketingHomePage({
  view,
  onNavigate,
  focusAccountName,
}: {
  view?: string
  onNavigate?: (view: MarketingViewId) => void
  focusAccountName?: string
}) {
  const activeView = coerceMarketingViewId(view)
  const tabIndex =
    activeView === 'overview'
      ? 0
      : activeView === 'campaigns'
        ? 1
        : activeView === 'sequences'
          ? 2
          : activeView === 'people'
            ? 3
            : activeView === 'lists'
              ? 4
              : activeView === 'inbox'
                ? 5
                : activeView === 'reports'
                  ? 6
                  : activeView === 'templates'
                    ? 7
                    : activeView === 'email-accounts'
                      ? 8
                      : activeView === 'schedules'
                        ? 9
                        : activeView === 'cognism-prospects'
                          ? 10
                          : 11

  return (
    <Tabs
      index={tabIndex}
      onChange={(nextIndex) => {
        const nextView: MarketingViewId =
          nextIndex === 1
            ? 'campaigns'
            : nextIndex === 2
              ? 'sequences'
              : nextIndex === 3
                ? 'people'
                : nextIndex === 4
                  ? 'lists'
                  : nextIndex === 5
                    ? 'inbox'
                    : nextIndex === 6
                      ? 'reports'
                      : nextIndex === 7
                        ? 'templates'
                        : nextIndex === 8
                          ? 'email-accounts'
                          : nextIndex === 9
                            ? 'schedules'
                            : nextIndex === 10
                              ? 'cognism-prospects'
                              : nextIndex === 11
                                ? 'leads'
                                : 'overview'
        onNavigate?.(nextView)
      }}
      isLazy
      variant="enclosed"
      colorScheme="teal"
    >
      <Box
        position="sticky"
        top={0}
        zIndex={5}
        bg="bg.surface"
        borderTopRadius="md"
        pt={2}
        pb={1}
      >
        <TabList overflowX="auto" whiteSpace="nowrap">
          <Tab>Overview</Tab>
          <Tab>Campaigns</Tab>
          <Tab>Sequences</Tab>
          <Tab>People</Tab>
          <Tab>Lists</Tab>
          <Tab>Inbox</Tab>
          <Tab>Reports</Tab>
          <Tab>Templates</Tab>
          <Tab>Email Accounts</Tab>
          <Tab>Schedules</Tab>
          <Tab>Cognism Prospects</Tab>
          <Tab>Leads</Tab>
        </TabList>
      </Box>
      <TabPanels pt={4}>
        <TabPanel px={0}>
          <MarketingDashboard />
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <EmailCampaignsTab />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <MarketingSequencesTab />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <MarketingPeopleTab />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <MarketingListsTab />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <MarketingInboxTab />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <MarketingReportsTab />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <MarketingEmailTemplatesTab />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <EmailSettingsTab />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <MarketingSchedulesTab />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <MarketingCognismProspectsTab />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <MarketingLeadsTab focusAccountName={focusAccountName} />
          </Box>
        </TabPanel>
      </TabPanels>
    </Tabs>
  )
}


