# E2E Smoke Checklist — Marketing Completion Sprint

**Branch:** `marketing-completion-sprint`
**Date:** 2026-02-22

---

## How to run

1. Start dev server: `npm run dev` (frontend on :5173) + `cd server && npm run dev` (backend on :3001)
2. Open http://localhost:5173 → Marketing tab
3. Go through each section below

---

## Phase 1 — Templates Tab

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 1.1 | Select a customer and load templates | Template grid appears, no console error | |
| 1.2 | Click "New Template" → fill name/subject/content → Create | Template appears in grid | |
| 1.3 | Click kebab menu → Delete on the just-created template | Template disappears immediately, success toast shows | |
| 1.4 | Hard refresh page | Deleted template is NOT visible | |
| 1.5 | Delete template for wrong customer (via API with different X-Customer-Id) | Backend returns 404 | |

---

## Phase 2 — Sequences Tab (Create Sequence Modal)

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 2.1 | Click "New Sequence" | Modal opens wider (~6xl), two-column layout | |
| 2.2 | Left column shows steps area, right column shows Name/Leads/Sender | Layout correct | |
| 2.3 | Click "Add Step" | Step appears in left column | |
| 2.4 | Fill name + select lead batch + select sender | Config fields accept input | |
| 2.5 | Click "Save Draft" | Modal stays open, sequence saved, Start button becomes enabled | |
| 2.6 | Close and reopen modal (Edit) | Previously saved data visible | |
| 2.7 | Click "Start Sequence" (after saved) | Start dialog appears | |

---

## Phase 3 — Suppression / Compliance Tab

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 3.1 | Tab shows "Suppressed Emails" and "Suppressed Domains" sub-tabs | Tab strip visible with counts | |
| 3.2 | Click "Suppressed Emails" tab | Table shows only email-type entries | |
| 3.3 | Click "Suppressed Domains" tab | Table shows only domain-type entries | |
| 3.4 | Add a manual email entry while on Emails tab | Entry appears in emails table | |
| 3.5 | Delete entry | Entry disappears immediately; if API fails it reappears (rollback) | |
| 3.6 | Paste CSV and import | Import results shown, entries appear in table | |
| 3.7 | Verify no `prod-customer-1` appears in network requests | DevTools Network tab | |

---

## Phase 4 — Schedules Tab

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 4.1 | Navigate to Schedules | Tab loads without crash/white screen | |
| 4.2 | Stats cards show correct counts | No NaN, no undefined | |
| 4.3 | Schedules list loads from backend | Campaigns appear (if any) | |
| 4.4 | Click "Create Schedule" | Modal opens without error | |
| 4.5 | Scheduled emails list loads | Table shows upcoming emails (or empty state) | |
| 4.6 | Pause / Resume a running campaign | Status updates after action | |

---

## Phase 5 — Reports Tab

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 5.1 | Navigate to Reports | Tab loads, customer dropdown populates | |
| 5.2 | Select customer + date range | Report metrics render (or 0s for empty data) | |
| 5.3 | Error state: API down | Alert with Retry button visible (button now properly imported) | |
| 5.4 | Switch date range (Today/Week/Month) | Metrics update | |

---

## Phase 6 — Inbox Tab

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 6.1 | Navigate to Inbox | Tab loads without crash | |
| 6.2 | Threads view shows thread list | Left panel populated (or empty state) | |
| 6.3 | Click a thread | Messages appear in right panel | |
| 6.4 | Type reply and click Send Reply | Reply sent (or error shown if no identity) | |
| 6.5 | "Mark as Opt-out" button visible on inbound thread | Button shows for threads with inbound messages | |
| 6.6 | Click Mark as Opt-out | Toast confirms addition to suppression list | |
| 6.7 | Switch to Replies view | Reply list appears (or empty state) | |
| 6.8 | Refresh button works | Data reloads | |
| 6.9 | Verify no `prod-customer-1` in network requests | DevTools Network tab | |

---

## Production Verification (post-deploy)

```powershell
# Check production build SHA matches expected
Invoke-WebRequest "https://odcrm.bidlow.co.uk/__build.json" | Select-Object -ExpandProperty Content

# Expected: {"sha":"<latest-commit-sha>","buildTime":"..."}
```

| # | Check | Pass? |
|---|-------|-------|
| P.1 | `/__build.json` SHA matches git HEAD | |
| P.2 | Marketing → Templates loads without error | |
| P.3 | Marketing → Sequences modal is wide | |
| P.4 | Marketing → Compliance shows Emails/Domains tabs | |
| P.5 | Marketing → Schedules loads without crash | |
| P.6 | Marketing → Reports loads without crash | |
| P.7 | Marketing → Inbox loads without crash | |
| P.8 | Browser console (F12) — no errors | |
