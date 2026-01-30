import { EmailIcon, ViewIcon } from '@chakra-ui/icons'
import { MdAssessment, MdDashboard } from 'react-icons/md'
import { SubNavigation, type SubNavItem } from '../../design-system'
import AccountsTabDatabase from '../../components/AccountsTabDatabase'
import ContactsTab from '../../components/ContactsTab'
import MarketingLeadsTab from '../../components/MarketingLeadsTab'
import CustomersOverviewTab from './CustomersOverviewTab'

export type CustomersViewId = 'overview' | 'accounts' | 'contacts' | 'leads-reporting'

function coerceCustomersViewId(view?: string): CustomersViewId {
  if (view === 'overview' || view === 'accounts' || view === 'contacts' || view === 'leads-reporting') return view
  return 'overview'
}

export default function CustomersHomePage({
  view,
  onNavigate,
  focusAccountName,
}: {
  view?: string
  onNavigate?: (view: CustomersViewId) => void
  focusAccountName?: string
}) {
  const activeView = coerceCustomersViewId(view)

  const navItems: SubNavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: MdDashboard,
      content: <CustomersOverviewTab />,
    },
    {
      id: 'accounts',
      label: 'Accounts',
      icon: ViewIcon,
      content: <AccountsTabDatabase focusAccountName={focusAccountName} />,
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: EmailIcon,
      content: <ContactsTab />,
    },
    {
      id: 'leads-reporting',
      label: 'Leads',
      icon: MdAssessment,
      content: <MarketingLeadsTab focusAccountName={focusAccountName} />,
    },
  ]

  return (
    <SubNavigation
      items={navItems}
      activeId={activeView}
      onChange={(id) => onNavigate?.(id as CustomersViewId)}
      title="Customers"
    />
  )
}


