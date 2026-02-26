import { CRM_TOP_TABS } from '../contracts/nav'
import type { CrmTopTabId } from '../contracts/nav'
import { isClientUI } from '../platform/mode'

export function getVisibleCrmTopTabs() {
  return isClientUI()
    ? CRM_TOP_TABS.filter((t) => t.id !== 'customers-home')
    : CRM_TOP_TABS
}

export function resolveClientModeTab(tab: CrmTopTabId): CrmTopTabId {
  if (isClientUI() && tab === 'customers-home') return 'dashboards-home'
  return tab
}
