# AUDIT_FRONTEND_FINDINGS.md — Frontend Audit
**Generated:** 2026-02-22

---

## Executive Summary

| Category | P0 | P1 | P2 |
|----------|----|----|-----|
| TDZ / Init Order | 0 (fixed) | 0 | 1 |
| Customer Scoping | 0 | 1 | 1 |
| Dead/Orphaned Code | 0 | 0 | 18+ |
| localStorage Business Data | 0 | 1 | 2 |
| Bundle / Performance | 0 | 1 | 0 |

---

## 1. TDZ / Module Init Order Audit

### Recent Fix (Reference)
The TDZ crash `Cannot access '_' before initialization` on `/marketing?tab=marketing-home&view=accounts` was resolved in commit `60f6695`.

**Root cause:** `loadIdentities` (`useCallback`) was declared AFTER a `useEffect` that listed it in its dependency array `[selectedCustomerId, loadIdentities]`. JavaScript `const` in function scope evaluates eagerly when the dependency array literal is created — hitting TDZ before the variable was initialized.

**Resolution:** Moved `const loadIdentities = useCallback(...)` before the `useEffect` that references it.

### Current TDZ Risk Scan

**Method:** Reviewed each marketing and onboarding tab component for `useCallback`/function declarations appearing after `useEffect` hooks that reference them in dependency arrays.

| File | TDZ Risk | Notes |
|------|----------|-------|
| `src/tabs/marketing/components/EmailAccountsTab.tsx` | ✅ Fixed | `loadIdentities` now declared before its `useEffect` |
| `src/tabs/marketing/components/CampaignsTab.tsx` | ✅ Clean | No dependency array ordering violations found |
| `src/tabs/marketing/components/SequencesTab.tsx` | ✅ Clean | |
| `src/tabs/marketing/components/InboxTab.tsx` | ✅ Clean | |
| `src/tabs/marketing/components/ListsTab.tsx` | ✅ Clean | |
| `src/tabs/marketing/components/TemplatesTab.tsx` | ✅ Clean | |
| `src/tabs/onboarding/CustomerOnboardingTab.tsx` | ✅ Clean | |
| `src/tabs/customers/CustomersOverviewTab.tsx` | ✅ Clean | |

### Remaining P2 Risk: Single Bundle Architecture

**File:** `vite.config.ts`  
No `manualChunks` or `build.rollupOptions.output.manualChunks` configuration.

The current build produces a single `index-*.js` chunk (~1.38MB / 400KB gzipped). This means:
- Any future TDZ or module-init error in **any** component takes down **all** tabs simultaneously
- First load parses all JS including marketing, onboarding, and admin components even if user only needs dashboard
- Memory pressure on low-end devices

**Recommendation (P2, not P0):** Add lazy loading for marketing and onboarding tabs using `React.lazy()` + `Suspense`. This also isolates any future TDZ to the affected chunk only.

---

## 2. Customer Scoping (Tenant) Audit

### How tenant scoping works in the frontend

Every API call in `src/utils/api.ts` injects:
```typescript
const customerId = getCurrentCustomerId('prod-customer-1')
headers.set('X-Customer-Id', customerId)
```

Where `getCurrentCustomerId()` reads `localStorage['currentCustomerId']`.

### P1: `currentCustomerId` depends on localStorage — fallback is wrong

**File:** `src/platform/stores/settings.ts`  
**File:** `src/utils/api.ts`

```typescript
// settings.ts
export function getCurrentCustomerId(fallback = 'prod-customer-1'): string {
  const v = getItem(OdcrmStorageKeys.currentCustomerId)
  if (v && String(v).trim()) return String(v)
  if (fallback) setItem(OdcrmStorageKeys.currentCustomerId, fallback)  // writes fallback to localStorage!
  return fallback
}
```

**Issues:**
1. If `localStorage` is cleared (user clears browser data, private mode, browser extension), every API call is sent with `X-Customer-Id: prod-customer-1` — which doesn't exist in the DB → all API calls return 404 or empty data
2. The fallback writes `prod-customer-1` **back to localStorage**, entrenching the bad value
3. The hardcoded `'prod-customer-1'` has no meaning in production

**Impact:** App silently shows empty data instead of an error. User thinks data is lost.

**Fix (minimal):** Remove the write-back behavior and remove the hardcoded fallback:
```typescript
export function getCurrentCustomerId(): string | null {
  const v = getItem(OdcrmStorageKeys.currentCustomerId)
  return (v && String(v).trim()) ? String(v).trim() : null
}
```

Update `api.ts` to handle null — if `customerId` is null, skip the header and let the backend return 400, which is a clear error state:
```typescript
const customerId = getCurrentCustomerId()
if (customerId) headers.set('X-Customer-Id', customerId)
```

### P2: Customer selection state scattered across localStorage, contexts, and prop drilling

