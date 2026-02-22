# Marketing Completion Sprint — Status Tracker

**Branch:** `marketing-completion-sprint`
**Started:** 2026-02-22
**Status:** All code phases complete, ready to deploy

---

## Phase 0 — Baseline ✅
- [x] Pulled latest main
- [x] Created branch `marketing-completion-sprint`
- [x] Frontend build: PASS (1353 modules)
- [x] Backend build: PASS
- [x] `npx tsc --noEmit`: PASS (0 errors)

---

## Phase 1 — Templates Tab ✅
**Bug fixed:** `handleDeleteTemplate` in `TemplatesTab.tsx`

**Changes:**
- Destructure `{ error }` from `api.delete()` and return early with error toast on failure
- Only call `setTemplates(prev => prev.filter(...))` after confirmed backend deletion (instant UI update, no re-fetch needed)
- Guard: bail if no valid `cust_*` customer selected

**Backend:** Already correctly tenant-scoped — no changes needed.

---

## Phase 2 — Sequences Modal Redesign ✅
**Changes to `SequencesTab.tsx`:**
- Modal: `size="xl"` → `size="6xl"` with `scrollBehavior="inside"`
- Two-column layout via `SimpleGrid columns={{ base:1, lg:2 }}`
  - Left: Steps list with per-step cards, Add Step button header
  - Right: Sequence Name, Leads Snapshot, Sender dropdowns
- Dashed empty-state when no steps yet
- CTA row at bottom: Cancel | Save Draft | Start Sequence (sticky footer with border)
- "Save draft to enable Start" notice moved to right column, inline, compact

---

## Phase 3 — Suppression Lists ✅
**Changes to `ComplianceTab.tsx`:**
- Fixed `getCurrentCustomerId('prod-customer-1')` → `getCurrentCustomerId('')`
- Added `listTypeFilter` state (`'email' | 'domain'`)
- Added Emails / Domains top-level sub-tab row (counts shown per type)
- Table now filters entries by `listTypeFilter`
- `handleAdd` uses `listTypeFilter` as the authoritative type (not separate `type` state)
- Fixed optimistic delete: snapshot entries before removal, restore on API error (rollback)

---

## Phase 4 — Schedules Tab ✅
**Changes to `SchedulesTab.tsx`:**
- Defined `TimeWindow` type: `{ startTime, endTime, maxEmails }`
- Defined `DeliverySchedule` type: extends `CampaignSchedule` with `isActive`, `timezone`, `daysOfWeek`, `timeWindows` and optional fields
- `editingSchedule` state type changed from `CampaignSchedule | null` → `DeliverySchedule | null`
- `handleCreateSchedule`: added all required fields (`customerId`, `status`, `senderIdentity`, `totalProspects`)
- `handleEditSchedule`: receives `CampaignSchedule`, maps sender identity fields into `DeliverySchedule` format
- `handleToggleSchedule`: uses `schedule.status !== 'running'` instead of `schedule.isActive`
- `stats` useMemo: `s.isActive` → `s.status === 'running'`, `e.status === 'pending'` → `e.status === 'scheduled'`
- Mock data renamed `_mockSchedules`/`_mockScheduledEmails` with correct types

---

## Phase 5 — Reports Tab ✅
**Changes to `ReportsTab.tsx`:**
- Added `Button` to Chakra UI imports (was missing, causing invisible Retry button)

---

## Phase 6 — Inbox Tab ✅
**Changes to `InboxTab.tsx`:**
- Added missing Chakra imports: `Grid`, `CardHeader`, `Textarea`, `useToast`
- Added `NotAllowedIcon` from `@chakra-ui/icons` for opt-out button
- Added `const toast = useToast()` at top of component
- Fixed all `getCurrentCustomerId('prod-customer-1')` fallbacks → `getCurrentCustomerId('')`
- Removed fallback to synthetic `{ id: defaultCustomerId, name: 'Default Customer' }` (return empty array instead)
- Added "Mark as Opt-out" button in thread reply form: finds first inbound `fromAddress`, POSTs to `/api/suppression` with `type: 'email'`, shows success/error toast

---

## Final Phase ✅
- [x] Frontend build: PASS (1367.70 kB)
- [x] `npx tsc --noEmit`: PASS
- [x] Backend build: PASS
- [x] Zero linter errors on all changed files
- [x] E2E_SMOKE_CHECKLIST.md written

---

## Blockers
_None. All phases implemented._

---

## Next Actions
1. Commit all changes
2. Push branch → merge to main
3. Wait for GitHub Actions deployment
4. Verify `/__build.json` SHA in production
5. Run E2E_SMOKE_CHECKLIST.md manually in browser
