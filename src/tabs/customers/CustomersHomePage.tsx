import { Box, ListItem, Tab, TabList, TabPanel, TabPanels, Tabs, Text, UnorderedList } from '@chakra-ui/react'
import AccountsTab from '../../components/AccountsTab'
import ContactsTab from '../../components/ContactsTab'
import { PlaceholderPage } from '../../components/PlaceholderPage'
import { CUSTOMERS_PLANNED_AREAS } from './constants'

export type CustomersViewId = 'overview' | 'accounts' | 'contacts'

function coerceCustomersViewId(view?: string): CustomersViewId {
  if (view === 'accounts' || view === 'contacts') return view
  return 'overview'
}

export default function CustomersHomePage({
  view,
  onNavigate,
  focusAccountName,
}: {
  view?: string
  onNavigate?: (view: CustomersViewId) => void
  focusAccountName?: string
}) {
  const activeView = coerceCustomersViewId(view)
  const tabIndex = activeView === 'overview' ? 0 : activeView === 'accounts' ? 1 : 2

  return (
    <Tabs
      index={tabIndex}
      onChange={(nextIndex) => {
        const nextView: CustomersViewId = nextIndex === 1 ? 'accounts' : nextIndex === 2 ? 'contacts' : 'overview'
        onNavigate?.(nextView)
      }}
      isLazy
      variant="enclosed"
      colorScheme="teal"
    >
      <TabList>
        <Tab>Overview</Tab>
        <Tab>Accounts</Tab>
        <Tab>Contacts</Tab>
      </TabList>
      <TabPanels pt={4}>
        <TabPanel px={0}>
          <PlaceholderPage title="OpenDoors Customers" ownerAgent="Customers Agent" description="Coming soon.">
            <Text fontSize="sm" color="gray.700" mb={2}>
              Planned areas:
            </Text>
            <UnorderedList fontSize="sm" color="gray.600" spacing={1} pl={5}>
              {CUSTOMERS_PLANNED_AREAS.map((a) => (
                <ListItem key={a}>{a}</ListItem>
              ))}
            </UnorderedList>
          </PlaceholderPage>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <AccountsTab focusAccountName={focusAccountName} />
          </Box>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <ContactsTab />
          </Box>
        </TabPanel>
      </TabPanels>
    </Tabs>
  )
}


