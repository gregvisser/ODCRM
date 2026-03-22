/**
 * Checklist keys rendered inline next to their driving controls elsewhere in onboarding.
 * The remainder list (confirmations, sign-offs, loose manual steps) appears in one compact section.
 */
export const EMBEDDED_INLINE_PROGRESS_KEYS = new Set<string>([
  // Sales — next to account / commercial controls
  'sales_start_date',
  'sales_assign_am',
  'sales_client_agreement',
  'sales_contract_signed',
  'sales_first_payment',
  // Ops — next to CRM, leads, email, DDI, ops document uploads
  'ops_added_crm',
  'ops_lead_tracker',
  'ops_emails_linked',
  'ops_prepare_pack',
  'ops_populate_ppt',
  'ops_receive_file',
  'ops_brief_campaigns',
  'ops_create_ddi',
  // AM — next to suppression control
  'am_send_dnc',
  // AM auto — targeting & readiness strip in client profile
  'am_target_list',
  'am_qualifying_questions',
  'am_weekly_target',
  'am_campaign_template',
  'am_templates_reviewed',
  'am_populate_icp',
  'am_client_live',
])
