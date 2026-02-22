/**
 * MarketingHomePage - OpenDoors Email Outreach System
 * Complete implementation based on Reply.io architecture exploration
 */

import React, { useMemo } from 'react'
import {
  RepeatIcon,
  ViewIcon,
  ChatIcon,
  SearchIcon,
  CopyIcon,
  SettingsIcon,
  WarningIcon,
  CalendarIcon,
} from '@chakra-ui/icons'
import { SubNavigation, type SubNavItem } from '../../design-system'
import { useUserPreferencesContext } from '../../contexts/UserPreferencesContext'
import SequencesTab from './components/SequencesTab'
import LeadSourcesTabNew from './components/LeadSourcesTabNew'
import EmailAccountsTab from './components/EmailAccountsTab'
import TemplatesTab from './components/TemplatesTab'
import ReportsTab from './components/ReportsTab'
import InboxTab from './components/InboxTab'
import ComplianceTab from './components/ComplianceTab'
import SchedulesTab from './components/SchedulesTab'

// 'overview' and 'people' removed from the UI (2026-02-22).
// Kept in the type union for backward compatibility so that deep-link URLs like
// ?view=overview or ?view=people are safely coerced to 'email-accounts' below.
export type OpenDoorsViewId =
  | 'overview'
  | 'sequences'
  | 'people'
  | 'lists'
  | 'email-accounts'
  | 'templates'
  | 'compliance'
  | 'reports'
  | 'inbox'
  | 'schedules'

export type MarketingViewId = OpenDoorsViewId

function coerceViewId(view?: string): OpenDoorsViewId {
  // Legacy deep-link fallback: 'overview' and 'people' no longer have UI tabs.
  // Redirect to 'email-accounts' so old bookmarks / URLs land on a real tab.
  if (view === 'overview' || view === 'people') return 'email-accounts'
  if (
    view === 'sequences' ||
    view === 'lists' ||
    view === 'email-accounts' ||
    view === 'templates' ||
    view === 'compliance' ||
    view === 'schedules' ||
    view === 'reports' ||
    view === 'inbox'
  )
    return view
  // Default for unknown / missing views
  return 'email-accounts'
}

const MARKETING_SECTION_KEY = 'marketing'

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
  const { getTabOrder, saveTabOrder, loading: prefsLoading } = useUserPreferencesContext()

  // Default navigation items — Overview and People tabs removed (2026-02-22).
  // Old ?view=overview and ?view=people URLs are handled by coerceViewId above.
  const defaultNavItems: SubNavItem[] = [
    {
      id: 'reports',
      label: 'Reports',
      icon: SearchIcon,
      content: <ReportsTab />,
      sortOrder: 0,
    },
    {
      id: 'lists',
      label: 'Lead Sources',
      icon: ViewIcon,
      content: <LeadSourcesTabNew onNavigateToSequences={onNavigate ? () => onNavigate('sequences') : undefined} />,
      sortOrder: 1,
    },
    {
      id: 'compliance',
      label: 'Suppression List',
      icon: WarningIcon,
      content: <ComplianceTab />,
      sortOrder: 2,
    },
    {
      id: 'email-accounts',
      label: 'Email Accounts',
      icon: SettingsIcon,
      content: <EmailAccountsTab />,
      sortOrder: 3,
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: CopyIcon,
      content: <TemplatesTab />,
      sortOrder: 4,
    },
    {
      id: 'sequences',
      label: 'Sequences',
      icon: RepeatIcon,
      content: <SequencesTab />,
      sortOrder: 5,
    },
    {
      id: 'schedules',
      label: 'Schedules',
      icon: CalendarIcon,
      content: <SchedulesTab />,
      sortOrder: 6,
    },
    {
      id: 'inbox',
      label: 'Inbox',
      icon: ChatIcon,
      content: <InboxTab />,
      sortOrder: 7,
    },
  ]

  // Apply saved tab order from database (per-user)
  const navItems = useMemo(() => {
    const savedOrder = getTabOrder(MARKETING_SECTION_KEY)
    if (!savedOrder || savedOrder.length === 0) {
      return defaultNavItems
    }

    // Reorder items based on saved preference
    const orderedItems: SubNavItem[] = []
    const itemsById = new Map(defaultNavItems.map(item => [item.id, item]))

    // Add items in saved order
    for (const id of savedOrder) {
      const item = itemsById.get(id)
      if (item) {
        orderedItems.push(item)
        itemsById.delete(id)
      }
    }

    // Add any new items that weren't in saved order (at the end)
    orderedItems.push(...Array.from(itemsById.values()))

    return orderedItems
  }, [getTabOrder, defaultNavItems])

  // Save navigation order when it changes (to database, per-user)
  const handleNavReorder = async (reorderedItems: SubNavItem[]) => {
    const tabIds = reorderedItems.map(item => item.id)
    await saveTabOrder(MARKETING_SECTION_KEY, tabIds)
  }

  return (
    <SubNavigation
      items={navItems}
      activeId={activeView}
      onChange={(id) => onNavigate?.(id as OpenDoorsViewId)}
      onReorder={handleNavReorder}
      title="Marketing"
      enableDragDrop={true}
    />
  )
}


