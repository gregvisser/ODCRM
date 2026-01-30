/**
 * MarketingHomePage - OpenDoors Email Outreach System
 * Complete implementation based on Reply.io architecture exploration
 */

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

  const navItems: SubNavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: InfoIcon,
      content: <OverviewDashboard />,
    },
    {
      id: 'sequences',
      label: 'Sequences',
      icon: RepeatIcon,
      content: <SequencesTab />,
    },
    {
      id: 'people',
      label: 'People',
      icon: AtSignIcon,
      content: <PeopleTab />,
    },
    {
      id: 'cognism-prospects',
      label: 'Prospects',
      icon: SearchIcon,
      content: <CognismProspectsTab />,
    },
    {
      id: 'lists',
      label: 'Lists',
      icon: ViewIcon,
      content: <ListsTab />,
    },
    {
      id: 'campaigns',
      label: 'Campaigns',
      icon: EmailIcon,
      content: <CampaignsTab />,
    },
    {
      id: 'email-accounts',
      label: 'Email Accounts',
      icon: SettingsIcon,
      content: <EmailAccountsTab />,
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: WarningIcon,
      content: <ComplianceTab />,
    },
    {
      id: 'schedules',
      label: 'Schedules',
      icon: CalendarIcon,
      content: <SchedulesTab />,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: SearchIcon,
      content: <ReportsTab />,
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: CopyIcon,
      content: <TemplatesTab />,
    },
    {
      id: 'inbox',
      label: 'Inbox',
      icon: ChatIcon,
      content: <InboxTab />,
    },
  ]

  return (
    <SubNavigation
      items={navItems}
      activeId={activeView}
      onChange={(id) => onNavigate?.(id as OpenDoorsViewId)}
      title="Marketing"
    />
  )
}


