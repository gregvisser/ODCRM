# ODCRM User Training Ground-Truth Audit

Date: 2026-03-16  
Branch: `codex/user-training-program-grounded`  
Base branch: `origin/main`  
Base SHA: `9469db8060f497a43f1bd0b8cd3a34223ce5ce1a`

## Purpose
This audit records the implementation truth used to build the ODCRM user training program. The linked training docs are based on this audit, not on presentation ideas or guessed workflows.

The training docs distinguish between:
- `Code truth`: behavior confirmed from the active frontend and backend implementation.
- `Live-prod observed truth`: behavior directly confirmed from production endpoints or the public live page.
- `Operator workflow inference`: the safest day-to-day path suggested by the UI labels, route wiring, and backend behavior.

## Branch and baseline
- Clean worktree created from `origin/main`.
- Feature branch created from that clean worktree: `codex/user-training-program-grounded`.
- Frontend prod build endpoint returned SHA `9469db8060f497a43f1bd0b8cd3a34223ce5ce1a`.
- Backend prod build endpoint returned SHA `9469db8060f497a43f1bd0b8cd3a34223ce5ce1a`.
- Public prod homepage currently shows the ODCRM sign-in screen and requires Microsoft sign-in.

## Label verification pass
This hardening pass re-checked operator-visible labels from the active code before updating the docs.

Confirmed top-level tab labels:
- `OpensDoors Clients`
- `OpensDoors Marketing`
- `Onboarding`
- `Settings`

Confirmed marketing sub-tab labels:
- `Readiness`
- `Reports`
- `Lead Sources`
- `Suppression List`
- `Email Accounts`
- `Templates`
- `Sequences`
- `Schedules`
- `Inbox`

Confirmed onboarding sub-tab labels:
- `Progress Tracker`
- `Client Onboarding`

Confirmed settings labels:
- `User Authorization`
- `Troubleshooting & Feedback`

## Repo navigation map
### Top-level tabs actually wired in the app shell
Source files:
- `src/App.tsx`
- `src/contracts/nav.ts`
- `src/utils/crmTopTabsVisibility.ts`
- `src/i18n/en.ts`

### Sub-tabs actually wired today
#### OpensDoors Clients
Source: `src/tabs/customers/CustomersHomePage.tsx`
- `Accounts`
- `Contacts`
- `Leads`

#### OpensDoors Marketing
Source: `src/tabs/marketing/MarketingHomePage.tsx`
- `Readiness`
- `Reports`
- `Lead Sources`
- `Suppression List`
- `Email Accounts`
- `Templates`
- `Sequences`
- `Schedules`
- `Inbox`

#### Onboarding
Source: `src/tabs/onboarding/OnboardingHomePage.tsx`
- `Progress Tracker`
- `Client Onboarding` (only visible after a client is selected)

#### Settings
Source: `src/tabs/settings/SettingsHomePage.tsx`
- `User Authorization`
- `Troubleshooting & Feedback`

## Major training modules identified
The operator-facing training set is built around these modules:
- `Clients`
- `Readiness`
- `Email Accounts`
- `Lead Sources`
- `Compliance and Suppression`
- `Templates`
- `Sequences`
- `Schedules`
- `Inbox`
- `Reports`
- `Onboarding`

`Settings` is documented as admin/setup-only context, not a core day-to-day operator workspace.

## Source of truth by module
### Clients
Frontend truth:
- `src/tabs/customers/CustomersHomePage.tsx`
- `src/components/AccountsTab.tsx`
- `src/components/ContactsTab.tsx`
- `src/components/LeadsTab.tsx`
Backend truth:
- `server/src/routes/customers.ts`
- `server/src/routes/contacts.ts`
- `server/src/routes/leads.ts`

### Readiness
Frontend truth:
- `src/tabs/marketing/components/ReadinessTab.tsx`
- `src/hooks/useClientReadinessState.ts`
- `src/utils/clientReadinessState.ts`
Backend truth:
- `server/src/routes/onboardingReadiness.ts`
- `server/src/routes/sendWorker.ts`

### Email Accounts
Frontend truth:
- `src/tabs/marketing/components/EmailAccountsTab.tsx`
- `src/components/EmailAccountsEnhancedTab.tsx`
Backend truth:
- `server/src/routes/outlook.ts`
- `server/src/services/outlookEmailService.ts`
- `server/src/utils/emailIdentityLimits.ts`

