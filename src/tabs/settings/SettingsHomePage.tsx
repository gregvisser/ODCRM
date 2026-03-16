import { useMemo } from 'react'
import { Box, Text } from '@chakra-ui/react'
import { UnlockIcon, ChatIcon } from '@chakra-ui/icons'
import { SubNavigation, type SubNavItem } from '../../design-system'
import { useLocale } from '../../contexts/LocaleContext'
import { useUserPreferencesContext } from '../../contexts/UserPreferencesContext'
import UserAuthorizationTab from '../../components/UserAuthorizationTab'
import TroubleshootingTab from './TroubleshootingTab'
import type { SettingsViewId } from './types'

function coerceSettingsViewId(view?: string): SettingsViewId {
  if (view === 'user-authorization') return 'user-authorization'
  if (view === 'troubleshooting') return 'troubleshooting'
  return 'user-authorization'
}

const SETTINGS_SECTION_KEY = 'settings'

export default function SettingsHomePage({
  view,
  onNavigate,
}: {
  view?: string
  onNavigate?: (view: SettingsViewId) => void
}) {
  const activeView = coerceSettingsViewId(view)
  const { getTabOrder, saveTabOrder } = useUserPreferencesContext()
  const { t } = useLocale()

  // Apply saved tab order from database (per-user)
  const navItems = useMemo(() => {
    const defaultNavItems: SubNavItem[] = [
      {
        id: 'user-authorization',
        label: t('settings.userAuthorization'),
        icon: UnlockIcon,
        content: <UserAuthorizationTab />,
      },
      {
        id: 'troubleshooting',
        label: t('settings.troubleshooting'),
        icon: ChatIcon,
        content: <TroubleshootingTab />,
      },
    ]

    const savedOrder = getTabOrder(SETTINGS_SECTION_KEY)
    if (!savedOrder || savedOrder.length === 0) {
      return defaultNavItems
    }

    // Reorder items based on saved preference
    const orderedItems: SubNavItem[] = []
    const itemsById = new Map(defaultNavItems.map(item => [item.id, item]))

    for (const id of savedOrder) {
      const item = itemsById.get(id)
      if (item) {
        orderedItems.push(item)
        itemsById.delete(id)
      }
    }

    // Add any new items not in saved order
    orderedItems.push(...Array.from(itemsById.values()))

    return orderedItems
  }, [getTabOrder, t])

  // Save navigation order when it changes (to database, per-user)
  const handleNavReorder = async (reorderedItems: SubNavItem[]) => {
    const tabIds = reorderedItems.map(item => item.id)
    await saveTabOrder(SETTINGS_SECTION_KEY, tabIds)
  }

  return (
    <Box data-testid="settings-home-panel">
      <Box
        mb={3}
        p={3}
        borderRadius="md"
        border="1px solid"
        borderColor="gray.200"
        bg="gray.50"
        data-testid="settings-admin-framing"
      >
        <Text fontSize="sm" color="gray.800" fontWeight="semibold" data-testid="settings-role-framing">
          {t('settings.adminIntro')}
        </Text>
        <Text mt={1} fontSize="sm" color="gray.700" data-testid="settings-daily-operations-guidance">
          {t('settings.dailyOpsGuidance')}
        </Text>
      </Box>
      <SubNavigation
        items={navItems}
        activeId={activeView}
        onChange={(id) => onNavigate?.(id as SettingsViewId)}
        onReorder={handleNavReorder}
        title={t('settings.title')}
        enableDragDrop={true}
      />
    </Box>
  )
}
