# ODCRM Tab-By-Tab Audit

Date: 2026-03-14
Audit base SHA: `1c268db4fc9940bd8daff13a917e1225271db74b`

## Global Shell

Purpose:
- Establish top-level navigation, operator mode, and current client scope.

Truth source:
- `/api/me`
- settings store `currentCustomerId`

Frontend state model:
- `src/App.tsx`
- `src/platform/stores/settings.ts`
- `src/components/RequireActiveClient.tsx`

Backend route(s):
- `server/src/utils/tenantId.ts`
- `server/src/routes/users.ts`
- `server/src/routes/me.ts`

Worker/service dependencies:
- auth token propagation via `src/auth/AuthGate.tsx`

What works:
- Client mode vs agency mode is explicit.
- Auth path is real.

What is confusing:
- Query-state navigation plus custom events is still a lightweight router substitute.

What is missing:
- One explicit frontend customer-scope contract.

Severity:
- Medium

Suggested next action:
- Normalize active-client vs local-selector patterns.

## Accounts

Purpose:
- Main client/account workspace and account details drawer.

Truth source:
- `GET/PATCH /api/customers`

Frontend state model:
- `src/components/AccountsTab.tsx`

Backend route(s):
- `server/src/routes/customers.ts`

Worker/service dependencies:
- lead sync compatibility via `src/utils/accountsLeadsSync.ts`

What works:
- Account patch path is real.
- DEFCON now saves through the correct route.
- Account details card is cleaner than before.

What is confusing:
- Local compatibility logic and local-storage-era helpers still live in the same file as DB truth.

What is missing:
- A smaller, clearer component split.

Severity:
- High

Suggested next action:
- Remove compatibility mirrors and decompose the component.

## Contacts

Purpose:
- Customer-scoped contact management.

Truth source:
- Customer contact routes

Frontend state model:
- `src/components/ContactsTab.tsx`

Backend route(s):
- `server/src/routes/contacts.ts`
- customer contact endpoints in `server/src/routes/customers.ts`

What works:
- CRUD path is straightforward.

What is confusing:
- It is simpler than Accounts, but less deeply integrated as a full CRM model.

What is missing:
- Stronger connection to downstream outreach status and account context.

Severity:
- Medium

Suggested next action:
- Improve CRM linking, not the basic CRUD contract.

## Leads

Purpose:
- Paginated live leads review for a selected client.

Truth source:
- `/api/live/leads`
- `/api/live/leads/metrics`

Frontend state model:
- `src/components/LeadsTab.tsx`
- `src/hooks/useLiveLeadsPolling.ts`

Backend route(s):
- `server/src/routes/liveLeads.ts`

Worker/service dependencies:
- `server/src/workers/leadsSync.ts`

What works:
- Server-side pagination.
- Better operator empty states.

What is confusing:
- The product still has multiple lead surfaces, each with slightly different purpose.

What is missing:
- One simple explanation of live leads vs accounts metrics vs reporting.

Severity:
- Medium

Suggested next action:
- Unify lead truth messaging, not the pagination contract.

## Leads Reporting

Purpose:
- Lead metrics and tabular live-lead reporting.

Truth source:
- Same live leads route family.

Frontend state model:
- `src/components/LeadsReportingTab.tsx`

Backend route(s):
- `server/src/routes/liveLeads.ts`

What works:
- Server-backed pagination.

What is confusing:
- Some filters and compatibility behaviors still reflect older full-array/local state expectations.

What is missing:
- Cleaner distinction from LeadsTab and MarketingLeadsTab.

Severity:
- Medium

Suggested next action:
- Reduce overlap across lead views.

## Onboarding Home

Purpose:
- Customer setup workspace.

Truth source:
- customer onboarding routes

Frontend state model:
- `src/tabs/onboarding/OnboardingHomePage.tsx`
- `src/tabs/onboarding/CustomerOnboardingTab.tsx`
- `src/tabs/onboarding/ProgressTrackerTab.tsx`

Backend route(s):
- `server/src/routes/customers.ts`

What works:
- Client selector, autosave, and handoff to marketing/readiness.

What is confusing:
- Overlap with readiness and activation concepts.

What is missing:
- One shared progress/health vocabulary across onboarding and marketing.

Severity:
- Medium

Suggested next action:
- Align onboarding and readiness contracts.

## Marketing: Readiness

Purpose:
- Tell operators what needs attention now.

Truth source:
- send-worker diagnostics plus client readiness interpretation

Frontend state model:
- `src/tabs/marketing/components/ReadinessTab.tsx`

Backend route(s):
- `/api/send-worker/exception-center`
- `/api/send-worker/identity-capacity`
- `/api/send-worker/run-history`
- `/api/send-worker/sequence-preflight`
- `/api/send-worker/launch-preview`
- `/api/send-worker/preview-vs-outcome`

What works:
- Good next-action guidance.
- Real diagnostics.

What is confusing:
- It is more of an operations cockpit than a simple go-live/readiness product.

What is missing:
- A simpler readiness state for non-technical operators.

Severity:
- Medium

Suggested next action:
- Split operator readiness from diagnostic depth.

## Marketing: Reports

Purpose:
- Outreach performance review.

Truth source:
- `/api/reports/outreach`
- selected send-worker read endpoints

Frontend state model:
- `src/tabs/marketing/components/ReportsTab.tsx`

Backend route(s):
- `server/src/routes/reports.ts`
- `server/src/routes/sendWorker.ts`