### Lead Sources
Frontend truth:
- `src/tabs/marketing/components/LeadSourcesTabNew.tsx`
- `src/platform/stores/leadSourceSelection.ts`
Backend truth:
- `server/src/routes/leadSources.ts`
- `server/src/services/googleSheetsService.ts`
- `server/src/services/leadSourcesBatch.ts`

### Compliance and Suppression
Frontend truth:
- `src/tabs/marketing/components/ComplianceTab.tsx`
Backend truth:
- `server/src/routes/suppression.ts`
- `server/src/routes/tracking.ts`
- `server/src/routes/inbox.ts`
- `server/src/workers/sendQueueWorker.ts`
- `server/src/workers/emailScheduler.ts`

### Templates
Frontend truth:
- `src/tabs/marketing/components/TemplatesTab.tsx`
Backend truth:
- `server/src/routes/templates.ts`
- `server/src/services/templateRenderer.ts`
- `server/src/services/aiEmailService.ts`
- send-path enforcement in `server/src/workers/sendQueueWorker.ts` and `server/src/workers/emailScheduler.ts`

### Sequences
Frontend truth:
- `src/tabs/marketing/components/SequencesTab.tsx`
Backend truth:
- `server/src/routes/sequences.ts`
- `server/src/routes/enrollments.ts`
- `server/src/routes/campaigns.ts`
- `server/src/routes/sendWorker.ts`
- `server/src/routes/sendQueue.ts`

### Schedules
Frontend truth:
- `src/tabs/marketing/components/SchedulesTab.tsx`
Backend truth:
- `server/src/routes/schedules.ts`
- `server/src/routes/sendWorker.ts`

### Inbox
Frontend truth:
- `src/tabs/marketing/components/InboxTab.tsx`
Backend truth:
- `server/src/routes/inbox.ts`
- `server/src/workers/replyDetection.ts`
- `server/src/services/outlookEmailService.ts`

### Reports
Frontend truth:
- `src/tabs/marketing/components/ReportsTab.tsx`
- `src/tabs/marketing/components/ReportingDashboard.tsx`
Backend truth:
- `server/src/routes/reporting.ts`
- legacy/parallel reporting still exists in `server/src/routes/reports.ts`

### Onboarding
Frontend truth:
- `src/tabs/onboarding/OnboardingHomePage.tsx`
- `src/tabs/onboarding/CustomerOnboardingTab.tsx`
- `src/tabs/onboarding/ProgressTrackerTab.tsx`
- `src/tabs/onboarding/components/CustomerSelector.tsx`
- `src/tabs/onboarding/components/CompleteOnboardingButton.tsx`
- `src/tabs/onboarding/components/CompleteOnboardingModal.tsx`
Backend truth:
- `server/src/routes/customers.ts`
- `server/src/services/progressAutoTick.ts`
- `server/src/routes/onboardingReadiness.ts`

## Recommended operator path vs advanced/diagnostic path
### Recommended operator path
For normal day-to-day user training, the safest path is:
1. Select the correct client.
2. Finish onboarding/setup work.
3. Connect mailboxes.
4. Confirm lead sources.
5. Confirm suppression.
6. Create and preview templates.
7. Build and test the sequence.
8. Start the live sequence.
9. Monitor schedules.
10. Work inbox replies.
11. Review reports.

### Advanced or diagnostic path
These are implemented, but are not the recommended day-one operator workflow:
- sequence troubleshooting and audit panels,
- queue workbench actions,
- preview-vs-outcome panels,
- run-history detail panels,
- admin/setup work in `Settings`,
- legacy compatibility routes or older components still present in the repo.

## Live app verification status
### Verified directly from production
- Frontend build endpoint: `https://odcrm.bidlow.co.uk/__build.json`
- Backend build endpoint: `https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/_build`
- Public homepage response: sign-in page with ODCRM branding and Microsoft sign-in requirement.

### Not directly verified through browser automation
- Authenticated in-app labels after login.
- Interactive behavior inside Marketing and Onboarding after login.
- Modal copy and sub-tab order as rendered in production.

### Reason for limitation
Browser automation tooling was not available in this session, and the production app requires sign-in. The training docs are therefore grounded primarily in repo truth, with live-prod confirmation limited to build/version parity and the public sign-in surface.

