// OpenDoors Email Outreach System - Complete Implementation
// Based on comprehensive Reply.io architecture exploration

import { useState } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EmailIcon,
  InfoIcon,
  RepeatIcon,
  AtSignIcon,
  ViewIcon,
  ChatIcon,
  SearchIcon,
  CopyIcon,
  SettingsIcon,
  TimeIcon,
  WarningIcon,
  CalendarIcon,
} from '@chakra-ui/icons'
import { Box, Flex, HStack, Icon, IconButton, Tab, TabList, TabPanel, TabPanels, Tabs, Text, VStack, Badge } from '@chakra-ui/react'

// Import new OpenDoors components (to be created)
import SequencesTab from './components/SequencesTab'
import PeopleTab from './components/PeopleTab'
import ListsTab from './components/ListsTab'
import CampaignsTab from './components/CampaignsTab'
import EmailAccountsTab from './components/EmailAccountsTab'
import ReportsTab from './components/ReportsTab'
import TemplatesTab from './components/TemplatesTab'
import InboxTab from './components/InboxTab'
import OverviewDashboard from './components/OverviewDashboard'
import MarketingLeadsTab from '../../components/MarketingLeadsTab'
import ComplianceTab from './components/ComplianceTab'
import SchedulesTab from './components/SchedulesTab'
import CognismProspectsTab from './components/CognismProspectsTab'

export type OpenDoorsViewId =
  | 'overview'
  | 'sequences'
  | 'people'
  | 'lists'
  | 'campaigns'
  | 'email-accounts'
  | 'compliance'
  | 'reports'
  | 'templates'
  | 'inbox'
  | 'leads'
  | 'cognism-prospects'
  | 'schedules'

export type MarketingViewId = OpenDoorsViewId

