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
import ListsTab from './components/ListsTab'
import CampaignsTab from './components/CampaignsTab'
import EmailAccountsTab from './components/EmailAccountsTab'
import ReportsTab from './components/ReportsTab'
import TemplatesTab from './components/TemplatesTab'
import InboxTab from './components/InboxTab'
import OverviewDashboard from './components/OverviewDashboard'
import ComplianceTab from './components/ComplianceTab'
import SchedulesTab from './components/SchedulesTab'
import CognismProspectsTab from './components/CognismProspectsTab'
import MarketingLeadsTab from '../../components/MarketingLeadsTab'

export type OpenDoorsViewId =
  | 'overview'
  | 'leads'
  | 'sequences'
  | 'people'
  | 'lists'
  | 'campaigns'
  | 'email-accounts'
  | 'compliance'
  | 'reports'
  | 'templates'
  | 'inbox'
  | 'cognism-prospects'
  | 'schedules'

export type MarketingViewId = OpenDoorsViewId

function coerceViewId(view?: string): OpenDoorsViewId {
  if (
    view === 'leads' ||
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
    view === 'cognism-prospects'
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
      id: 'leads',
      label: 'Marketing Leads',
      icon: EmailIcon,
      content: <MarketingLeadsTab focusAccountName={focusAccountName} />,
      sortOrder: 1,
    },
    {
      id: 'sequences',
      label: 'Sequences',
      icon: RepeatIcon,
      content: <SequencesTab />,
      sortOrder: 2,
    },
    {
      id: 'people',
      label: 'People',
      icon: AtSignIcon,
      content: <PeopleTab />,
      sortOrder: 3,
    },
    {
      id: 'cognism-prospects',
      label: 'Prospects',
      icon: SearchIcon,
      content: <CognismProspectsTab />,
      sortOrder: 4,
    },
    {
      id: 'lists',
      label: 'Lists',
      icon: ViewIcon,
      content: <ListsTab />,
      sortOrder: 5,
    },
    {
      id: 'campaigns',
      label: 'Campaigns',
      icon: EmailIcon,
      content: <CampaignsTab />,
      sortOrder: 6,
    },
    {
      id: 'email-accounts',
      label: 'Email Accounts',
      icon: SettingsIcon,
      content: <EmailAccountsTab />,
      sortOrder: 7,
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: WarningIcon,
      content: <ComplianceTab />,
      sortOrder: 8,
    },
    {
      id: 'schedules',
      label: 'Schedules',
      icon: CalendarIcon,
      content: <SchedulesTab />,
      sortOrder: 9,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: SearchIcon,
      content: <ReportsTab />,
      sortOrder: 10,
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: CopyIcon,
      content: <TemplatesTab />,
      sortOrder: 11,
    },
    {
      id: 'inbox',
      label: 'Inbox',
      icon: ChatIcon,
      content: <InboxTab />,
      sortOrder: 12,
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


