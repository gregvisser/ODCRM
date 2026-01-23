export type CrmTopTab = {
  id:
    | 'dashboards-home'
    | 'customers-home'
    | 'marketing-home'
    | 'onboarding-home'
  label: string
  ownerAgent: string
  /**
   * Optional future-facing URL concept (app is currently state-driven, not router-driven).
   * Keep stable once we adopt URL syncing.
   */
  path?: string
}

export const CRM_TOP_TABS: readonly CrmTopTab[] = [
  { id: 'dashboards-home', label: 'Dashboards', ownerAgent: 'UI Agent', path: '/dashboards' },
  { id: 'customers-home', label: 'OpenDoors Customers', ownerAgent: 'Customers Agent', path: '/customers' },
  { id: 'marketing-home', label: 'OpenDoors Marketing', ownerAgent: 'Marketing Agent', path: '/marketing' },
  { id: 'onboarding-home', label: 'Onboarding', ownerAgent: 'Onboarding Agent', path: '/onboarding' },
] as const

export type CrmTopTabId = (typeof CRM_TOP_TABS)[number]['id']

export type CrmCategoryId = 'customers' | 'marketing' | 'onboarding'

export const CRM_CATEGORY_HOME_TAB: Readonly<Record<CrmCategoryId, CrmTopTabId>> = {
  customers: 'customers-home',
  marketing: 'marketing-home',
  onboarding: 'onboarding-home',
} as const

export function getCrmTopTab(id: CrmTopTabId): CrmTopTab {
  const tab = CRM_TOP_TABS.find((t) => t.id === id)
  // Should be unreachable at runtime (id is type-checked), but keeps consumers simple.
  if (!tab) throw new Error(`Unknown CRM top tab id: ${id}`)
  return tab
}

export function getCrmCategoryHomeTab(categoryId: CrmCategoryId): CrmTopTab {
  return getCrmTopTab(CRM_CATEGORY_HOME_TAB[categoryId])
}

function assertUnique(values: readonly string[], label: string) {
  const seen = new Set<string>()
  for (const v of values) {
    if (seen.has(v)) throw new Error(`[nav contract] Duplicate ${label}: ${v}`)
    seen.add(v)
  }
}

// Dev/runtime guardrails (kept in the contract so drift is caught early).
assertUnique(CRM_TOP_TABS.map((t) => t.id), 'tab id')
assertUnique(
  CRM_TOP_TABS.map((t) => t.path).filter((p): p is string => typeof p === 'string'),
  'tab path',
)


