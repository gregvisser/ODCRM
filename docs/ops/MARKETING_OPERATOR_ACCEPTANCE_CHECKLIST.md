# Marketing Operator Acceptance Checklist

## Preconditions
- Confirm active production parity is green before manual checks.
- Use a valid tenant context with `X-Customer-Id`.
- Confirm at least one connected email identity exists for the selected client.
- Confirm at least one sequence exists (or note missing prerequisite as expected fail).

## 1) Select Active Client
- Open Marketing.
- Confirm client is selected and all tab surfaces load without tenant fallback behavior.
- Expected:
  - No silent customer defaulting.
  - If no client is selected, UI explains what to select and why.

## 2) Readiness Review
- Open Readiness tab.
- Verify:
  - summary cards load
  - last-updated shows
  - no-sequence guidance appears when no sequence selected
  - next-step actions are visible and understandable
- Confirm operator can move to Sequences, Reports, or Inbox from Readiness guidance/actions.

## 3) Sequence Review / Preflight
- Open Sequences from Readiness.
- Verify:
  - sequence readiness loads for selected sequence
  - preflight panel shows status, blockers, warnings
  - disabled actions explain why unavailable
- Expected:
  - clear path from problem to next safe action.

## 4) Launch Preview / Queue Inspection
- In Sequences:
  - open Launch Preview
  - inspect first-batch candidates/excluded rows
  - open Queue Workbench and verify state filters + refresh
- Expected:
  - inspect -> act (if allowed) -> refresh -> verify is possible.

## 5) Reports Review
- Open Reports tab.
- Verify:
  - by-sequence and by-identity metrics load
  - recent reasons and recent attempts are readable
  - follow-up actions route to Sequences and Inbox
- Expected:
  - operators can decide where to investigate next.

## 6) Inbox Review / Reply Flow
- Open Inbox tab.
- Verify:
  - thread list or replies load
  - empty-state text distinguishes "no data" from "loading/error"
  - refresh works
  - thread detail opens when a thread is selected
  - reply composer is visible in thread context
  - reply send path is available via existing safe backend route
- Expected:
  - a normal user can handle inbound follow-up without developer help.

## 7) Error / Empty-State Sanity
- Temporarily use a client with little/no activity.
- Confirm tabs provide actionable guidance instead of dead ends.
- Confirm unavailable states include what to do next.

## 8) Pass/Fail Capture
- Record:
  - date/time
  - operator name
  - client ID used
  - pass/fail per section (1-7)
  - blocking issue details and screenshots/links

## 9) Known Follow-Up Issues
- Document any user-facing friction that remains:
  - exact tab/panel
  - expected behavior
  - actual behavior
  - severity (operator-blocking / moderate / cosmetic)
