import { Box, Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react'
import AccountsTab from '../../components/AccountsTab'
import ContactsTab from '../../components/ContactsTab'

export type CustomersViewId = 'accounts' | 'contacts'

function coerceCustomersViewId(view?: string): CustomersViewId {
  if (view === 'accounts' || view === 'contacts') return view
  return 'accounts'
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
  const tabIndex = activeView === 'accounts' ? 0 : 1

  return (
    <Tabs
      index={tabIndex}
      onChange={(nextIndex) => {
        const nextView: CustomersViewId = nextIndex === 1 ? 'contacts' : 'accounts'
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
        <TabList>
          <Tab>Accounts</Tab>
          <Tab>Contacts</Tab>
        </TabList>
      </Box>
      <TabPanels pt={4}>
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


