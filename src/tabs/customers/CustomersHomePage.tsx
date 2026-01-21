import { Box, Flex, Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react'
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
      variant="soft-rounded"
      colorScheme="gray"
      orientation="vertical"
    >
      <Flex direction="row" gap={{ base: 4, md: 6 }} align="flex-start">
        <Box
          position="sticky"
          top={16}
          alignSelf="flex-start"
          bg="bg.surface"
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="lg"
          p={2}
          minW="200px"
          maxW="220px"
          w="220px"
        >
          <TabList flexDirection="column">
            <Tab justifyContent={{ md: 'flex-start' }}>Accounts</Tab>
            <Tab justifyContent={{ md: 'flex-start' }}>Contacts</Tab>
          </TabList>
        </Box>
        <TabPanels flex="1" pt={1}>
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
      </Flex>
    </Tabs>
  )
}


