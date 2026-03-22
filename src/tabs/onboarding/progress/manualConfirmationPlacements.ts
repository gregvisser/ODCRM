/**
 * Maps manual checklist keys to onboarding page sections (workflow order, not Sales/Ops/AM org chart).
 * Keys are stable DB identifiers — do not rename.
 */
export const COMMERCIAL_MANUAL_KEYS = [
  'sales_additional_services',
  'sales_expectations_documented',
  'sales_validate_ops',
  'sales_handover',
  'sales_team_signoff',
  'sales_finance_signoff',
  'sales_ops_signon',
] as const

export const OPERATIONS_COORDINATION_KEYS = [
  'ops_details_reviewed',
  'ops_brief_am',
  'ops_welcome_email',
  'ops_schedule_meeting',
  'ops_team_signoff',
  'ops_am_signon',
] as const

/** Meetings, reporting, templates handover, campaigns — ahead of final cross-team sign-offs */
export const DELIVERY_AND_GO_LIVE_KEYS = [
  'am_prepare_meeting',
  'am_introduce_team',
  'am_confirm_go_live',
  'am_check_info_received',
  'am_report_format',
  'am_communication',
  'am_face_to_face',
  'am_file_info',
  'am_strategy_meeting',
  'am_template_brief',
  'am_confirm_start',
  'am_campaigns_launched',
] as const

export const FINAL_SIGNOFF_KEYS = ['am_signoff', 'am_ops_signon', 'am_quality_check'] as const

export const COMMERCIAL_CONFIRMATION_ROWS = COMMERCIAL_MANUAL_KEYS.map((key) => ({ group: 'sales' as const, key }))

export const OPERATIONS_COORDINATION_ROWS = OPERATIONS_COORDINATION_KEYS.map((key) => ({
  group: 'ops' as const,
  key,
}))

export const DELIVERY_AND_GO_LIVE_ROWS = DELIVERY_AND_GO_LIVE_KEYS.map((key) => ({ group: 'am' as const, key }))

export const FINAL_SIGNOFF_ROWS = FINAL_SIGNOFF_KEYS.map((key) => ({ group: 'am' as const, key }))
