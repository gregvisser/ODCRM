import { Box, ListItem, Tab, TabList, TabPanel, TabPanels, Tabs, Text, UnorderedList } from '@chakra-ui/react'
import UserAuthorizationTab from '../../components/UserAuthorizationTab'
import { PlaceholderPage } from '../../components/PlaceholderPage'
import { OPERATIONS_PLANNED_AREAS } from './constants'

export type OperationsViewId = 'overview' | 'user-authorization'

function coerceOperationsViewId(view?: string): OperationsViewId {
  if (view === 'user-authorization') return view
  return 'overview'
}

export default function OperationsHomePage({
  view,
  onNavigate,
}: {
  view?: string
  onNavigate?: (view: OperationsViewId) => void
}) {
  const activeView = coerceOperationsViewId(view)
  const tabIndex = activeView === 'overview' ? 0 : 1

  return (
    <Tabs
      index={tabIndex}
      onChange={(nextIndex) => {
        const nextView: OperationsViewId = nextIndex === 1 ? 'user-authorization' : 'overview'
        onNavigate?.(nextView)
      }}
      isLazy
      variant="enclosed"
      colorScheme="teal"
    >
      <TabList>
        <Tab>Overview</Tab>
        <Tab>User Authorization</Tab>
      </TabList>
      <TabPanels pt={4}>
        <TabPanel px={0}>
          <PlaceholderPage title="Operations" ownerAgent="Operations Agent">
            <Text fontSize="sm" color="gray.700" mb={2}>
              Planned areas:
            </Text>
            <UnorderedList fontSize="sm" color="gray.600" spacing={1} pl={5}>
              {OPERATIONS_PLANNED_AREAS.map((a) => (
                <ListItem key={a}>{a}</ListItem>
              ))}
            </UnorderedList>
          </PlaceholderPage>
        </TabPanel>
        <TabPanel px={0}>
          <Box>
            <UserAuthorizationTab />
          </Box>
        </TabPanel>
      </TabPanels>
    </Tabs>
  )
}


