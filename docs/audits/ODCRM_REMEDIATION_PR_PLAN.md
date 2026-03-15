# ODCRM Remediation PR Plan

Actual `origin/main` SHA audited: `028ba87a5efd2e6ba0997a0cc94927682b04d009`

## Top-level sequencing rule

Do not start with UX polish. Start with correctness, scoping, and operator-safety cleanup. The current platform is safest when backend truth is left alone and confusing frontend/state duplication is removed around it.

## PR 1

### Title
Unify lead truth across sync, `/api/leads`, `/api/live/leads`, and account/reporting consumers

### Objective
- ensure one real-lead rule and one count derivation path

### Scope
- backend-only or small full-stack if API response needs normalization

### Likely files
- `server/src/services/leadCanonicalMapping.ts`
- `server/src/workers/leadsSync.ts`
- `server/src/routes/leads.ts`
- `server/src/routes/liveLeads.ts`
- `src/utils/liveLeadsApi.ts`
- `src/utils/leadsApi.ts`

### Why first
- this is the most repeated correctness regression class

### Must not break
- existing OCS / GreenTheUK count truth
- lead sync state semantics

### Migration required
- no

### Safe as micro-PR
- yes

### Success check
- OCS and GreenTheUK counts match across Accounts, `/api/leads`, `/api/live/leads`

## PR 2

### Title
Harden lead-sheet sync runtime and freshness transitions

### Objective
- make `live`, `stale_last_good`, `connected_empty`, `sync_failed`, `misconfigured`, `never_synced` operationally trustworthy

### Likely files
- `server/src/workers/leadsSync.ts`
- `server/src/services/leadSyncStatus.ts`
- `server/src/routes/leads.ts`
- `server/src/routes/liveLeads.ts`

### Why second
- counts are useless if freshness states are unreliable

### Must not break
- lead truth from PR 1

### Safe as micro-PR
- yes

## PR 3

### Title
Standardize frontend customer scoping

### Objective
- stop repeating local selector + global selector drift patterns

### Likely files
- `src/App.tsx`
- `src/utils/api.ts`
- `src/platform/stores/settings.ts`
- customer selector consumers in Marketing, Onboarding, Leads, Reports, Inbox, Email Accounts

### Why third
- this is a real regression class and a prerequisite for calmer tab behavior

### Must not break
- fixed customer mode
- `X-Customer-Id` propagation

### Safe as micro-PR
- yes, if done one shell contract at a time

## PR 4

### Title
Remove Accounts lead-count compatibility mirrors

### Objective
- stop local storage lead-count rewrites where backend/live truth already exists

### Likely files
- `src/components/AccountsTab.tsx`
- `src/components/AccountsTabDatabase.tsx`
- `src/utils/accountsLeadsSync.ts`
- possibly `LeadsReportingTab.tsx` and `MarketingLeadsTab.tsx`

### Why fourth
- after lead truth and scoping are clean enough, this becomes safe to remove

### Must not break
- current Accounts counts
- sheet-backed warning display

### Safe as micro-PR
- yes

## PR 5

### Title
Split Sequences authoring from diagnostics

### Objective
- keep sequence creation/start flows operator-facing
- move heavy queue/audit/console tooling behind clearer secondary panels

### Likely files
- `src/tabs/marketing/components/SequencesTab.tsx`
- maybe supporting local subcomponents only

### Why fifth
- biggest product usability issue after correctness/scoping cleanup

### Must not break
- send policy
- test send
- preflight
- enrollments

### Migration required
- no

## PR 6

### Title
Readiness split: setup readiness vs runtime exceptions

### Objective
- stop treating send-worker diagnostics as the whole readiness story

### Likely files
- `src/tabs/marketing/components/ReadinessTab.tsx`
- `src/hooks/useClientReadinessState.ts`
- possibly `server/src/routes/onboardingReadiness.ts`

### Order reason
- should follow sequence/control-room cleanup

## PR 7

### Title
Reports trustworthiness cleanup

### Objective
- make reports business-facing first and explicit about degraded metrics

### Likely files
- `src/tabs/marketing/components/ReportsTab.tsx`
- `server/src/routes/reports.ts`

## PR 8

### Title
AccountsTab decomposition

### Objective
- split drawer, grid, notes, enrichment, files, and metrics concerns

### Scope
- frontend-only or small full-stack depending on seams

### Risk
- medium

## PR 9

### Title
Inbox scale and workflow cleanup

### Objective
- keep current inbox truth but reduce scale pain and improve thread handling clarity

## PR 10

### Title
Onboarding / progress tracker / readiness lifecycle consolidation

### Objective
- one coherent client activation journey

## What should not be disturbed early

- suppression truth and linked-sheet behavior
- template rendering and AI non-destructive flow
- lead sources pagination/column controls/source-scope messaging
- send safeguards in the worker path
- parity/deploy verification contract

## Micro-PR safety checklist for every remediation PR

1. Confirm `origin/main` SHA locally before branching.
2. Keep customer scoping explicit.
3. Do not touch send-policy logic unless the PR is directly about send truth.
4. Run:
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm run build`
   - `cd server && npm run build`
5. Verify parity after merge.