## Terminology decisions used in the training set
- Use the user-visible names from `src/contracts/nav.ts` and `src/i18n/en.ts`.
- Use `Lead Sources` in user docs, even though the internal view id is `lists`.
- Use `Suppression List` for the sub-tab name and `Compliance` for the page body because both appear in the current UI.
- Use `sequence` for the reusable definition and `Start live sequence` for the live-launch action.
- Use `test audience` for queue-backed test recipients and `live recipients` for the linked lead batch/list path.
- Use `schedule` in user docs, while clearly explaining that backend truth is campaign-backed.
- Use `client` as the operator-facing term and `customer` when describing backend truth.

## Confirmed features safe to document as implemented
- Client-scoped navigation and tenant-aware marketing routes via `X-Customer-Id`.
- Outlook mailbox linking, editing, test sending, signature editing, and daily-cap enforcement.
- Template CRUD, preview rendering, placeholder support, and AI rewrite suggestions.
- Sequence draft creation, test audience creation, dry-run/test send workflows, and live sequence launch into campaign-backed sending.
- Schedule monitoring and pause/resume controls for running/paused sequence-linked campaigns.
- Lead-source sheet connection, refresh, batch review, contact preview, and handoff into Sequences.
- Suppression list email/domain entry, sheet-based connect/replace, sync status, and suppression enforcement in send paths.
- Inbox thread/reply views, manual refresh, reply sending, and opt-out workflow.
- Reporting dashboard across summary, source, mailbox, outreach, funnel, compliance, and trend views.
- Onboarding progress tracker, unified onboarding form, embedded mailbox setup, attachments, and completion action.

## Confirmed as partial, legacy, or not for normal operator use
- `Settings` is an admin/setup area, not a daily operator workspace.
- Legacy Marketing views `overview` and `people` still exist in code only for compatibility and are not current tabs.
- Multiple legacy marketing components still exist in the repo but are not the wired implementation.
- Diagnostics and audit tooling inside `Sequences` is real, but much of it is support/operations tooling rather than the recommended operator path.
- Legacy reporting routes/components still exist alongside the current reporting dashboard.

## Gaps and ambiguities discovered
- `Templates` UI exposes `preview text`, `tags`, `favorites`, and related metadata that are not reliably persisted by the current backend model.
- `Sequences` mixes normal operator tasks with deep diagnostics, queue workbench actions, and troubleshooting routes.
- `Schedules` is a monitoring wrapper around campaign data, not a standalone scheduler builder.
- `Inbox` unread-only filtering appears risky because unread calculation depends on fields that do not appear fully selected in one backend thread query path.
- `Inbox` current `Mark as Opt-out` button creates an email suppression entry directly; the richer inbox route that would also add domain suppression is not the visible UI path currently used.
- `Email Accounts` can hide turned-off mailboxes because inactive identities are excluded from the active list response.
- `Complete Onboarding` changes client status to active, but the backend does not hard-gate that action on full checklist completion.

## User confusion risks discovered
1. `Start live sequence` and `Send test batch now` are different send paths.
2. `Schedules` looks like its own object, but it is campaign-backed backend truth.
3. `Lead Sources -> Use in sequence` does not start sending; it passes a batch selection into the sequence flow.
4. `Suppression List` and `Compliance` describe the same current module from different UI labels.
5. `Templates` appears richer than the persisted backend model for metadata.
6. `Turn off mailbox` can make a mailbox disappear from the current list rather than leaving it visible but inactive.
7. `Needs action only` in Inbox may not be fully reliable as a sole filter.
8. `Client Onboarding` does not appear until a client is selected.
9. `Settings` is visible in the top nav, but the app itself frames it as non-daily-work.

## Documentation decisions made from this audit
- Write the training docs primarily from code truth.
- Call out live verification limits explicitly rather than implying authenticated UI was observed directly.
- Prefer user-facing labels over internal ids.
- Separate recommended operator paths from advanced/diagnostic paths.
- Document known mismatches and partial behavior in a dedicated gotchas file rather than hiding them.

## Result
This audit supports a training program that is implementation-grounded, operator-readable, and explicit about limitations. The linked training docs should be treated as the current operator guide for ODCRM on the audited base SHA.
