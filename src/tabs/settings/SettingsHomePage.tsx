import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, UnlockIcon } from '@chakra-ui/icons'
import {
  Box,
  Flex,
  HStack,
  Icon,
  IconButton,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from '@chakra-ui/react'
import UserAuthorizationTab from '../../components/UserAuthorizationTab'

export type SettingsViewId = 'user-authorization'

function coerceSettingsViewId(view?: string): SettingsViewId {
  if (view === 'user-authorization') return view
  return 'user-authorization'
}

export default function SettingsHomePage({
  view,
  onNavigate,
}: {
  view?: string
  onNavigate?: (view: SettingsViewId) => void
}) {
  const activeView = coerceSettingsViewId(view)
  const tabIndex = 0 // Only one tab for now
  const [isPanelOpen, setIsPanelOpen] = useState(true)

  return (
    <Tabs
      index={tabIndex}
      onChange={(nextIndex) => {
        const nextView: SettingsViewId = 'user-authorization'
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
            minW="220px"
            maxW="240px"
            w="240px"
          >
            <Flex align="center" justify="space-between" mb={2}>
              <Text fontSize="xs" textTransform="uppercase" color="text.muted" letterSpacing="0.08em">
                Settings
              </Text>
              <IconButton
                aria-label="Hide settings panel"
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
                <HStack spacing={2}>
                  <Icon as={UnlockIcon} boxSize={4} />
                  <Text>User Authorization</Text>
                </HStack>
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
              aria-label="Show settings panel"
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
              <UserAuthorizationTab />
            </Box>
          </TabPanel>
        </TabPanels>
      </Flex>
    </Tabs>
  )
}
