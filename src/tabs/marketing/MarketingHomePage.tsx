/**
 * MarketingHomePage - OpenDoors Email Outreach System
 * Complete implementation based on Reply.io architecture exploration
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  EmailIcon,
  InfoIcon,
  RepeatIcon,
  AtSignIcon,
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
import PeopleTab from './components/PeopleTab'
import LeadSourcesTabNew from './components/LeadSourcesTabNew'
import EmailAccountsTab from './components/EmailAccountsTab'
import TemplatesTab from './components/TemplatesTab'
import ReportsTab from './components/ReportsTab'
import InboxTab from './components/InboxTab'
import OverviewDashboard from './components/OverviewDashboard'
import ComplianceTab from './components/ComplianceTab'
import SchedulesTab from './components/SchedulesTab'

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
  if (
    view === 'sequences' ||
    view === 'people' ||
    view === 'lists' ||
    view === 'email-accounts' ||
    view === 'templates' ||
    view === 'compliance' ||
    view === 'schedules' ||
    view === 'reports' ||
    view === 'inbox'
  )
    return view
  return 'overview'
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

  // Default navigation items
  const defaultNavItems: SubNavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: InfoIcon,
      content: <OverviewDashboard />,
      sortOrder: 0,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: SearchIcon,
      content: <ReportsTab />,
      sortOrder: 1,
    },
    {
      id: 'people',
      label: 'People',
      icon: AtSignIcon,
      content: <PeopleTab />,
      sortOrder: 2,
    },
    {
      id: 'lists',
      label: 'Lead Sources',
      icon: ViewIcon,
      content: <LeadSourcesTabNew onNavigateToSequences={onNavigate ? () => onNavigate('sequences') : undefined} />,
      sortOrder: 3,
    },
    {
      id: 'compliance',
      label: 'Suppression List',
      icon: WarningIcon,
      content: <ComplianceTab />,
      sortOrder: 4,
    },
    {
      id: 'email-accounts',
      label: 'Email Accounts',
      icon: SettingsIcon,
      content: <EmailAccountsTab />,
      sortOrder: 5,
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: CopyIcon,
      content: <TemplatesTab />,
      sortOrder: 6,
    },
    {
      id: 'sequences',
      label: 'Sequences',
      icon: RepeatIcon,
      content: <SequencesTab />,
      sortOrder: 7,
    },
    {
      id: 'schedules',
      label: 'Schedules',
      icon: CalendarIcon,
      content: <SchedulesTab />,
      sortOrder: 8,
    },
    {
      id: 'inbox',
      label: 'Inbox',
      icon: ChatIcon,
      content: <InboxTab />,
      sortOrder: 9,
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


