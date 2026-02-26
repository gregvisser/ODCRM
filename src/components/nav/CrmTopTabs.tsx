import { Box, Button, HStack, Icon, Text, VStack, useBreakpointValue } from '@chakra-ui/react'
import {
  AddIcon,
  AtSignIcon,
  ChatIcon,
  EmailIcon,
  SettingsIcon,
  ViewIcon,
} from '@chakra-ui/icons'
import { type CrmTopTabId } from '../../contracts/nav'
import { getVisibleCrmTopTabs } from '../../utils/crmTopTabsVisibility'
import type { ComponentType } from 'react'

// Icon mapping for each tab
const getTabIcon = (tabId: CrmTopTabId): ComponentType<any> => {
  const iconMap: Record<CrmTopTabId, ComponentType<any>> = {
    'dashboards-home': ViewIcon,
    'customers-home': AtSignIcon,
    'marketing-home': EmailIcon,
    'onboarding-home': AddIcon,
  }
  return iconMap[tabId] || AtSignIcon
}

export function CrmTopTabs({
  activeTab,
  onTabClick,
}: {
  activeTab: CrmTopTabId
  onTabClick: (tabId: CrmTopTabId) => void
}) {
  const showLabels = useBreakpointValue({ base: false, md: true })

  const visibleTabs = getVisibleCrmTopTabs()
  return (
    <VStack align="stretch" spacing={1} w="100%">
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.id
        const IconComponent = getTabIcon(tab.id)
        return (
          <Button
            key={tab.id}
            size="md"
            onClick={() => onTabClick(tab.id)}
            justifyContent="center"
            px={showLabels ? 3 : 0}
            py={2}
            borderRadius="md"
            position="relative"
            bg={isActive ? 'sidebar.itemActive' : 'transparent'}
            color={isActive ? 'sidebar.textActive' : 'sidebar.text'}
            border="1px solid"
            borderColor={isActive ? 'sidebar.itemActive' : 'transparent'}
            _hover={{
              bg: 'sidebar.itemHover',
              color: 'sidebar.textActive',
              borderColor: 'sidebar.itemHover',
            }}
          >
            <HStack spacing={showLabels ? 3 : 0} w="100%" justify={showLabels ? 'flex-start' : 'center'}>
              <Icon as={IconComponent} boxSize="18px" />
              {showLabels ? (
                <Text fontSize="sm" fontWeight={isActive ? 'semibold' : 'normal'}>
                  {tab.label}
                </Text>
              ) : null}
            </HStack>
          </Button>
        )
      })}
    </VStack>
  )
}


