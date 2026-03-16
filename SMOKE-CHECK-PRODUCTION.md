# ODCRM 10–15 Minute Production Smoke Check

## 1. Login / Shell
- [ ] App loads without immediate errors (check browser console for red errors)
- [ ] Login succeeds (if required)
- [ ] User profile loads (top-right corner or menu shows correct user/account)

## 2. Top-Level Navigation
- [ ] All 5 tabs visible and clickable in top nav:
  - [ ] Dashboard
  - [ ] Clients (or "OpensDoors Clients")
  - [ ] Marketing
  - [ ] Onboarding
  - [ ] Settings
- [ ] Tab switching works (click between Dashboard and Clients, verify page changes)
- [ ] No console errors when navigating

## 3. Dashboard Integrity
- [ ] Dashboard tab opens without error
- [ ] Page title or header reflects "Dashboard" or "Reporting"
- [ ] At least one chart, card, or summary element renders (not blank)
- [ ] Client/Account selector is present (dropdown or filter button)
- [ ] Single-client view works:
  - [ ] Select a specific client from dropdown
  - [ ] Dashboard updates (charts/data change or show client-specific data)
- [ ] "All Clients" or aggregate view works:
  - [ ] Switch back to all clients view
  - [ ] Dashboard shows aggregate/combined data
- [ ] Period controls behave (date picker or "Last 30 days" dropdown):
  - [ ] Click period control
  - [ ] Options appear or filter applies
  - [ ] Data visually changes
- [ ] No red error banners or "undefined" text visible

## 4. Clients / Customers
- [ ] Clients tab opens without error
- [ ] Some client records are visible (table, list, or cards)
- [ ] Client selector works:
  - [ ] Click on a client record or use selector
  - [ ] App shows that client's details
- [ ] No "wrong client" leakage (data from unrelated clients not visible)
- [ ] Navigating back to Dashboard with client selected shows that client's data

## 5. Marketing
- [ ] Marketing tab opens without error
- [ ] At least 3 of these sub-tabs or sections are visible and clickable:
  - [ ] Reports (dashboard-style reporting, separate from main Dashboard)
  - [ ] Lead Sources
  - [ ] Suppression (or Suppression Lists)
  - [ ] Email Accounts (or similar account/integration management)
  - [ ] Templates (email or message templates)
  - [ ] Sequences (automation or campaign sequences)
  - [ ] Schedules (if present)
  - [ ] Inbox (communications or messages)
- [ ] Clicking a sub-tab loads its content (not blank or error)
- [ ] Reports sub-tab works independently from Dashboard (has own controls/filters)
- [ ] No console errors in Marketing sections

## 6. Onboarding
- [ ] Onboarding tab opens without error
- [ ] Onboarding section shows some content (not completely blank)
- [ ] At least one progress indicator or status element is visible
  - [ ] E.g., step indicators, progress bar, or checklist
- [ ] No red error text or undefined values

## 7. Settings
- [ ] Settings tab opens without error
- [ ] Some settings options or sections are visible (not blank)
- [ ] No console errors in Settings

## 8. Failure Signs to Watch For
- **Red error banners or alerts** on any page
- **Undefined, null, or [object Object]** text in the UI
- **Blank pages** when tabs open (content should load within ~2 seconds)
- **Broken navigation** — tabs don't switch or get stuck
- **Wrong client data** — switching clients shows old client's data or mixes data
- **Console errors** — open DevTools (F12), check Console tab for red message
- **404 or network error** — failed API calls shown in Network tab (DevTools)
- **No data in Dashboard** — all charts/summary cards are empty or show no numbers
- **Period controls frozen** — clicking date picker or filters has no effect

## 9. Pass / Fail Rule

**PASS**: All 5 top-level tabs open and switch without error. Dashboard and Clients load with visible data. Marketing shows at least 3 sub-tabs. Client selector works and data changes when you switch clients. No red errors, undefined text, or blank pages. Console shows no red error messages.

**FAIL / STOP & INVESTIGATE**: If any tab fails to open, if Dashboard is blank or shows error, if client switching doesn't change data, if you see red errors in UI or console, or if Marketing sub-tabs are completely missing. Stop here and check server logs and browser console before proceeding.

---

**Created**: 2026-03-16  
**Purpose**: Manual operator verification that ODCRM core CRM/outreach SaaS functionality remains operational in production after consolidation work.