`currentCustomerId` is read from localStorage in:
- `src/utils/api.ts` — all API calls
- `src/utils/leadsApi.ts` — leads-specific calls
- `src/components/LeadsTab.tsx` — local reads

The "correct" value is managed by the UI's customer dropdown, which calls `setCurrentCustomerId()`. But there's no React state backing this — components don't re-render on customer change unless they listen to the `settingsUpdated` event.

**Risk:** If a component reads `getCurrentCustomerId()` on mount and the user then changes the customer, the component may use a stale `customerId` for subsequent API calls.

---

## 3. Dead / Orphaned Components

The following components in `src/components/` are **not imported anywhere** in the active codebase. They are replaced by the newer `src/tabs/marketing/components/` equivalents.

| Component | Status | Replacement |
|-----------|--------|-------------|
| `MarketingSequencesTab.tsx` | DEAD | `tabs/marketing/components/SequencesTab.tsx` |
| `MarketingInboxTab.tsx` | DEAD | `tabs/marketing/components/InboxTab.tsx` |
| `MarketingListsTab.tsx` | DEAD | `tabs/marketing/components/ListsTab.tsx` |
| `MarketingEmailTemplatesTab.tsx` | DEAD | `tabs/marketing/components/TemplatesTab.tsx` |
| `MarketingReportsTab.tsx` | DEAD | `tabs/marketing/components/ReportsTab.tsx` |
| `MarketingSchedulesTab.tsx` | DEAD | `tabs/marketing/components/SchedulesTab.tsx` |
| `MarketingCognismProspectsTab.tsx` | DEAD | `tabs/marketing/components/CognismProspectsTab.tsx` |
| `MarketingPeopleTab.tsx` | DEAD | `tabs/marketing/components/PeopleTab.tsx` |
| `MarketingDashboard.tsx` | DEAD | `tabs/marketing/components/OverviewDashboard.tsx` |
| `MarketingLeadsTab.tsx` | DEAD | `tabs/marketing/components/LeadSourcesTabNew.tsx` |
| `CampaignsEnhancedTab.tsx` | DEAD | `tabs/marketing/components/CampaignsTab.tsx` |
| `CampaignSequencesTab.tsx` | DEAD | Part of sequence workflow |
| `EmailCampaignsTab.tsx` | DEAD | `tabs/marketing/components/CampaignsTab.tsx` |
| `EmailAccountsEnhancedTab.tsx` | DEAD | `tabs/marketing/components/EmailAccountsTab.tsx` |
| `EmailSettingsTab.tsx` | DEAD | Replaced by EmailAccountsTab |
| `DashboardTab.tsx` | DEAD | `tabs/dashboards/DashboardsHomePage.tsx` |
| `CustomersManagementTab.tsx` | DEAD | `tabs/customers/CustomersHomePage.tsx` |
| `ExportImportButtons.tsx` | DEAD | `components/DataPortability.tsx` (also dead) |
| `DataPortability.tsx` | DEAD | Not imported anywhere |
| `DiagnosticBanner.tsx` | DEAD | Commented out in `App.tsx` |

**Impact on bundle size:** These ~20 dead files are NOT imported, so Vite tree-shaking already excludes them from the bundle. **They do NOT contribute to bundle size.** However, they create confusion, maintenance burden, and risk of accidental re-use.

**Also found:** `src/tabs/marketing/components/LeadSourcesTab.tsx` (old) — this IS imported in `MarketingHomePage.tsx` alongside `LeadSourcesTabNew.tsx`. The "New" suffix implies the old one should be removed but hasn't been yet.

---

## 4. localStorage Business Data Audit

### `src/platform/keys.ts` — All keys defined

```typescript
export const OdcrmStorageKeys = {
  accounts: 'odcrm_accounts',           // ⚠️ Business data
  contacts: 'odcrm_contacts',           // ⚠️ Business data
  emailTemplates: 'odcrm_email_templates', // ⚠️ Business data
  leads: 'odcrm_leads',                 // ⚠️ Business data
  cognismProspects: 'odcrm_cognism_prospects', // ⚠️ Business data
  campaignWorkflows: 'odcrm_campaign_workflows', // ⚠️ Business data
  currentCustomerId: 'currentCustomerId', // ⚠️ Tenant selector
  headerImageDataUrl: 'odcrm_header_image_data_url', // ✅ UI preference
  uxToolsEnabled: 'odcrm_ux_tools_enabled', // ✅ UI preference
  // ... other keys
}
```

**Assessment:** Many business-critical data keys remain in `OdcrmStorageKeys`. However, audit of active code shows the actual data is now fetched from DB via API — these localStorage stores are mostly legacy. The risk is that old/dead components still write to some of them.

### `src/components/AccountsTab.tsx` — localStorage backup writes (P2)

```typescript
// Creates backup keys like 'odcrm_accounts_backup_<timestamp>'
const backupKeys = Object.keys(localStorage).filter(k => k.startsWith('odcrm_accounts_backup_'))
```

