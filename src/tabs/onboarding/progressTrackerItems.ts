/**
 * Progress checklist definitions (keys are persisted in DB under accountData.progressTracker).
 * Do not rename keys — existing customer JSON depends on them.
 */

export const SALES_TEAM_ITEMS = [
  { key: 'sales_client_agreement', label: 'Client Agreement and Approval' },
  { key: 'sales_additional_services', label: 'Additional Services Confirmed' },
  { key: 'sales_expectations_documented', label: 'Realistic Client Expectations and Deliverables Documented (timeframes)' },
  { key: 'sales_validate_ops', label: 'Validate with Ops Team what can be delivered & when.' },
  { key: 'sales_contract_signed', label: 'Contract Signed & Filed' },
  { key: 'sales_start_date', label: 'Start Date Agreed' },
  { key: 'sales_assign_am', label: 'Assign Account Manager' },
  { key: 'sales_first_payment', label: 'First Payment Received' },
  { key: 'sales_handover', label: 'Handover to Ops Team; with additional services, contract details & timeframes.' },
  { key: 'sales_team_signoff', label: 'Sales Team Member Sign Off:' },
  { key: 'sales_finance_signoff', label: 'Finance Manager Sign Off:' },
  { key: 'sales_ops_signon', label: 'Ops Team Member Sign On:' },
] as const

/** ops_create_emails removed — client configures mailboxes in Microsoft 365. */
export const OPS_TEAM_ITEMS = [
  { key: 'ops_details_reviewed', label: 'Client Details Reviewed for Completion and Accuracy' },
  { key: 'ops_added_crm', label: 'Client Added to CRM System & Back Up Folder' },
  { key: 'ops_brief_am', label: 'Internal Onboarding Brief with AM' },
  { key: 'ops_prepare_pack', label: 'Prepare Client Onboarding Pack with Relevant Information' },
  { key: 'ops_welcome_email', label: 'Send Welcome Email and Onboarding Pack with Information Requests' },
  { key: 'ops_schedule_meeting', label: 'Agree & Schedule Onboarding Meeting with Client & Account Manager' },
  { key: 'ops_populate_ppt', label: 'Populate Onboarding Meeting PPT' },
  { key: 'ops_receive_file', label: 'Receive & File Onboarding Information Received from Client' },
  { key: 'ops_emails_linked', label: 'Emails (linked mailboxes)' },
  { key: 'ops_create_ddi', label: 'Create Client DDI & Test' },
  { key: 'ops_lead_tracker', label: 'Add Client to Lead Tracker' },
  { key: 'ops_brief_campaigns', label: 'Brief Campaigns Creator' },
  { key: 'ops_team_signoff', label: 'Ops Team Member Sign Off:' },
  { key: 'ops_am_signon', label: 'Account Manager Sign On:' },
] as const

export const AM_ITEMS = [
  { key: 'am_prepare_meeting', label: 'Prepare for Onboarding Meeting*' },
  { key: 'am_introduce_team', label: 'Introduce the Team' },
  { key: 'am_confirm_go_live', label: 'Confirm Go Live Date' },
  { key: 'am_populate_icp', label: 'Populate Ideal Customer Profile*' },
  { key: 'am_check_info_received', label: 'Check All Requested Client Info Has Been Received*. Inc DNC List' },
  { key: 'am_send_dnc', label: 'Send DNC List to Ops Team for loading to CRM' },
  { key: 'am_target_list', label: 'Desired Target Prospect List' },
  { key: 'am_qualifying_questions', label: 'Confirm What Qualifies as a Lead for Client (qualifying questions)' },
  { key: 'am_weekly_target', label: 'Confirm Weekly Lead Target' },
  { key: 'am_campaign_template', label: 'Campaign Template Discussion' },
  { key: 'am_report_format', label: 'Confirm Preferred Week Day & Format for Weekly Report' },
  { key: 'am_communication', label: 'Agree Preferred Communication Channel & Schedule Weekly/Bi Weekly Meeting' },
  { key: 'am_face_to_face', label: 'Schedule Two Month Face to Face Meeting' },
  { key: 'am_file_info', label: 'File all Information in Client Folder. Ops Team to Update CRM' },
  { key: 'am_strategy_meeting', label: 'Internal Strategy Meeting with Assigned Team' },
  { key: 'am_template_brief', label: 'Internal Template Brief with Campaigns Creator' },
  { key: 'am_confirm_start', label: 'Confirm start date of Telesales Campaigns' },
  { key: 'am_templates_reviewed', label: 'Templates Reviewed and Agreed with Client' },
  { key: 'am_client_live', label: 'Client is Live' },
  { key: 'am_campaigns_launched', label: 'Email/LinkedIn Campaigns Launched' },
  { key: 'am_signoff', label: 'Account Manager Sign Off:' },
  { key: 'am_ops_signon', label: 'Ops Team Sign On:' },
  { key: 'am_quality_check', label: 'Full Team Quality Check of Progress' },
] as const

/** Auto-ticked from server applyAutoTicksToAccountData (read-only in UI). */
export const SALES_AUTO_KEYS = new Set([
  'sales_client_agreement',
  'sales_contract_signed',
  'sales_start_date',
  'sales_assign_am',
  'sales_first_payment',
])

export const OPS_AUTO_KEYS = new Set([
  'ops_added_crm',
  'ops_emails_linked',
  'ops_prepare_pack',
  'ops_populate_ppt',
  'ops_receive_file',
  'ops_brief_campaigns',
])

export const OPS_LEAD_HYBRID_KEY = 'ops_lead_tracker'

export const AM_AUTO_KEYS = new Set([
  'am_send_dnc',
  'am_target_list',
  'am_qualifying_questions',
  'am_weekly_target',
  'am_campaign_template',
  'am_templates_reviewed',
  'am_populate_icp',
  'am_client_live',
])

export const ATTACHMENT_TYPES = {
  firstPayment: 'sales_first_payment',
  onboardingPack: 'onboarding_pack',
  onboardingPpt: 'onboarding_meeting_ppt',
  clientInfo: 'onboarding_client_info',
  briefCampaigns: 'brief_campaigns_creator',
} as const
