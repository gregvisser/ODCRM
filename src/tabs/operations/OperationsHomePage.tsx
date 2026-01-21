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

  return (
    <Tabs
      index={tabIndex}
      onChange={(nextIndex) => {
        const nextView: OperationsViewId = nextIndex === 1 ? 'user-authorization' : 'overview'
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
          minW="220px"
          maxW="240px"
          w="240px"
        >
          <Text fontSize="xs" textTransform="uppercase" color="text.muted" mb={2} letterSpacing="0.08em">
            Sections
          </Text>
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
              Overview
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
              User Authorization
            </Tab>
          </TabList>
        </Box>
        <TabPanels flex="1" pt={1}>
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


