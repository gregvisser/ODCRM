import {
  Box,
  Flex,
  ListItem,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  UnorderedList,
  useBreakpointValue,
} from '@chakra-ui/react'
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

  const orientation = useBreakpointValue({ base: 'horizontal', md: 'vertical' }) ?? 'horizontal'

  return (
    <Tabs
      index={tabIndex}
      onChange={(nextIndex) => {
        const nextView: OperationsViewId = nextIndex === 1 ? 'user-authorization' : 'overview'
        onNavigate?.(nextView)
      }}
      isLazy
      variant="soft-rounded"
      colorScheme="gray"
      orientation={orientation}
    >
      <Flex direction={{ base: 'column', md: 'row' }} gap={{ base: 4, md: 6 }}>
        <Box
          position={{ base: 'static', md: 'sticky' }}
          top={{ md: 16 }}
          alignSelf="flex-start"
          bg="bg.surface"
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="lg"
          p={2}
          minW={{ md: '220px' }}
          maxW={{ md: '240px' }}
          w={{ base: '100%', md: '240px' }}
        >
          <TabList flexDirection={{ base: 'row', md: 'column' }}>
            <Tab justifyContent={{ md: 'flex-start' }}>Overview</Tab>
            <Tab justifyContent={{ md: 'flex-start' }}>User Authorization</Tab>
          </TabList>
        </Box>
        <TabPanels flex="1" pt={{ base: 0, md: 1 }}>
          <TabPanel px={0}>
            <PlaceholderPage title="Operations" ownerAgent="Operations Agent">
              <Text fontSize="sm" color="text.muted" mb={2}>
                Planned areas:
              </Text>
              <UnorderedList fontSize="sm" color="text.muted" spacing={1} pl={5}>
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
      </Flex>
    </Tabs>
  )
}


