import { CRM_TOP_TABS } from '../contracts/nav'
import type { CrmTopTabId } from '../contracts/nav'
import { isClientUI } from '../platform/mode'

export function getVisibleCrmTopTabs() {
  return isClientUI()
    ? CRM_TOP_TABS.filter((t) => t.id !== 'customers-home')
    : CRM_TOP_TABS
}

function getClientFallbackTab(): CrmTopTabId {
  const firstVisible = getVisibleCrmTopTabs()[0]
  return firstVisible?.id ?? 'marketing-home'
}

export function resolveClientModeTab(tab: CrmTopTabId): CrmTopTabId {
  if (isClientUI() && tab === 'customers-home') return getClientFallbackTab()
  return tab
}
