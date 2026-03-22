# Onboarding + Progress Tracker Integration Audit

## Branch / baseline

- **Branch:** `codex/integrate-progress-tracker-into-onboarding`
- **Start SHA (origin/main):** `ff8d545da0f3d562bb9ff4d29d54c3da8ce7feb4`

## Current-state audit (before implementation)

- **Onboarding:** `CustomerOnboardingTab` held account/profile/agreement/leads URL/email embeds; saves via `PUT /api/customers/:id` with optimistic concurrency.
- **Progress Tracker:** `ProgressTrackerTab` was a separate sub-tab with Sales/Ops/AM checklists; `PUT /api/customers/:id/progress-tracker` for manual ticks; `progressAutoTick.ts` applied auto-ticks on full customer save and suppression import.
- **Persistence:** `accountData.progressTracker` (booleans per group/key) and additive `accountData.progressTrackerMeta` (per-item `completedAt`, `completionSource`, `completedByUserId`, optional `value`, optional `acknowledgements` for campaigns).

## Chosen persistence model

- **No destructive migrations.** All checklist state remains JSON on `Customer.accountData`.
- **Manual confirmations:** continue via `PUT /api/customers/:id/progress-tracker` with optional **`valuePayload`** (merged into `progressTrackerMeta[group][itemKey].value`).
- **Multi-user “Campaigns launched”:** repeated `PUT` with `checked: true` appends to `progressTrackerMeta.am.am_campaigns_launched.acknowledgements`.
- **Start date attribution:** additive fields on `accountData.accountDetails`: `startDateAgreedSetAt`, `startDateAgreedSetBy` (stamped on first save when `startDateAgreed` becomes non-empty).

## Checklist mapping (truth sources)

| Item key | Type | Source of truth | Completion metadata |
|----------|------|-----------------|------------------------|
| sales_client_agreement | Auto | Customer agreement blob / legacy URL (`hasAgreement`) | progressTrackerMeta (AUTO) |
| sales_additional_services | Manual | User checkbox | completedBy / completedAt |
| sales_expectations_documented | Manual | User checkbox | completedBy / completedAt |
| sales_validate_ops | Manual | User checkbox | completedBy / completedAt |
| sales_contract_signed | Auto | Same as agreement (no separate “signed” signal in DB) | progressTrackerMeta (AUTO) |
| sales_start_date | Auto | `accountDetails.startDateAgreed` (or legacy start date fields) | Meta + **Recorded** line uses `startDateAgreedSetAt` / `startDateAgreedSetBy` when present |
| sales_assign_am | Auto | `accountDetails.assignedAccountManagerId` | progressTrackerMeta (AUTO) |
| sales_first_payment | Auto | Attachment `type` in `accountData.attachments`: `sales_first_payment`, `payment_confirmation`, or `first_payment` | progressTrackerMeta (AUTO) |
| sales_handover | Manual | User checkbox | completedBy / completedAt |
| sales_team_signoff | Manual | User checkbox | completedBy / completedAt |
| sales_finance_signoff | Manual | User checkbox | completedBy / completedAt |
| sales_ops_signon | Manual | User checkbox | completedBy / completedAt |
| ops_details_reviewed | Manual | User checkbox | completedBy / completedAt |
| ops_added_crm | Auto | `accountDetails.clientCreatedOnCrm` or `clientCreatedOnCrmAt` | progressTrackerMeta (AUTO) |
| ops_brief_am | Manual | User checkbox | completedBy / completedAt |
| ops_prepare_pack | Attachment-driven | ≥1 attachment with `onboarding_pack` or `onboarding_pack:*` | progressTrackerMeta (AUTO) |
| ops_welcome_email | Manual | User checkbox | completedBy / completedAt |
| ops_schedule_meeting | Manual | User checkbox | completedBy / completedAt |
| ops_populate_ppt | Attachment-driven | `onboarding_meeting_ppt` | progressTrackerMeta (AUTO) |
| ops_receive_file | Attachment-driven | `onboarding_client_info` or `onboarding_client_info:*` | progressTrackerMeta (AUTO) |
| *(removed)* ops_create_emails | — | Removed from product (Microsoft-hosted mailboxes) | — |
| ops_emails_linked | Auto / derived | Count of active `emailIdentity` (outlook/smtp) **≥ 1** | progressTrackerMeta (AUTO); UI copy explains up to 4 more mailboxes |
| ops_create_ddi | Hybrid | DDI text from onboarding form; **manual** checkbox for “created & tested” | Manual meta for confirmation |
| ops_lead_tracker | Hybrid | Auto when `leadsReportingUrl` non-empty; else manual checkbox | Auto or manual meta |
| ops_brief_campaigns | Attachment-driven | `brief_campaigns_creator` or `ops_brief_campaigns` | progressTrackerMeta (AUTO) |
| ops_team_signoff | Manual | User checkbox | completedBy / completedAt |
| ops_am_signon | Manual | User checkbox | completedBy / completedAt |
| am_prepare_meeting … am_quality_check | Mixed | See AM auto keys below; remainder manual with optional `valuePayload` dates where listed | Meta lines |

