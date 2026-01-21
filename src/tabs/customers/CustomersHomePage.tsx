import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons'
import { Box, Flex, IconButton, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react'
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
  const [isPanelOpen, setIsPanelOpen] = useState(true)

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
        {isPanelOpen ? (
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
            <Flex align="center" justify="space-between" mb={2}>
              <Text fontSize="xs" textTransform="uppercase" color="text.muted" letterSpacing="0.08em">
                Sections
              </Text>
              <IconButton
                aria-label="Hide sections panel"
                icon={<ChevronLeftIcon />}
                size="xs"
                variant="ghost"
                onClick={() => setIsPanelOpen(false)}
              />
            </Flex>
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
        ) : (
          <Box
            position="sticky"
            top={16}
            alignSelf="flex-start"
            bg="bg.subtle"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="xl"
            p={1}
            boxShadow="sm"
          >
            <IconButton
              aria-label="Show sections panel"
              icon={<ChevronRightIcon />}
              size="xs"
              variant="ghost"
              onClick={() => setIsPanelOpen(true)}
            />
          </Box>
        )}
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


