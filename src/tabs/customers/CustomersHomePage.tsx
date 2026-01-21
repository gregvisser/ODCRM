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
      variant="unstyled"
      orientation="vertical"
    >
      <Flex direction="row" gap={{ base: 4, md: 6 }} align="flex-start">
        <Box
          position="sticky"
          top={16}
          alignSelf="flex-start"
          bg="bg.subtle"
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="xl"
          p={3}
          boxShadow="sm"
          minW="200px"
          maxW="220px"
          w="220px"
        >
          <TabList flexDirection="column" gap={1}>
            <Tab
              justifyContent={{ md: 'flex-start' }}
              fontSize="sm"
              fontWeight="600"
              borderRadius="md"
              color="text.muted"
              _hover={{ bg: 'white', color: 'text.primary' }}
              _selected={{ bg: 'white', color: 'text.primary', boxShadow: 'sm' }}
            >
              Accounts
            </Tab>
            <Tab
              justifyContent={{ md: 'flex-start' }}
              fontSize="sm"
              fontWeight="600"
              borderRadius="md"
              color="text.muted"
              _hover={{ bg: 'white', color: 'text.primary' }}
              _selected={{ bg: 'white', color: 'text.primary', boxShadow: 'sm' }}
            >
              Contacts
            </Tab>
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


