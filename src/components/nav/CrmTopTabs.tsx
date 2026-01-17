import { Box, Button, Text, VStack } from '@chakra-ui/react'
import { 
  AtSignIcon,
  ChatIcon,
  EmailIcon,
  SettingsIcon,
  AddIcon,
} from '@chakra-ui/icons'
import { CRM_TOP_TABS, type CrmTopTabId } from '../../contracts/nav'
import type { ComponentType } from 'react'

// Icon mapping for each tab
const getTabIcon = (tabId: CrmTopTabId): ComponentType<any> => {
  const iconMap: Record<CrmTopTabId, ComponentType<any>> = {
    'customers-home': AtSignIcon,
    'sales-home': ChatIcon,
    'marketing-home': EmailIcon,
    'operations-home': SettingsIcon,
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
  return (
    <VStack align="stretch" spacing={2} w="100%">
      {CRM_TOP_TABS.map((tab) => {
        const isActive = activeTab === tab.id
        const IconComponent = getTabIcon(tab.id)
        return (
          <Button
            key={tab.id}
            size="md"
            onClick={() => onTabClick(tab.id)}
            justifyContent="flex-start"
            px={4}
            py={3}
            borderRadius="lg"
            position="relative"
            bg={isActive ? 'bg.subtle' : 'transparent'}
            color={isActive ? 'text.primary' : 'text.muted'}
            border="1px solid"
            borderColor={isActive ? 'border.subtle' : 'transparent'}
            _hover={{
              bg: 'bg.subtle',
              color: 'text.primary',
              borderColor: 'border.subtle',
            }}
            leftIcon={<IconComponent boxSize="18px" />}
          >
            <Text fontSize="sm" fontWeight={isActive ? 'semibold' : 'normal'}>
              {tab.label}
            </Text>
          </Button>
        )
      })}
    </VStack>
  )
}


