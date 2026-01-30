import { EmailIcon, ViewIcon } from '@chakra-ui/icons'
import { MdAssessment } from 'react-icons/md'
import { SubNavigation, type SubNavItem } from '../../design-system'
import AccountsTabDatabase from '../../components/AccountsTabDatabase'
import ContactsTab from '../../components/ContactsTab'
import MarketingLeadsTab from '../../components/MarketingLeadsTab'

export type CustomersViewId = 'accounts' | 'contacts' | 'leads-reporting'

function coerceCustomersViewId(view?: string): CustomersViewId {
  if (view === 'accounts' || view === 'contacts' || view === 'leads-reporting') return view
  return 'accounts'
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


