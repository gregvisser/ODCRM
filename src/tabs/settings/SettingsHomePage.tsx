import { useMemo } from 'react'
import { UnlockIcon } from '@chakra-ui/icons'
import { SubNavigation, type SubNavItem } from '../../design-system'
import { useUserPreferencesContext } from '../../contexts/UserPreferencesContext'
import UserAuthorizationTab from '../../components/UserAuthorizationTab'

export type SettingsViewId = 'user-authorization'

function coerceSettingsViewId(view?: string): SettingsViewId {
  if (view === 'user-authorization') return view
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

  const defaultNavItems: SubNavItem[] = [
    {
      id: 'user-authorization',
      label: 'User Authorization',
      icon: UnlockIcon,
      content: <UserAuthorizationTab />,
    },
  ]

  // Apply saved tab order from database (per-user)
  const navItems = useMemo(() => {
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
  }, [getTabOrder, defaultNavItems])

  // Save navigation order when it changes (to database, per-user)
  const handleNavReorder = async (reorderedItems: SubNavItem[]) => {
    const tabIds = reorderedItems.map(item => item.id)
    await saveTabOrder(SETTINGS_SECTION_KEY, tabIds)
  }

  return (
    <SubNavigation
      items={navItems}
      activeId={activeView}
      onChange={(id) => onNavigate?.(id as SettingsViewId)}
      onReorder={handleNavReorder}
      title="Settings"
      enableDragDrop={true}
    />
  )
}
