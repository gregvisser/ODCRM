# ODCRM Tab-By-Tab Remediation

Date: 2026-03-14
Planning base SHA: `1c268db4fc9940bd8daff13a917e1225271db74b`

## Accounts

Purpose:
- Core client/account workspace and account details drawer.

Backend truth paths:
- `server/src/routes/customers.ts`

Current behavior as a real operator screen:
- Yes, but with too much compatibility baggage.

What is good:
- Real DB-backed save path.
- DEFCON save path now uses the truthful customer patch route.
- Account detail card is materially cleaner than before.

What is weak / confusing:
- [AccountsTab.tsx](/C:/CodeProjects/Clients/Opensdoors/ODCRM/src/components/AccountsTab.tsx) still carries local-storage-era logic, compatibility helpers, local mirrors, and too many responsibilities.

What must be fixed:
- Retire local count compatibility behavior where backend truth already exists.
- Split the giant component around truth boundaries.

Severity:
- High

Recommended PR slice:
- PR 4 for count-mirror cleanup
- PR 8 later for component decomposition

Blocked by:
- Better client-scoping contract helps, but count cleanup can start earlier.

## Contacts

Purpose:
- Customer-scoped contact CRUD.

Backend truth paths:
- `server/src/routes/contacts.ts`
- customer contact routes in `server/src/routes/customers.ts`

Current behavior as a real operator screen:
- Acceptable.

What is good:
- Straightforward CRUD.
- Tenant-safe enough.

What is weak / confusing:
- It is less integrated than the rest of the outreach product and reads more like a supporting CRUD surface.

What must be fixed:
- Not urgent. Improve CRM/outreach linkage later.

Severity:
- Medium

Recommended PR slice:
- Later P2 product integration pass.

Blocked by:
- None.

## Leads

Purpose:
- Paginated live leads workspace for a selected client.

Backend truth paths:
- `server/src/routes/liveLeads.ts`
- `server/src/workers/leadsSync.ts`

Current behavior as a real operator screen:
- Yes, mostly.

What is good:
- Real server-side pagination.
- Better operator empty/error handling than earlier.

What is weak / confusing:
- It still sits beside other lead views with overlapping purpose.

What must be fixed:
- Unify the lead truth contract behind it before more product polish.

Severity:
- High because of truth-path dependency, not because the UI is broken.

Recommended PR slice:
- PR 1 and PR 2

Blocked by:
- Lead truth unification.

## Leads Reporting

Purpose:
- Lead metrics and reporting table for client leads.

Backend truth paths:
- `server/src/routes/liveLeads.ts`

Current behavior as a real operator screen:
- Acceptable but overlapping.

What is good:
- Scalable enough now.

What is weak / confusing:
- It overlaps conceptually with Leads and MarketingLeadsTab.

What must be fixed:
- Clarify product role after lead truth is unified.

Severity:
- Medium

Recommended PR slice:
- After PR 1/2, likely grouped with reporting clarity work.

Blocked by:
- Lead truth unification.

## Marketing Leads

Purpose:
- Heavy operator surface for filtered live-leads work.

Backend truth paths:
- `server/src/routes/liveLeads.ts`

Current behavior as a real operator screen:
- Yes.

What is good:
- Server-side filtering/pagination/export is real.

What is weak / confusing:
- It depends on the same lead truth risks as the other lead surfaces.

What must be fixed:
- Keep the query contract stable; improve only after lead truth is safer.

Severity:
- Medium

Recommended PR slice:
- No immediate UI change. Protected by PR 1/2.

Blocked by:
- Lead truth unification.

## Onboarding

Purpose:
- Client setup and progress tracking.

Backend truth paths:
- `server/src/routes/customers.ts`

Current behavior as a real operator screen:
- Yes, but overlaps with Readiness.

What is good:
- DB-backed.
- Selector and handoff paths exist.

What is weak / confusing:
- It overlaps with readiness and activation concepts.

What must be fixed:
- Align onboarding and readiness into one cleaner operator story.

Severity:
- Medium

Recommended PR slice:
- PR 6 or PR 13 class work

Blocked by:
- None, but benefits from client-scoping cleanup.

## Readiness

Purpose:
- Show what needs attention before or during outreach ops.

Backend truth paths:
- send-worker diagnostics
- client readiness interpretation

Current behavior as a real operator screen:
- Useful, but too diagnostic.

What is good:
- Real next-action guidance.
- Connected to real backend signals.

What is weak / confusing:
- Reads like an operations cockpit more than a clean go-live surface.

What must be fixed:
- Separate operator-grade readiness from deeper diagnostics.

Severity:
- Medium

Recommended PR slice:
- PR 6

Blocked by:
- None.

## Reports

Purpose:
- Outreach performance reporting.

Backend truth paths:
- `server/src/routes/reports.ts`
- send-worker read models used in the tab

Current behavior as a real operator screen:
- Partly.

What is good:
- Client selector is now correct.
- Uses real tenant-scoped aggregates.

What is weak / confusing:
- Still too diagnostic.
- Some degraded backend paths can reduce metrics truthfulness.

What must be fixed:
- Make degraded states explicit and separate route-level diagnostics from operator KPIs.

