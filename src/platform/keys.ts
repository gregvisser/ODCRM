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
  emailTemplatesLastUpdated: 'odcrm_email_templates_last_updated',
  contacts: 'odcrm_contacts',
  contactsLastUpdated: 'odcrm_contacts_last_updated',
  deletedContacts: 'odcrm_deleted_contacts',
  deletedAccounts: 'odcrm_deleted_accounts',
  leads: 'odcrm_leads',
  leadsLastRefresh: 'odcrm_leads_last_refresh',
  marketingLeads: 'odcrm_marketing_leads',
  marketingLeadsLastRefresh: 'odcrm_marketing_leads_last_refresh',
  accountsBackendSyncHash: 'odcrm_accounts_backend_sync_hash',
  cognismProspects: 'odcrm_cognism_prospects',
  cognismProspectsLastUpdated: 'odcrm_cognism_prospects_last_updated',
  campaignWorkflows: 'odcrm_campaign_workflows',
  campaignWorkflowsLastUpdated: 'odcrm_campaign_workflows_last_updated',
  headerImageDataUrl: 'odcrm_header_image_data_url',
  uxToolsEnabled: 'odcrm_ux_tools_enabled',

  // Keep legacy/unprefixed keys stable (already used in UI + API header injection).
  currentCustomerId: 'currentCustomerId',
  users: 'users',
  usersLastUpdated: 'odcrm_users_last_updated',
} as const


