# ODCRM Product Gaps Ranked

Actual `origin/main` SHA audited: `028ba87a5efd2e6ba0997a0cc94927682b04d009`

## Correctness Bugs

### 1. Lead truth still depends on heuristic sheet interpretation
- Severity: `high`
- Type: `correctness bug`
- Evidence:
  - `server/src/services/leadCanonicalMapping.ts`
  - `server/src/workers/leadsSync.ts`
  - `server/src/routes/leads.ts`
  - `server/src/routes/liveLeads.ts`
- Why it matters:
  - this area has already produced multiple production regressions across customers

### 2. Accounts still writes/reads compatibility mirrors alongside DB truth
- Severity: `high`
- Type: `wiring mismatch`
- Evidence:
  - `src/components/AccountsTab.tsx`
  - `src/utils/accountsLeadsSync.ts`
- Why it matters:
  - high-regression zone for counts and operator trust

### 3. Reports can silently degrade some metrics when backend query shape lags
- Severity: `medium`
- Type: `correctness bug`
- Evidence:
  - `server/src/routes/reports.ts`
- Why it matters:
  - business review can be misled by zeroed reply/opt-out numbers

## Operational Risks

### 4. Sequences is overloaded and risky to operate
- Severity: `high`
- Type: `operator UX issue`
- Evidence:
  - `src/tabs/marketing/components/SequencesTab.tsx`
- Why it matters:
  - core outreach execution lives here, but the screen is a mixed authoring/ops/diagnostics surface

### 5. Frontend client scoping is still duplicated
- Severity: `high`
- Type: `wiring mismatch`
- Evidence:
  - `src/App.tsx`
  - `src/utils/api.ts`
  - `src/tabs/marketing/components/ReportsTab.tsx`
  - `src/tabs/marketing/components/EmailAccountsTab.tsx`
  - `src/tabs/marketing/components/InboxTab.tsx`
  - `src/tabs/onboarding/OnboardingHomePage.tsx`
- Why it matters:
  - this is a known regression class and keeps reappearing as header/customer mismatches

### 6. Lead sync runtime remains operationally brittle
- Severity: `high`
- Type: `architectural debt`
- Evidence:
  - `server/src/workers/leadsSync.ts`
  - `server/src/services/leadSyncStatus.ts`
- Why it matters:
  - freshness semantics are better, but actual sync reliability still depends on fragile sheet/runtime behavior

### 7. Inbox will hit scale pain before the rest of marketing
- Severity: `medium`
- Type: `architectural debt`
- Evidence:
  - `src/tabs/marketing/components/InboxTab.tsx`
  - `server/src/routes/inbox.ts`
- Why it matters:
  - thread-centric message review is core daily operator work once adoption grows

## UX / Operator Confusion

### 8. Readiness is still more send-worker cockpit than clean readiness screen
- Severity: `medium`
- Type: `operator UX issue`
- Evidence:
  - `src/tabs/marketing/components/ReadinessTab.tsx`
  - `src/hooks/useClientReadinessState.ts`
- Why it matters:
  - setup readiness and runtime exception handling are conflated

### 9. Reports feels more like diagnostic aggregation than business reporting
- Severity: `medium`
- Type: `operator UX issue`
- Evidence:
  - `src/tabs/marketing/components/ReportsTab.tsx`
  - `server/src/routes/reports.ts`
- Why it matters:
  - reports should answer business questions first, not route-level operational ones

### 10. Onboarding, progress tracker, and readiness still overlap too much
- Severity: `medium`
- Type: `operator UX issue`
- Evidence:
  - `src/tabs/onboarding/OnboardingHomePage.tsx`
  - `src/tabs/onboarding/ProgressTrackerTab.tsx`
  - `src/utils/clientReadinessState.ts`
  - `server/src/routes/onboardingReadiness.ts`
- Why it matters:
  - operators are asked to reason across multiple lifecycle concepts that should feel like one journey

## Architectural Debt

### 11. AccountsTab is still too large to be safe
- Severity: `high`
- Type: `architectural debt`
- Evidence:
  - `src/components/AccountsTab.tsx`
- Why it matters:
  - truth-path fixes keep landing in a component with too many responsibilities

### 12. Query-param/event shell is too manual
- Severity: `medium`
- Type: `architectural debt`
- Evidence:
  - `src/App.tsx`
  - `src/tabs/marketing/MarketingHomePage.tsx`
- Why it matters:
  - navigation and scope changes are more fragile than they need to be

## Worthwhile Add-ons / Improvements

### 13. Contacts needs a richer CRM operator experience
- Severity: `low`
- Type: `missing feature`

### 14. Email Accounts needs clearer reconnect/health messaging
- Severity: `medium`
- Type: `UX/operator confusion`

### 15. Lead Sources could become more CRM-native over time
- Severity: `low`
- Type: `worthwhile add-on`

## Product Verdict

### Product-ready today
- Lead Sources
- Compliance / Suppression
- Templates

### Safe but rough
- Email Accounts
- Leads
- Marketing Leads
- Onboarding
- Schedules
- Inbox

### Workbench-heavy / redesign candidates
- Sequences
- Readiness
- Reports
- Accounts internals