This component is **dead** (not imported anywhere) but if reactivated, would create localStorage backup proliferation. The backup logic itself has cleanup to keep only last 5, but the component shouldn't exist.

### `src/hooks/useUsersFromDatabase.ts` — One-time migration (✅ Acceptable)

```typescript
// Migrates users from localStorage to DB on first run
// One-time only — once migrated, reads from DB
```

This is acceptable one-time migration logic.

---

## 5. API Response Defensive Parsing

### `Array.isArray` Guards

Reviewed key API-consuming components for missing array guards that could cause `.map is not a function` crashes:

| Component | Pattern | Assessment |
|-----------|---------|------------|
| `EmailAccountsTab.tsx` | `Array.isArray(data) ? data : []` | ✅ Guarded |
| `SequencesTab.tsx` | Typically `data || []` | Mostly guarded |
| `CampaignsTab.tsx` | `data?.campaigns ?? []` | ✅ Guarded |
| `InboxTab.tsx` | `Array.isArray(data)` | ✅ Guarded |

General assessment: Most components use `data || []` or `data?.x ?? []` patterns. The `api.ts` `unwrapResponsePayload` function unwraps `{data: [...]}` envelopes correctly.

---

## 6. `ErrorBoundary.tsx` Diagnostic Update (Note)

The `ErrorBoundary.tsx` was updated in commit `d0ccc81` to log `info.componentStack` separately for better crash diagnostics. This is a useful improvement and should be kept.

Current state:
```typescript
componentDidCatch(error: Error, info: React.ErrorInfo) {
  console.error('❌ ODCRM render error:', error.message)
  console.error('❌ ODCRM component stack:', info.componentStack)
}
```

✅ This is correct. Keep as-is.

---

## 7. Complete Findings Table

| Area | Severity | Finding | Evidence | Fix Summary |
|------|----------|---------|----------|-------------|
| TDZ (EmailAccountsTab) | ✅ Fixed | `loadIdentities` declared after useEffect | commit `60f6695` | Already fixed |
| Bundle architecture | **P2** | Single 1.38MB chunk, no code splitting | vite.config.ts | Add `React.lazy()` for tab pages |
| `currentCustomerId` fallback | **P1** | Fallback `'prod-customer-1'` writes to localStorage | settings.ts | Remove fallback write-back, return null |
| Dead components (20 files) | **P2** | Orphaned tab components in `src/components/` | No imports found | Safe delete after confirming no lazy requires |
| `LeadSourcesTab.tsx` (old) | **P2** | Old tab still imported alongside `LeadSourcesTabNew` | MarketingHomePage.tsx | Remove old, keep New |
| localStorage business keys | **P2** | 10+ business data keys still defined in keys.ts | keys.ts | Deprecate stale keys with comments |
| `AccountsTab.tsx` backup writes | **P2** | Dead component writes localStorage backups | AccountsTab.tsx | Delete dead component file |

---

## 8. Recommended Actions

### P1: Fix `getCurrentCustomerId` fallback (safe, surgical)

**File:** `src/platform/stores/settings.ts`

Remove the `'prod-customer-1'` fallback and write-back behavior. The caller (`api.ts`) should gracefully handle a null customerId by not setting the header, causing the backend to return 400 — a clear, diagnosable error vs. silent empty data.

### P2: Delete dead components (safe removals)

Files to delete (confirmed no imports):
```
src/components/MarketingSequencesTab.tsx
src/components/MarketingInboxTab.tsx
src/components/MarketingListsTab.tsx
src/components/MarketingEmailTemplatesTab.tsx
src/components/MarketingReportsTab.tsx
src/components/MarketingSchedulesTab.tsx
src/components/MarketingCognismProspectsTab.tsx
src/components/MarketingPeopleTab.tsx
src/components/MarketingDashboard.tsx
src/components/MarketingLeadsTab.tsx
src/components/CampaignsEnhancedTab.tsx
src/components/CampaignSequencesTab.tsx
src/components/EmailCampaignsTab.tsx
src/components/EmailAccountsEnhancedTab.tsx
src/components/EmailSettingsTab.tsx
src/components/DashboardTab.tsx
src/components/CustomersManagementTab.tsx
src/components/ExportImportButtons.tsx
src/components/DataPortability.tsx
src/components/DiagnosticBanner.tsx
```

Before deleting: run `npm run build` to confirm zero imports via tree-shaking (no build errors = safe).

### Verification

After all frontend P1 fixes:
```bash
npm run build   # Must succeed with 0 errors
npx tsc --noEmit  # Must succeed with 0 errors
# Then manually test:
# 1. Marketing → Email Accounts tab → no TDZ crash
# 2. Change customer in dropdown → API calls use new customerId
# 3. Hard refresh after clearing localStorage → shows 400/empty state, not 'prod-customer-1' data
```
