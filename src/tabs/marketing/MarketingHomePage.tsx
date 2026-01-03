import { Box, ListItem, Tab, TabList, TabPanel, TabPanels, Tabs, Text, UnorderedList } from '@chakra-ui/react'
import EmailCampaignsTab from '../../components/EmailCampaignsTab'
import MarketingCognismProspectsTab from '../../components/MarketingCognismProspectsTab'
import MarketingEmailTemplatesTab from '../../components/MarketingEmailTemplatesTab'
import MarketingLeadsTab from '../../components/MarketingLeadsTab'
import { PlaceholderPage } from '../../components/PlaceholderPage'
import { MARKETING_PLANNED_AREAS } from './constants'

export type MarketingViewId = 'overview' | 'leads' | 'campaigns' | 'templates' | 'cognism-prospects'

function coerceMarketingViewId(view?: string): MarketingViewId {
  if (view === 'leads' || view === 'campaigns' || view === 'templates' || view === 'cognism-prospects') return view
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
      : activeView === 'leads'
        ? 1
        : activeView === 'campaigns'
          ? 2
          : activeView === 'templates'
            ? 3
            : 4

  return (
    <Tabs
      index={tabIndex}
      onChange={(nextIndex) => {
        const nextView: MarketingViewId =
          nextIndex === 1
            ? 'leads'
            : nextIndex === 2
              ? 'campaigns'
              : nextIndex === 3
                ? 'templates'
                : nextIndex === 4
                  ? 'cognism-prospects'
                  : 'overview'
        onNavigate?.(nextView)
      }}
      isLazy
      variant="enclosed"
      colorScheme="teal"
    >
      <TabList>
        <Tab>Overview</Tab>
        <Tab>Leads</Tab>
        <Tab>Email Campaigns</Tab>
        <Tab>Email Templates</Tab>
        <Tab>Cognism Prospects</Tab>
      </TabList>
      <TabPanels pt={4}>
        <TabPanel px={0}>
          <PlaceholderPage title="OpenDoors Marketing" ownerAgent="Marketing Agent">
            <Text fontSize="sm" color="gray.700" mb={2}>
              Planned areas:
            </Text>
            <UnorderedList fontSize="sm" color="gray.600" spacing={1} pl={5}>
              {MARKETING_PLANNED_AREAS.map((a) => (
                <ListItem key={a}>{a}</ListItem>
              ))}
            </UnorderedList>
          </PlaceholderPage>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <MarketingLeadsTab focusAccountName={focusAccountName} />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <EmailCampaignsTab />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <MarketingEmailTemplatesTab />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <MarketingCognismProspectsTab />
          </Box>
        </TabPanel>
      </TabPanels>
    </Tabs>
  )
}


