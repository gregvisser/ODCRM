import { Button, HStack, Text, VStack } from '@chakra-ui/react'
import { CRM_TOP_TABS, type CrmTopTabId } from '../../contracts/nav'

export function CrmTopTabs({
  activeTab,
  onTabClick,
}: {
  activeTab: CrmTopTabId
  onTabClick: (tabId: CrmTopTabId) => void
}) {
  return (
    <VStack align="stretch" spacing={2} w="100%">
      <Text fontSize="xs" color="gray.500" fontWeight="semibold" letterSpacing="wide">
        CRM
      </Text>
      <HStack spacing={2} wrap="wrap">
        {CRM_TOP_TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <Button
              key={tab.id}
              size="sm"
              variant={isActive ? 'solid' : 'outline'}
              onClick={() => onTabClick(tab.id)}
              whiteSpace="nowrap"
            >
              {tab.label}
            </Button>
          )
        })}
      </HStack>
    </VStack>
  )
}


