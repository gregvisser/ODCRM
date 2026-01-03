// Centralized localStorage keys used by ODCRM.
// Keep these stable — many components rely on them and snapshots export/import them.

export const ODCRM_STORAGE_PREFIX = 'odcrm_' as const
export const SIDEBAR_STORAGE_PREFIX = 'sidebar-' as const

export const OdcrmStorageKeys = {
  accounts: 'odcrm_accounts',
  accountsLastUpdated: 'odcrm_accounts_last_updated',
  aboutSections: 'odcrm_about_sections',
  sectors: 'odcrm_sectors',
  targetLocations: 'odcrm_target_locations',
  emailTemplates: 'odcrm_email_templates',
  contacts: 'odcrm_contacts',
  deletedAccounts: 'odcrm_deleted_accounts',
  leads: 'odcrm_leads',
  leadsLastRefresh: 'odcrm_leads_last_refresh',
  marketingLeads: 'odcrm_marketing_leads',
  marketingLeadsLastRefresh: 'odcrm_marketing_leads_last_refresh',
  cognismProspects: 'odcrm_cognism_prospects',
  headerImageDataUrl: 'odcrm_header_image_data_url',
  uxToolsEnabled: 'odcrm_ux_tools_enabled',
} as const


