# ODCRM Operator Acceptance Checklist

## Purpose
Use this checklist to verify ODCRM feels clear and actionable for a normal employee from sign-in through daily outreach operations.

## Preconditions
- Sign in with a valid internal ODCRM user.
- Select a real client in the global selector.
- Confirm the selected client ID in requests (`X-Customer-Id`) matches the chosen client.

## 1) Dashboard Triage (Start Here)
- Open **Dashboard**.
- Confirm the triage area is visible and clearly labeled as live action priority.
- Confirm readiness state badge and reason are visible.
- Confirm next-step actions are visible:
  - Onboarding setup
  - Clients data fix
  - Marketing Readiness
  - Reports retrospective
- Pass if it is obvious what to do next for this client.

## 2) Clients CRM/Data-Health
- Open **OpenDoors Clients**.
- Confirm CRM/data-health framing explains Accounts vs Contacts vs Leads.
- Confirm readiness guidance explains when to return to Marketing.
- Confirm handoff actions are visible and usable.
- Pass if data-maintenance purpose is clear and not confused with daily sending operations.

## 3) Onboarding Activation
- Open **Onboarding**.
- Confirm activation/checkpoint framing is visible.
- Confirm blocker vs proceed guidance is visible.
- Confirm “continue in Marketing Readiness” handoff is visible.
- Pass if onboarding reads as setup progression, not indefinite daily workspace.

## 4) Marketing Daily Operations
- Open **Marketing**.
- Confirm operator guidance is visible at top.
- Confirm continuity guidance explains when to switch to Onboarding/Clients.
- Confirm Readiness, Sequences, Inbox, Reports remain reachable.
- Pass if daily workflow path is clear for a non-technical user.

## 5) Reports vs Dashboard Separation
- In **Dashboard**, confirm copy frames it as live triage.
- In **Marketing > Reports**, confirm copy frames it as retrospective analysis.
- Confirm each page has a clear route/handoff to the other.
- Pass if role separation is unambiguous.

## 6) Leads/Reporting Source-of-Truth Clarity
- Open client leads surfaces (Clients Leads + Leads Reporting + Marketing Leads).
- Confirm each view states source-of-truth mode (Google Sheets-backed or DB-backed).
- If sheet path is invalid/inaccessible, confirm error explains action needed.
- Pass if failures are actionable and do not silently pretend stale cache is current truth.

## 7) Settings Role Framing
- Open **Settings**.
- Confirm Settings is framed as admin/setup only.
- Confirm guidance points daily users back to Dashboard/Marketing.
- Pass if Settings is not presented as daily operations workspace.

## 8) Active-Client Guardrails
- Clear selected client (or use a fresh session without a selected client).
- Open tenant-scoped pages.
- Confirm “Select a client to continue” guidance appears.
- Confirm “Go to Clients” recovery action works.
- Pass if no silent first-client fallback is used.

## 9) Pass/Fail Capture
- Record PASS/FAIL for each section above.
- Capture exact page and action where confusion occurs.
- Capture screenshot and timestamp for each failure.

## 10) Escalation Rules
- If a page gives no next step, log as **P1 usability blocker**.
- If source-of-truth is unclear or misleading, log as **P1 trust blocker**.
- If navigation dead-end occurs, log as **P1 flow blocker**.
