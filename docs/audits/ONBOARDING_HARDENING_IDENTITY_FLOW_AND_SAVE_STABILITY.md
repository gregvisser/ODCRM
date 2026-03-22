# Onboarding hardening — identity, save stability, flow, client account surfacing

## Branch / baseline

- **Branch:** `codex/harden-onboarding-identity-flow-save-stability`
- **Start SHA (`origin/main` at branch creation):** `a3515173e673c3b82a6ea323bc3f7a708ed32c35`

## 1. Root-cause analysis

### A. “By unknown” on manual confirmations

- **Cause:** `PUT /api/customers/:id/progress-tracker` used `getActorIdentity()` from `server/src/utils/auth.ts`, which only reads Azure SWA `x-ms-client-principal` or `req.user`. Production calls go to the App Service with `Authorization: Bearer <Entra token>` (see `src/utils/api.ts` + `getApiAuthToken()`). Bearer path was a TODO and returned no identity → `updatedByUserId` became the literal string `'unknown'`, stored in `progressTrackerMeta.*.completedByUserId`.
- **Frontend:** `resolveUserLabel` matched `dbUsers` by `userId` or `email` but did not normalize email case; raw `'unknown'` displayed as “By unknown”.

### B. Jump-to-top after save / tick

- **Cause:** Every `fetchCustomer()` set `isLoading` true, which replaced the entire onboarding tree with a centered `<Spinner>` (`CustomerOnboardingTab`), destroying scroll position. Progress saves called `onRefresh` → full fetch. Duplicated refresh paths (`await onRefresh` + `customerUpdated` listener in `OnboardingProgressContext`) could amplify churn.

### C. Bottom checklist felt detached

- **Cause:** All non-embedded manual items lived in one `RemainingProgressAccordion` at the bottom with Sales / Ops / AM labels, far from the related form work.

### D. Client account surfacing

- **Prior state:** Account drawer mirrored onboarding fields in tabs but had no compact “onboarding at a glance” strip; wiring already used `GET /api/customers/:id` (`selectedCustomerDetail`).

## 2. Fixes implemented

### Identity (backend + frontend)

- Progress tracker route now uses **`await getVerifiedActorIdentity(req)`** (`server/src/utils/actorIdentity.ts`), same verified Entra JWT path as other audited routes. Persists `completedByUserId` as **`emailNormalized` (preferred) or `oid`/`sub`**, not `'unknown'`, when the token validates.
- **`resolveUserLabel`** ( `OnboardingProgressContext` ): case-insensitive email match; show raw email if user not in DB list; treat literal `unknown` as legacy and show a neutral line instead of “By unknown”.

### Save stability

- **`fetchCustomer({ background: true })`**: skips full-page loading spinner and restores `window.scrollY` after rehydrate (for background refreshes).
- **Single refresh path for progress:** `saveItem` emits `customerUpdated` only; **`CustomerOnboardingTab`** subscribes once and runs background fetch. Removed duplicate `customerUpdated` listener from `OnboardingProgressContext`.
- Upload / payment / ops doc uploads: rely on **`emit('customerUpdated')`** (no redundant `await onRefresh()` + emit).

### Flow

- **Removed** `RemainingProgressAccordion.tsx`.
- **Added** `ManualConfirmationBlock` + `manualConfirmationPlacements.ts` to place manual rows:
  - Commercial & handover → inside **Commercial & contract**
  - **Operations coordination** → after suppression, before contacts
  - **Delivery, meetings & go-live** → after **TargetingReadinessStrip**, before case studies
  - **Final sign-offs** → bottom (`#onb-confirmations`)
- **StickyProgressSummary:** links for `#onb-ops-coordination`, `#onb-delivery-launch`; “Confirmations” → “Final sign-offs”.

### Client account (read-only)

- **AccountsTab** drawer: “Onboarding (read-only summary)” — status, start date, account manager, `progressTracker.updatedAt`, **Open onboarding** (dispatches existing `navigateToOnboarding`). No duplicate editable fields.

## 3. Files

### Modified

- `server/src/routes/customers.ts`
- `src/tabs/onboarding/CustomerOnboardingTab.tsx`
- `src/tabs/onboarding/progress/OnboardingProgressContext.tsx`
- `src/tabs/onboarding/progress/InlineProgressWidgets.tsx`
- `src/tabs/onboarding/progress/OpsDocumentsInlineCard.tsx`
- `src/tabs/onboarding/progress/StickyProgressSummary.tsx`
- `src/components/AccountsTab.tsx`

### Added

- `src/tabs/onboarding/components/ManualConfirmationBlock.tsx`
- `src/tabs/onboarding/progress/manualConfirmationPlacements.ts`
- `docs/audits/ONBOARDING_HARDENING_IDENTITY_FLOW_AND_SAVE_STABILITY.md`

### Removed

- `src/tabs/onboarding/components/RemainingProgressAccordion.tsx`

## 4. Backend / state wiring

- **Changed:** `PUT /progress-tracker` actor resolution only (still same JSON merge contract for `progressTracker` / `progressTrackerMeta`).
- **Not changed:** Tenant header enforcement, auto-tick rules, Prisma merge behavior.

## 5. Validation

| Command | Result |
|--------|--------|
| `npm run lint` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 |
| `cd server && npm run build` | exit 0 |

**Manual / browser:** Recommended after deploy — tick a manual onboarding item and confirm attribution shows real name/email; confirm scroll does not jump to top; walk new confirmation sections; open client drawer and verify onboarding summary + “Open onboarding”.

## 6. Limitations / follow-ups

- If **`MICROSOFT_CLIENT_ID` / `AZURE_CLIENT_ID`** is unset on App Service, `getVerifiedActorIdentity` will not verify Bearer tokens (by design, matches `/api/users/me`). Ensure production env matches Entra app used by the SPA.
- Sticky summary still shows **Sales / Ops / AM** counts as aggregate KPIs (not renamed in this PR).
- `handleSave` still emits `customerUpdated` → extra GET via listener after PUT (acceptable; optional micro-optimization later).
