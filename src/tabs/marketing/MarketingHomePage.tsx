import { useState } from 'react'
import {
  AttachmentIcon,
  ChatIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  EmailIcon,
  InfoIcon,
  RepeatIcon,
  SearchIcon,
  SettingsIcon,
  StarIcon,
  TimeIcon,
  ViewIcon,
  AtSignIcon,
} from '@chakra-ui/icons'
import { Box, Flex, HStack, Icon, IconButton, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react'
import EmailCampaignsTab from '../../components/EmailCampaignsTab'
import EmailSettingsTab from '../../components/EmailSettingsTab'
import MarketingInboxTab from '../../components/MarketingInboxTab'
import MarketingCognismProspectsTab from '../../components/MarketingCognismProspectsTab'
import MarketingEmailTemplatesTab from '../../components/MarketingEmailTemplatesTab'
import MarketingLeadsTab from '../../components/MarketingLeadsTab'
import MarketingListsTab from '../../components/MarketingListsTab'
import MarketingPeopleTab from '../../components/MarketingPeopleTab'
import MarketingReportsTab from '../../components/MarketingReportsTab'
import MarketingSchedulesTab from '../../components/MarketingSchedulesTab'
import MarketingSequencesTab from '../../components/MarketingSequencesTab'
import MarketingDashboard from '../../components/MarketingDashboard'

export type MarketingViewId =
  | 'overview'
  | 'campaigns'
  | 'sequences'
  | 'people'
  | 'lists'
  | 'inbox'
  | 'reports'
  | 'templates'
  | 'email-accounts'
  | 'schedules'
  | 'cognism-prospects'
  | 'leads'

function coerceMarketingViewId(view?: string): MarketingViewId {
  if (
    view === 'leads' ||
    view === 'campaigns' ||
    view === 'sequences' ||
    view === 'people' ||
    view === 'lists' ||
    view === 'inbox' ||
    view === 'reports' ||
    view === 'templates' ||
    view === 'email-accounts' ||
    view === 'schedules' ||
    view === 'cognism-prospects'
  )
    return view
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
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const tabIndex =
    activeView === 'overview'
      ? 0
      : activeView === 'campaigns'
        ? 1
        : activeView === 'sequences'
          ? 2
          : activeView === 'people'
            ? 3
            : activeView === 'lists'
              ? 4
              : activeView === 'inbox'
                ? 5
                : activeView === 'reports'
                  ? 6
                  : activeView === 'templates'
                    ? 7
                    : activeView === 'email-accounts'
                      ? 8
                      : activeView === 'schedules'
                        ? 9
                        : activeView === 'cognism-prospects'
                          ? 10
                          : 11

  return (
    <Tabs
      index={tabIndex}
      onChange={(nextIndex) => {
        const nextView: MarketingViewId =
          nextIndex === 1
            ? 'campaigns'
            : nextIndex === 2
              ? 'sequences'
              : nextIndex === 3
                ? 'people'
                : nextIndex === 4
                  ? 'lists'
                  : nextIndex === 5
                    ? 'inbox'
                    : nextIndex === 6
                      ? 'reports'
                      : nextIndex === 7
                        ? 'templates'
                        : nextIndex === 8
                          ? 'email-accounts'
                          : nextIndex === 9
                            ? 'schedules'
                            : nextIndex === 10
                              ? 'cognism-prospects'
                              : nextIndex === 11
                                ? 'leads'
                                : 'overview'
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
            <TabList flexDirection="column" overflowX="visible" whiteSpace="normal" gap={1}>
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
                <Icon as={InfoIcon} boxSize={4} />
                <Text>Overview</Text>
              </HStack>
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
              <HStack spacing={2}>
                <Icon as={EmailIcon} boxSize={4} />
                <Text>Campaigns</Text>
              </HStack>
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
              <HStack spacing={2}>
                <Icon as={RepeatIcon} boxSize={4} />
                <Text>Sequences</Text>
              </HStack>
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
              <HStack spacing={2}>
                <Icon as={AtSignIcon} boxSize={4} />
                <Text>People</Text>
              </HStack>
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
              <HStack spacing={2}>
                <Icon as={ViewIcon} boxSize={4} />
                <Text>Lists</Text>
              </HStack>
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
              <HStack spacing={2}>
                <Icon as={ChatIcon} boxSize={4} />
                <Text>Inbox</Text>
              </HStack>
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
              <HStack spacing={2}>
                <Icon as={SearchIcon} boxSize={4} />
                <Text>Reports</Text>
              </HStack>
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
              <HStack spacing={2}>
                <Icon as={CopyIcon} boxSize={4} />
                <Text>Templates</Text>
              </HStack>
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
              <HStack spacing={2}>
                <Icon as={SettingsIcon} boxSize={4} />
                <Text>Email Accounts</Text>
              </HStack>
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
              <HStack spacing={2}>
                <Icon as={TimeIcon} boxSize={4} />
                <Text>Schedules</Text>
              </HStack>
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
              <HStack spacing={2}>
                <Icon as={StarIcon} boxSize={4} />
                <Text>Cognism Prospects</Text>
              </HStack>
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
              <HStack spacing={2}>
                <Icon as={AttachmentIcon} boxSize={4} />
                <Text>Leads</Text>
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
            <MarketingDashboard />
          </TabPanel>
          <TabPanel px={0}>
            <Box>
              <EmailCampaignsTab />
            </Box>
          </TabPanel>
          <TabPanel px={0}>
            <Box>
              <MarketingSequencesTab />
            </Box>
          </TabPanel>
          <TabPanel px={0}>
            <Box>
              <MarketingPeopleTab />
            </Box>
          </TabPanel>
          <TabPanel px={0}>
            <Box>
              <MarketingListsTab />
            </Box>
          </TabPanel>
          <TabPanel px={0}>
            <Box>
              <MarketingInboxTab />
            </Box>
          </TabPanel>
          <TabPanel px={0}>
            <Box>
              <MarketingReportsTab />
            </Box>
          </TabPanel>
          <TabPanel px={0}>
            <Box>
              <MarketingEmailTemplatesTab />
            </Box>
          </TabPanel>
          <TabPanel px={0}>
            <Box>
              <EmailSettingsTab />
            </Box>
          </TabPanel>
          <TabPanel px={0}>
            <Box>
              <MarketingSchedulesTab />
            </Box>
          </TabPanel>
          <TabPanel px={0}>
            <Box>
              <MarketingCognismProspectsTab />
            </Box>
          </TabPanel>
          <TabPanel px={0}>
            <Box>
              <MarketingLeadsTab focusAccountName={focusAccountName} />
            </Box>
          </TabPanel>
        </TabPanels>
      </Flex>
    </Tabs>
  )
}