Severity:
- High for trust, medium for immediate breakage.

Recommended PR slice:
- PR 7

Blocked by:
- Benefits from lead truth cleanup, but can start after PR 1/2.

## Lead Sources

Purpose:
- Configure and inspect Google Sheet lead sources.

Backend truth paths:
- `server/src/routes/leadSources.ts`
- `server/src/workers/leadsSync.ts`

Current behavior as a real operator screen:
- Yes.

What is good:
- Cards, batches, contacts, pagination, columns, source-scope visibility.

What is weak / confusing:
- Shared/global fallback and sync health still need clearer operator messaging.

What must be fixed:
- Improve messaging, not structure.

Severity:
- Low

Recommended PR slice:
- PR 12

Blocked by:
- None.

## Compliance / Suppression

Purpose:
- Manage client-scoped DNC truth.

Backend truth paths:
- `server/src/routes/suppression.ts`
- `server/src/routes/tracking.ts`
- `server/src/routes/inbox.ts`

Current behavior as a real operator screen:
- Yes.

What is good:
- Pagination.
- Delta-aware linked sheet sync.
- Manual and sheet-managed entries both make sense.

What is weak / confusing:
- Mostly just explanatory polish around sheet health.

What must be fixed:
- Nothing urgent.

Severity:
- Low

Recommended PR slice:
- Optional polish only.

Blocked by:
- None.

## Email Accounts

Purpose:
- Connect and manage sending identities.

Backend truth paths:
- `server/src/routes/outlook.ts`
- `server/src/routes/sendWorker.ts`
- `server/src/utils/emailIdentityLimits.ts`

Current behavior as a real operator screen:
- Mostly yes.

What is good:
- Real client scoping.
- Identity capacity diagnostics.
- Signature/test-send management.

What is weak / confusing:
- Mailbox health and reconnect states still read as diagnostics more than a clean mailbox ops product.

What must be fixed:
- Introduce a clearer mailbox-health model and better failure-state UX.

Severity:
- Medium

Recommended PR slice:
- PR 10

Blocked by:
- None.

## Templates

Purpose:
- Reusable email content management.

Backend truth paths:
- `server/src/routes/templates.ts`
- `server/src/services/templateRenderer.ts`
- `server/src/services/aiEmailService.ts`

Current behavior as a real operator screen:
- Yes.

What is good:
- Category persistence.
- Preview/render alignment.
- Clickable unsubscribe.
- Non-destructive AI flow.

What is weak / confusing:
- Not much. This area is relatively stable now.

What must be fixed:
- No urgent remediation.

Severity:
- Low

Recommended PR slice:
- Do not disturb except for future library governance/polish.

Blocked by:
- None.

## Sequences

Purpose:
- Sequence authoring plus multiple send-adjacent operations.

Backend truth paths:
- `server/src/routes/sequences.ts`
- `server/src/routes/enrollments.ts`
- `server/src/routes/sendWorker.ts`
- `server/src/routes/sendQueue.ts`
- `server/src/routes/campaigns.ts`

Current behavior as a real operator screen:
- Functionally yes, product-wise not yet.

What is good:
- Real end-to-end workflow exists.
- Backend safety is real.

What is weak / confusing:
- It is too overloaded.
- Too many admin and diagnostic concepts leak into the main operator flow.

What must be fixed:
- Separate authoring, testing/launch, and diagnostics into cleaner slices.

Severity:
- High

Recommended PR slice:
- PR 5

Blocked by:
- Safer after PR 3 and PR 4, but can be planned in parallel.

## Schedules

Purpose:
- View planned send activity and schedule stats.

Backend truth paths:
- `server/src/routes/schedules.ts`
- `server/src/routes/sendWorker.ts`

Current behavior as a real operator screen:
- Partly.

What is good:
- Real schedule data exists.

What is weak / confusing:
- It still feels partly secondary to the send-worker diagnostic model.

What must be fixed:
- Clarify operator meaning before redesigning.

Severity:
- Medium

Recommended PR slice:
- Later P2 clarity pass.

Blocked by:
- Sequence flow cleanup helps.

## Inbox

Purpose:
- Review threads, replies, and opt-outs.

Backend truth paths:
- `server/src/routes/inbox.ts`
- suppression write paths

Current behavior as a real operator screen:
- Yes, but not fully scaled.

What is good:
- Reply and opt-out actions are real and tenant-safe.

What is weak / confusing:
- Filtering/windowing will get worse with volume.

What must be fixed:
- Add better server-side message/thread scaling and filters.

Severity:
- Medium

Recommended PR slice:
- PR 9

Blocked by:
- None.

## Shared Marketing Shell / Customer Selection

Purpose:
- Hold marketing tabs and operator flow framing.

Backend truth paths:
- shared API helper
- settings store

Current behavior as a real operator screen:
- Acceptable but inconsistent.

What is good:
- Better top-level guidance than before.

What is weak / confusing:
- Different tabs still follow different scoping conventions.

What must be fixed:
- Standardize client-scope behavior across marketing surfaces.

Severity:
- High

Recommended PR slice:
- PR 3

Blocked by:
- None.