**AM auto keys (server `applyAutoTicksToAccountData`):**

- **am_send_dnc:** `dncSuppression` attachment metadata present.
- **am_target_list:** Target geography and/or job sectors/roles in `clientProfile` (see `progressAutoTick.ts`).
- **am_qualifying_questions:** non-empty `clientProfile.qualifyingQuestions`.
- **am_weekly_target:** `Customer.weeklyLeadTarget` > 0 (passed into auto-tick on save).
- **am_campaign_template / am_templates_reviewed:** `emailTemplate.count(customerId) >= 1`.
- **am_populate_icp:** ICP rule: geography + targeting + at least one of objectives / qualifying / USPs (see `icpPopulatedFromProfile`).
- **am_client_live:** earliest `EmailEvent` with `type = sent` for customer; `firstOutreachSentAt` stored in meta `value`.

**Manual date fields (valuePayload keys):**

- `am_communication` → `nextMeetingDate`
- `am_face_to_face` → `nextF2fMeetingDate`
- `am_confirm_start` → `confirmedTelesalesStartDate`

## Files modified

- `server/src/services/progressAutoTick.ts` — expanded auto rules, meta for first outreach, manual value + campaign acknowledgements.
- `server/src/routes/customers.ts` — `applyProgressAutoTicksInTransaction`, customer PUT, progress-tracker `valuePayload`, attachment + agreement post-processing, suppression path.
- `src/tabs/onboarding/CustomerOnboardingTab.tsx` — embedded checklist, linked email count, start-date attribution fields.
- `src/tabs/onboarding/OnboardingHomePage.tsx` — single onboarding surface; Progress Tracker tab removed.
- `src/tabs/onboarding/components/OnboardingProgressSections.tsx` — new integrated checklist UI.
- `src/tabs/onboarding/progressTrackerItems.ts` — shared item definitions (ops_create_emails removed).
- `src/tabs/onboarding/utils/safeAccountDataMerge.ts` — comment update.
- `server/scripts/self-test-onboarding-contract-automation.ts` — expectations for agreement/payment auto-ticks.
- `scripts/self-test-onboarding-ui-flow-runtime.mjs` — assertions for unified onboarding home.

## Files removed

- `src/tabs/onboarding/ProgressTrackerTab.tsx`

## Schema changes

- **None (Prisma).** Additive JSON only on `accountData`.

## Proof: Progress Tracker tab removed

- `ProgressTrackerTab.tsx` deleted.
- `OnboardingHomePage` no longer imports it or exposes a `progress-tracker` sub-tab.
- Runtime self-test `scripts/self-test-onboarding-ui-flow-runtime.mjs` asserts no `ProgressTrackerTab` / standalone tab strings in `OnboardingHomePage.tsx`.

## Validation (local)

- `npm run lint` — exit 0
- `npx tsc --noEmit` (root) — exit 0
- `npm run build` — exit 0
- `cd server && npm run build` — exit 0
- `npx tsx server/scripts/self-test-onboarding-contract-automation.ts` — SELF_TEST_OK

## Known limitations / follow-ups

- Agreement row in checklist does not duplicate the full agreement download control (still in Account Details / agreement section).
- “Ops create emails” legacy boolean keys in old JSON may remain `true` but are no longer shown or counted toward UI totals.
- `linkedEmailCount` unavailable (null) treats emails step as incomplete until count resolves.

## “Completed by” identity

- **Server:** `getActorIdentity(req)` → `userId` or `email` stored as `completedByUserId` in meta (same as prior progress-tracker route).
