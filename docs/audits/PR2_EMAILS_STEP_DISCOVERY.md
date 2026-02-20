# PR2 Emails Step – Progress Tracker discovery

**Date:** 2026-02-20

## 1. Search results (file paths + notes)

| Search | Location | Notes |
|--------|----------|--------|
| "Progress Tracker" | `src/tabs/onboarding/ProgressTrackerTab.tsx`, `OnboardingHomePage.tsx`, `CustomerOnboardingTab.tsx` | Main UI: ProgressTrackerTab renders checklist; OnboardingHomePage has nav item; CustomerOnboardingTab mentions auto-tick. |
| progressTracker | `server/src/routes/customers.ts`, `server/src/services/progressAutoTick.ts`, `ProgressTrackerTab.tsx`, `safeAccountDataMerge.ts` | Stored in Customer.accountData (JSON). PUT /progress-tracker updates it; applyAutoTicksToAccountData reads accountData and returns updated progressTracker. |
| onboarding progress | `server/src/routes/customers.ts` (PUT /onboarding-progress) | Separate from progressTracker: accountData.onboardingProgress with steps company, ownership, leadSource, documents, contacts, notes (no emails). |
| steps + onboarding | `customers.ts` TOTAL_STEPS = ['company','ownership','leadSource','documents','contacts','notes'] | onboardingProgress steps; progressTracker is Sales/Ops/AM checklist (different structure). |
| "Emails" as step label | `ProgressTrackerTab.tsx` OPS_TEAM_ITEMS | Only existing: `ops_create_emails` = "Create/Set Up Emails for Outreach with Agreed Auto Signatures" (manual). No dedicated "Emails (5 linked)" step yet. |
| isComplete / completed / checked | `ProgressTrackerTab.tsx` (isGroupComplete, checkboxes), `progressAutoTick.ts` (markComplete), `customers.ts` (percentComplete, isComplete) | Progress Tracker: checklist booleans in progressTracker.sales/ops/am. Onboarding progress: steps with complete flag. |

## 2. DB model(s)

- **Customer** (Prisma): `accountData Json?` – holds `progressTracker: { sales: Record<string, boolean>, ops: Record<string, boolean>, am: Record<string, boolean> }` and optionally `progressTrackerMeta`. No separate table; no migration for progressTracker.
- **EmailIdentity** (Prisma): `customerId`, `isActive`, etc. – used to count “linked” accounts (same as Marketing list).

## 3. API endpoint(s)

- **GET /api/customers/:id** – Used by ProgressTrackerTab to load customer and `accountData.progressTracker`. Single customer fetch; no `linkedEmailCount` on response yet.
- **PUT /api/customers/:id/progress-tracker** – Body `{ group, itemKey, checked }`. Updates only progressTracker (row lock, merge). Used when user toggles a checkbox.

## 4. Frontend components

- **ProgressTrackerTab.tsx** – Loads customer via GET /api/customers/:id; sets salesChecklist, opsChecklist, amChecklist from `data.accountData.progressTracker`; renders Sales/Ops/AM tabs with checkboxes; save via PUT progress-tracker. Uses `useCustomersFromDatabase()` for customer dropdown list.
- **OnboardingHomePage.tsx** – Renders Progress Tracker view (ProgressTrackerTab).
- **CustomerOnboardingTab.tsx** – Embeds EmailAccountsEnhancedTab (same linked accounts as Marketing); mentions Progress Tracker auto-tick in copy.

## 5. Summary for PR2

- **Emails step:** Add a step “Emails (5 linked)” derived from **linkedEmailCount** (DB: count of EmailIdentity for customer where `isActive === true`, same as Marketing list). Inactive identities do not count.
- **Source of truth:** Add `linkedEmailCount` to GET /api/customers/:id response (Option A). Progress Tracker shows Emails step complete when `linkedEmailCount >= 5` (computed on read; no new progressTracker key required).
- **Revalidation:** After connect/disconnect, emit `customerUpdated` (or refetch customer) so Progress Tracker and any customer summary refetch and the Emails step updates without full page refresh.
