import { UnlockIcon } from '@chakra-ui/icons'
import { SubNavigation, type SubNavItem } from '../../design-system'
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

  const navItems: SubNavItem[] = [
    {
      id: 'user-authorization',
      label: 'User Authorization',
      icon: UnlockIcon,
      content: <UserAuthorizationTab />,
    },
  ]

  return (
    <SubNavigation
      items={navItems}
      activeId={activeView}
      onChange={(id) => onNavigate?.(id as SettingsViewId)}
      title="Settings"
    />
  )
}