What works:
- Client selector is present.
- Uses tenant-scoped backend truth.

What is confusing:
- The screen still mixes reporting with operator diagnostics.

What is missing:
- Cleaner business reporting and clearer data freshness/trust messaging.

Severity:
- Medium

Suggested next action:
- Refine reports into a clearer operator/business dashboard.

## Marketing: Lead Sources

Purpose:
- Configure and inspect lead-source inputs.

Truth source:
- `/api/lead-sources`
- live sheet parsing/routes

Frontend state model:
- `src/tabs/marketing/components/LeadSourcesTabNew.tsx`

Backend route(s):
- `server/src/routes/leadSources.ts`

Worker/service dependencies:
- `server/src/workers/leadsSync.ts`

What works:
- Cards, batches, contacts, pagination, columns, source-scope visibility.

What is confusing:
- Shared/global source fallback still requires product knowledge.

What is missing:
- Even clearer explanation of downstream impact into CRM/live leads.

Severity:
- Low

Suggested next action:
- Improve operator messaging around source fallback and sync health.

## Marketing: Suppression / Compliance

Purpose:
- Manage client-scoped DNC truth.

Truth source:
- `suppressionEntry`

Frontend state model:
- `src/tabs/marketing/components/ComplianceTab.tsx`

Backend route(s):
- `server/src/routes/suppression.ts`
- `server/src/routes/tracking.ts`
- `server/src/routes/inbox.ts`

What works:
- Server pagination.
- Delta-aware linked-sheet import.
- Manual vs sheet-managed behavior is coherent.

What is confusing:
- Minimal; this is one of the cleaner modules now.

What is missing:
- Better summary/explanation of sheet health over time.

Severity:
- Low

Suggested next action:
- Minor UX polish only.

## Marketing: Email Accounts

Purpose:
- Connect and manage sending identities.

Truth source:
- Outlook identity routes and send-worker identity-capacity diagnostics

Frontend state model:
- `src/tabs/marketing/components/EmailAccountsTab.tsx`

Backend route(s):
- `server/src/routes/outlook.ts`
- `server/src/routes/sendWorker.ts`

Worker/service dependencies:
- `server/src/utils/emailIdentityLimits.ts`

What works:
- Client-scoped selector.
- Identity capacity view.
- Signature and test-send flows.

What is confusing:
- Health state is still partly diagnostic rather than a single mailbox-health model.

What is missing:
- Clearer reconnect/failure-state UX.

Severity:
- Medium

Suggested next action:
- Introduce a cleaner mailbox health model.

## Marketing: Templates

Purpose:
- Reusable email content assets.

Truth source:
- `EmailTemplate`
- preview renderer

Frontend state model:
- `src/tabs/marketing/components/TemplatesTab.tsx`

Backend route(s):
- `server/src/routes/templates.ts`
- `server/src/services/templateRenderer.ts`
- `server/src/services/aiEmailService.ts`

What works:
- Category, preview, unsubscribe, signature, AI suggestion flow.

What is confusing:
- Very little now.

What is missing:
- Better governance around template libraries as the set grows.

Severity:
- Low

Suggested next action:
- Focus elsewhere first.

## Marketing: Sequences

Purpose:
- Sequence authoring plus send-adjacent operational tooling.

Truth source:
- sequence, enrollment, send queue, send-worker diagnostics

Frontend state model:
- `src/tabs/marketing/components/SequencesTab.tsx`

Backend route(s):
- `server/src/routes/sequences.ts`
- `server/src/routes/enrollments.ts`
- `server/src/routes/sendWorker.ts`
- `server/src/routes/sendQueue.ts`
- `server/src/routes/campaigns.ts`

Worker/service dependencies:
- `server/src/workers/sendQueueWorker.ts`

What works:
- End-to-end functionality is real.
- Test send and live send are safer than before.

What is confusing:
- Too many controls, panels, diagnostics, and route references in one surface.

What is missing:
- A cleaner operator mental model.

Severity:
- High

Suggested next action:
- Split authoring from operations and diagnostics.

## Marketing: Schedules

Purpose:
- Show planned send activity and supporting stats.

Truth source:
- `/api/schedules`
- sequence preflight and run-history adjunct data

Frontend state model:
- `src/tabs/marketing/components/SchedulesTab.tsx`

Backend route(s):
- `server/src/routes/schedules.ts`
- `server/src/routes/sendWorker.ts`

What works:
- Real schedule data and control actions exist.

What is confusing:
- The screen is still partly a secondary view over other send-worker truth rather than the primary driver of sending.

What is missing:
- A clearer operator explanation of how schedules relate to live send execution.

Severity:
- Medium

Suggested next action:
- Clarify the schedules mental model instead of changing backend truth.

## Marketing: Inbox

Purpose:
- Review replies/threads, reply, mark read, opt out.

Truth source:
- inbox thread/message/reply routes

Frontend state model:
- `src/tabs/marketing/components/InboxTab.tsx`

Backend route(s):
- `server/src/routes/inbox.ts`
- `server/src/routes/suppression.ts`

What works:
- Client selector.
- Reply and opt-out actions.
- Tenant-safe suppression writes.

What is confusing:
- Less confusing than Sequences, but still not a polished inbox product.

What is missing:
- More scalable filtering and thread management.

Severity:
- Medium

Suggested next action:
- Add better server-side filtering/windowing before the dataset grows further.
