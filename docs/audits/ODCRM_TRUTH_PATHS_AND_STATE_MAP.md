# ODCRM Truth Paths and State Map

Actual `origin/main` SHA audited: `028ba87a5efd2e6ba0997a0cc94927682b04d009`

## Global client scoping model

### Primary contract
- Agency UI:
  - mutable `currentCustomerId` in `src/platform/stores/settings.ts`
- Client UI:
  - immutable `fixedCustomerId` from `/api/me`
- Shared request path:
  - `src/utils/api.ts` injects `X-Customer-Id`
  - client mode prefers fixed customer
  - agency mode uses current customer

### Duplicate mirrors / drift points
- `ReportsTab.tsx`
- `EmailAccountsTab.tsx`
- `InboxTab.tsx`
- `LeadsTab.tsx`
- `OnboardingHomePage.tsx`
- `ComplianceTab.tsx`

### Risk caused by duplicates
- header mismatch regressions
- tab-local selector state diverging from shell/global state
- more customer-scoping bugs than the backend truth layer actually deserves

## Customer truth

### Source of truth
- `customer` row in DB plus `accountData` JSON blob
- routes in `server/src/routes/customers.ts`

### Duplicate mirrors
- local storage compatibility data in `src/components/AccountsTab.tsx`
- `src/utils/accountsLeadsSync.ts` lead-count mirror updates

### Risk
- UI can imply DB truth while still carrying storage-era behavior

## Lead truth

### Source of truth
- sheet-backed customers:
  - normalized lead records + sync state from `server/src/workers/leadsSync.ts`
  - classifier in `server/src/services/leadCanonicalMapping.ts`
  - view state in `server/src/services/leadSyncStatus.ts`
- DB-backed customers:
  - live lead rows via `/api/live/leads`

### Duplicate/derived paths
- `/api/leads`
- `/api/live/leads`
- account metrics on customer record
- local storage lead count mirrors for some UI compatibility paths

### Risk
- this is the area with the highest history of drift and customer-specific surprises

## Lead source truth

### Source of truth
- `server/src/routes/leadSources.ts`
- source sheet config and customer/global fallback rules

### Frontend state
- `src/tabs/marketing/components/LeadSourcesTabNew.tsx`
- local state for selected source, batch, page, visible columns

### Drift risk
- low relative to other areas now that the table is actually mounted in the main flow

## Suppression truth

### Source of truth
- `suppressionEntry` per customer
- `server/src/routes/suppression.ts`
- `server/src/routes/tracking.ts`
- `server/src/routes/inbox.ts`

### Duplicate mirrors
- none significant

### Risk
- low

## Template truth

### Source of truth
- `emailTemplate` table
- `server/src/routes/templates.ts`
- render semantics in `server/src/services/templateRenderer.ts`

### Duplicate mirrors
- editor local state only

### Risk
- low

## Sequence truth

### Source of truth
- `emailSequence`, `emailSequenceStep`, `enrollment`, queue rows, campaigns
- routes:
  - `server/src/routes/sequences.ts`
  - `server/src/routes/enrollments.ts`
  - `server/src/routes/sendWorker.ts`
  - `server/src/routes/schedules.ts`

### Duplicate/derived states
- `SequencesTab.tsx` stores a large amount of local operational state
- some campaign/schedule/enrollment relationships are reassembled in the UI

### Risk
- high, mostly from product complexity rather than raw backend correctness

## Send truth

### Source of truth
- queue rows + send-worker audits + worker decisions
- `server/src/workers/sendQueueWorker.ts`
- guardrails in `server/src/utils/emailIdentityLimits.ts`
- live gate in `server/src/utils/liveSendGate.ts`

### Duplicate mirrors
- reports/readiness/sequence diagnostics all derive alternate views from the same send truth

### Risk
- backend risk is moderate
- operator interpretation risk is higher

## Inbox truth

### Source of truth
- `emailMessageMetadata`, thread/message views in `server/src/routes/inbox.ts`

### Duplicate mirrors
- replies view vs threads view are separate derived presentations over inbox truth

### Risk
- likely performance and UX scaling issues

## Reporting truth

### Source of truth
- `server/src/routes/reports.ts`
- send-worker audit/report routes

### Duplicate mirrors
- `ReportsTab.tsx` combines business and operational slices in one screen
- `ReadinessTab.tsx` also consumes send-worker report-style outputs

### Risk
- reporting semantics are not yet crisp enough for operator/business separation

## localStorage / compatibility residue still present

### Proven examples
- `src/components/AccountsTab.tsx`
- `src/utils/accountsLeadsSync.ts`
- storage keys in `src/platform/keys`

### Why it matters
- the backend is now the truth for customers and lead counts
- compatibility writes increase confusion and regression risk

## Single-source-of-truth priorities

### Next to consolidate
1. Lead truth across sync, reads, metrics, and account overlays
2. Frontend customer scoping contract
3. Accounts storage compatibility mirrors
4. Send diagnostics vs operator readiness/reporting surfaces