function coerceViewId(view?: string): OpenDoorsViewId {
  if (
    view === 'sequences' ||
    view === 'people' ||
    view === 'lists' ||
    view === 'campaigns' ||
    view === 'email-accounts' ||
    view === 'compliance' ||
    view === 'schedules' ||
    view === 'reports' ||
    view === 'templates' ||
    view === 'inbox' ||
    view === 'leads' ||
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
  onNavigate?: (view: OpenDoorsViewId) => void
  focusAccountName?: string
}) {
  const activeView = coerceViewId(view)
  const [isPanelOpen, setIsPanelOpen] = useState(true)

  const tabIndex =
    activeView === 'overview' ? 0
    : activeView === 'sequences' ? 1
    : activeView === 'people' ? 2
    : activeView === 'leads' ? 3
    : activeView === 'cognism-prospects' ? 4
    : activeView === 'lists' ? 5
    : activeView === 'campaigns' ? 6
    : activeView === 'email-accounts' ? 7
    : activeView === 'compliance' ? 8
    : activeView === 'schedules' ? 9
    : activeView === 'reports' ? 10
    : activeView === 'templates' ? 11
    : activeView === 'inbox' ? 12
    : 0

  return (
    <Box>
      <VStack spacing={0} align="stretch">
        {/* Header */}
        <Box bg="blue.600" color="white" p={4}>
          <HStack justify="space-between">
            <VStack align="start" spacing={1}>
              <Text fontSize="2xl" fontWeight="bold">
                OpenDoors Email Outreach
              </Text>
              <Text fontSize="sm" opacity={0.9}>
                Professional email automation powered by Reply.io insights
              </Text>
            </VStack>
            <Badge colorScheme="blue" fontSize="sm" px={3} py={1}>
              BETA
            </Badge>
          </HStack>
        </Box>

        {/* Main Content */}
        <Tabs
          index={tabIndex}
          onChange={(nextIndex) => {
            const nextView: OpenDoorsViewId =
              nextIndex === 0 ? 'overview'
              : nextIndex === 1 ? 'sequences'
              : nextIndex === 2 ? 'people'
              : nextIndex === 3 ? 'leads'
              : nextIndex === 4 ? 'cognism-prospects'
              : nextIndex === 5 ? 'lists'
              : nextIndex === 6 ? 'campaigns'
              : nextIndex === 7 ? 'email-accounts'
              : nextIndex === 8 ? 'compliance'
              : nextIndex === 9 ? 'schedules'
              : nextIndex === 10 ? 'reports'
              : nextIndex === 11 ? 'templates'
              : nextIndex === 12 ? 'inbox'
              : 'overview'
            onNavigate?.(nextView)
          }}
          isLazy
          variant="unstyled"
          orientation="vertical"
          h="calc(100vh - 120px)"
        >
          <Flex direction="row" gap={{ base: 4, md: 6 }} align="flex-start" h="full">
            {isPanelOpen ? (
              <Box
                position="sticky"
                top={16}
                alignSelf="flex-start"
                bg="gray.50"
                border="1px solid"
                borderColor="gray.200"
                borderRadius="xl"
                p={4}
                boxShadow="sm"
                minW="260px"
                maxW="280px"
                w="280px"
                h="fit-content"
              >
                <Flex align="center" justify="space-between" mb={4}>
                  <Text fontSize="xs" textTransform="uppercase" color="gray.600" letterSpacing="0.08em" fontWeight="semibold">
                    Email Outreach Hub
                  </Text>
                  <IconButton
                    aria-label="Hide navigation panel"
                    icon={<ChevronLeftIcon />}
                    size="xs"
                    variant="ghost"
                    color="gray.600"
                    onClick={() => setIsPanelOpen(false)}
                  />
                </Flex>

                <TabList flexDirection="column" overflowX="visible" whiteSpace="normal" gap={2}>
                  <Tab
                    justifyContent={{ md: 'flex-start' }}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="lg"
                    color="gray.700"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{
                      bg: 'blue.50',
                      color: 'blue.700',
                      borderColor: 'blue.300',
                      transform: 'translateY(-1px)',
                      boxShadow: 'sm'
                    }}
                    _selected={{
                      bg: 'blue.500',
                      color: 'white',
                      borderColor: 'blue.500',
                      boxShadow: 'md',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.2s"
                    h={12}
                  >
                    <HStack spacing={3} w="full">
                      <Icon as={InfoIcon} boxSize={5} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">Overview</Text>
                        <Text fontSize="xs" opacity={0.8}>Dashboard & metrics</Text>
                      </VStack>
                    </HStack>
                  </Tab>

                  <Tab
                    justifyContent={{ md: 'flex-start' }}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="lg"
                    color="gray.700"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{
                      bg: 'blue.50',
                      color: 'blue.700',
                      borderColor: 'blue.300',
                      transform: 'translateY(-1px)',
                      boxShadow: 'sm'
                    }}
                    _selected={{
                      bg: 'blue.500',
                      color: 'white',
                      borderColor: 'blue.500',
                      boxShadow: 'md',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.2s"
                    h={12}
                  >
                    <HStack spacing={3} w="full">
                      <Icon as={RepeatIcon} boxSize={5} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">Sequences</Text>
                        <Text fontSize="xs" opacity={0.8}>Automated workflows</Text>
                      </VStack>
                    </HStack>
                  </Tab>

                  <Tab
                    justifyContent={{ md: 'flex-start' }}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="lg"
                    color="gray.700"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{
                      bg: 'blue.50',
                      color: 'blue.700',
                      borderColor: 'blue.300',
                      transform: 'translateY(-1px)',
                      boxShadow: 'sm'
                    }}
                    _selected={{
                      bg: 'blue.500',
                      color: 'white',
                      borderColor: 'blue.500',
                      boxShadow: 'md',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.2s"
                    h={12}
                  >
                    <HStack spacing={3} w="full">
                      <Icon as={AtSignIcon} boxSize={5} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">People</Text>
                        <Text fontSize="xs" opacity={0.8}>Contact management</Text>
                      </VStack>
                    </HStack>
                  </Tab>

                  <Tab
                    justifyContent={{ md: 'flex-start' }}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="lg"
                    color="gray.700"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{
                      bg: 'blue.50',
                      color: 'blue.700',
                      borderColor: 'blue.300',
                      transform: 'translateY(-1px)',
                      boxShadow: 'sm'
                    }}
                    _selected={{
                      bg: 'blue.500',
                      color: 'white',
                      borderColor: 'blue.500',
                      boxShadow: 'md',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.2s"
                    h={12}
                  >
                    <HStack spacing={3} w="full">
                      <Icon as={TimeIcon} boxSize={5} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">Leads</Text>
                        <Text fontSize="xs" opacity={0.8}>Google Sheets sync</Text>
                      </VStack>
                    </HStack>
                  </Tab>

                  <Tab
                    justifyContent={{ md: 'flex-start' }}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="lg"
                    color="gray.700"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{
                      bg: 'blue.50',
                      color: 'blue.700',
                      borderColor: 'blue.300',
                      transform: 'translateY(-1px)',
                      boxShadow: 'sm'
                    }}
                    _selected={{
                      bg: 'blue.500',
                      color: 'white',
                      borderColor: 'blue.500',
                      boxShadow: 'md',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.2s"
                    h={12}
                  >
                    <HStack spacing={3} w="full">
                      <Icon as={SearchIcon} boxSize={5} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">Prospects</Text>
                        <Text fontSize="xs" opacity={0.8}>Cognism import</Text>
                      </VStack>
                    </HStack>
                  </Tab>

                  <Tab
                    justifyContent={{ md: 'flex-start' }}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="lg"
                    color="gray.700"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{
                      bg: 'blue.50',
                      color: 'blue.700',
                      borderColor: 'blue.300',
                      transform: 'translateY(-1px)',
                      boxShadow: 'sm'
                    }}
                    _selected={{
                      bg: 'blue.500',
                      color: 'white',
                      borderColor: 'blue.500',
                      boxShadow: 'md',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.2s"
                    h={12}
                  >
                    <HStack spacing={3} w="full">
                      <Icon as={ViewIcon} boxSize={5} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">Lists</Text>
                        <Text fontSize="xs" opacity={0.8}>Segmentation & targeting</Text>
                      </VStack>
                    </HStack>
                  </Tab>

                  <Tab
                    justifyContent={{ md: 'flex-start' }}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="lg"
                    color="gray.700"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{
                      bg: 'blue.50',
                      color: 'blue.700',
                      borderColor: 'blue.300',
                      transform: 'translateY(-1px)',
                      boxShadow: 'sm'
                    }}
                    _selected={{
                      bg: 'blue.500',
                      color: 'white',
                      borderColor: 'blue.500',
                      boxShadow: 'md',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.2s"
                    h={12}
                  >
                    <HStack spacing={3} w="full">
                      <Icon as={EmailIcon} boxSize={5} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">Campaigns</Text>
                        <Text fontSize="xs" opacity={0.8}>One-off email sends</Text>
                      </VStack>
                    </HStack>
                  </Tab>

                  <Tab
                    justifyContent={{ md: 'flex-start' }}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="lg"
                    color="gray.700"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{
                      bg: 'blue.50',
                      color: 'blue.700',
                      borderColor: 'blue.300',
                      transform: 'translateY(-1px)',
                      boxShadow: 'sm'
                    }}
                    _selected={{
                      bg: 'blue.500',
                      color: 'white',
                      borderColor: 'blue.500',
                      boxShadow: 'md',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.2s"
                    h={12}
                  >
                    <HStack spacing={3} w="full">
                      <Icon as={SettingsIcon} boxSize={5} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">Email Accounts</Text>
                        <Text fontSize="xs" opacity={0.8}>Sending infrastructure</Text>
                      </VStack>
                    </HStack>
                  </Tab>

                  <Tab
                    justifyContent={{ md: 'flex-start' }}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="lg"
                    color="gray.700"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{
                      bg: 'blue.50',
                      color: 'blue.700',
                      borderColor: 'blue.300',
                      transform: 'translateY(-1px)',
                      boxShadow: 'sm'
                    }}
                    _selected={{
                      bg: 'blue.500',
                      color: 'white',
                      borderColor: 'blue.500',
                      boxShadow: 'md',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.2s"
                    h={12}
                  >
                    <HStack spacing={3} w="full">
                      <Icon as={WarningIcon} boxSize={5} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">Compliance</Text>
                        <Text fontSize="xs" opacity={0.8}>Suppression & safety</Text>
                      </VStack>
                    </HStack>
                  </Tab>

                  <Tab
                    justifyContent={{ md: 'flex-start' }}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="lg"
                    color="gray.700"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{
                      bg: 'blue.50',
                      color: 'blue.700',
                      borderColor: 'blue.300',
                      transform: 'translateY(-1px)',
                      boxShadow: 'sm'
                    }}
                    _selected={{
                      bg: 'blue.500',
                      color: 'white',
                      borderColor: 'blue.500',
                      boxShadow: 'md',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.2s"
                    h={12}
                  >
                    <HStack spacing={3} w="full">
                      <Icon as={CalendarIcon} boxSize={5} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">Schedules</Text>
                        <Text fontSize="xs" opacity={0.8}>Delivery windows</Text>
                      </VStack>
                    </HStack>
                  </Tab>

                  <Tab
                    justifyContent={{ md: 'flex-start' }}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="lg"
                    color="gray.700"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{
                      bg: 'blue.50',
                      color: 'blue.700',
                      borderColor: 'blue.300',
                      transform: 'translateY(-1px)',
                      boxShadow: 'sm'
                    }}
                    _selected={{
                      bg: 'blue.500',
                      color: 'white',
                      borderColor: 'blue.500',
                      boxShadow: 'md',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.2s"
                    h={12}
                  >
                    <HStack spacing={3} w="full">
                      <Icon as={SearchIcon} boxSize={5} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">Reports</Text>
                        <Text fontSize="xs" opacity={0.8}>Analytics & insights</Text>
                      </VStack>
                    </HStack>
                  </Tab>

                  <Tab
                    justifyContent={{ md: 'flex-start' }}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="lg"
                    color="gray.700"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{
                      bg: 'blue.50',
                      color: 'blue.700',
                      borderColor: 'blue.300',
                      transform: 'translateY(-1px)',
                      boxShadow: 'sm'
                    }}
                    _selected={{
                      bg: 'blue.500',
                      color: 'white',
                      borderColor: 'blue.500',
                      boxShadow: 'md',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.2s"
                    h={12}
                  >
                    <HStack spacing={3} w="full">
                      <Icon as={CopyIcon} boxSize={5} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">Templates</Text>
                        <Text fontSize="xs" opacity={0.8}>Email content library</Text>
                      </VStack>
                    </HStack>
                  </Tab>

                  <Tab
                    justifyContent={{ md: 'flex-start' }}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="lg"
                    color="gray.700"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.200"
                    _hover={{
                      bg: 'blue.50',
                      color: 'blue.700',
                      borderColor: 'blue.300',
                      transform: 'translateY(-1px)',
                      boxShadow: 'sm'
                    }}
                    _selected={{
                      bg: 'blue.500',
                      color: 'white',
                      borderColor: 'blue.500',
                      boxShadow: 'md',
                      transform: 'translateY(-1px)'
                    }}
                    transition="all 0.2s"
                    h={12}
                  >
                    <HStack spacing={3} w="full">
                      <Icon as={ChatIcon} boxSize={5} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">Inbox</Text>
                        <Text fontSize="xs" opacity={0.8}>Replies & conversations</Text>
                      </VStack>
                    </HStack>
                  </Tab>
                </TabList>
              </Box>
            ) : (
              <Box
                position="sticky"
                top={16}
                alignSelf="flex-start"
                bg="gray.50"
                border="1px solid"
                borderColor="gray.200"
                borderRadius="xl"
                p={2}
                boxShadow="sm"
              >
                <IconButton
                  aria-label="Show navigation panel"
                  icon={<ChevronRightIcon />}
                  size="sm"
                  variant="ghost"
                  color="gray.600"
                  onClick={() => setIsPanelOpen(true)}
                />
              </Box>
            )}

            <TabPanels flex="1" pt={1} overflow="auto">
              <TabPanel px={0} h="full">
                <OverviewDashboard />
              </TabPanel>
              <TabPanel px={0} h="full">
                <SequencesTab />
              </TabPanel>
              <TabPanel px={0} h="full">
                <PeopleTab />
              </TabPanel>
              <TabPanel px={0} h="full">
                <MarketingLeadsTab focusAccountName={focusAccountName} />
              </TabPanel>
              <TabPanel px={0} h="full">
                <CognismProspectsTab />
              </TabPanel>
              <TabPanel px={0} h="full">
                <ListsTab />
              </TabPanel>
              <TabPanel px={0} h="full">
                <CampaignsTab />
              </TabPanel>
              <TabPanel px={0} h="full">
                <EmailAccountsTab />
              </TabPanel>
              <TabPanel px={0} h="full">
                <ComplianceTab />
              </TabPanel>
              <TabPanel px={0} h="full">
                <SchedulesTab />
              </TabPanel>
              <TabPanel px={0} h="full">
                <ReportsTab />
              </TabPanel>
              <TabPanel px={0} h="full">
                <TemplatesTab />
              </TabPanel>
              <TabPanel px={0} h="full">
                <InboxTab />
              </TabPanel>
            </TabPanels>
          </Flex>
        </Tabs>
      </VStack>
    </Box>
  )
}


