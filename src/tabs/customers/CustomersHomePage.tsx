import { useMemo } from 'react'
import { Box, Button, HStack, Text } from '@chakra-ui/react'
import { EmailIcon, ViewIcon } from '@chakra-ui/icons'
import { MdAssessment } from 'react-icons/md'
import { SubNavigation, type SubNavItem } from '../../design-system'
import { useUserPreferencesContext } from '../../contexts/UserPreferencesContext'
import AccountsTabDatabase from '../../components/AccountsTabDatabase'
import ContactsTab from '../../components/ContactsTab'
import MarketingLeadsTab from '../../components/MarketingLeadsTab'

export type CustomersViewId = 'accounts' | 'contacts' | 'leads-reporting'

function coerceCustomersViewId(view?: string): CustomersViewId {
  if (view === 'accounts' || view === 'contacts' || view === 'leads-reporting') return view
  return 'accounts'
}

const CUSTOMERS_SECTION_KEY = 'customers'

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
  const { getTabOrder, saveTabOrder } = useUserPreferencesContext()

  const goToMarketingReadiness = () => {
    window.dispatchEvent(new CustomEvent('navigateToMarketing', { detail: { view: 'readiness' } }))
  }

  const defaultNavItems: SubNavItem[] = [
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
      content:
        activeView === 'leads-reporting' ? (
          <MarketingLeadsTab focusAccountName={focusAccountName} enabled />
        ) : null,
    },
  ]

  // Apply saved tab order from database (per-user)
  const navItems = useMemo(() => {
    const savedOrder = getTabOrder(CUSTOMERS_SECTION_KEY)
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
    await saveTabOrder(CUSTOMERS_SECTION_KEY, tabIds)
  }

  return (
    <Box data-testid="customers-home-panel">
      <Box
        mb={3}
        p={3}
        borderRadius="md"
        border="1px solid"
        borderColor="gray.200"
        bg="gray.50"
        data-testid="customers-marketing-bridge"
      >
        <Text fontSize="sm" color="gray.800" fontWeight="semibold" data-testid="customers-role-framing">
          OpenDoors Clients is for setup and data maintenance.
        </Text>
        <Text fontSize="sm" color="gray.700" mt={1}>
          After updating accounts, contacts, or lead prerequisites, continue in Marketing Readiness to run outreach operations.
        </Text>
        <HStack mt={3}>
          <Button size="sm" colorScheme="blue" onClick={goToMarketingReadiness} data-testid="customers-go-marketing-readiness">
            Continue in Marketing Readiness
          </Button>
        </HStack>
      </Box>

      <SubNavigation
        items={navItems}
        activeId={activeView}
        onChange={(id) => onNavigate?.(id as CustomersViewId)}
        onReorder={handleNavReorder}
        title="Clients"
        enableDragDrop={true}
      />
    </Box>
  )
}


