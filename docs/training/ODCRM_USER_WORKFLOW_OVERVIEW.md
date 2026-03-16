# ODCRM User Workflow Overview

## Purpose
This guide shows the safest normal order for using ODCRM. It separates setup work from day-to-day operation and explains which tabs depend on earlier tabs.

## The big picture
ODCRM is easiest to use when you think about it in three phases:
1. `Client setup`: make sure the client record, onboarding data, mailboxes, lead sources, and suppression controls exist.
2. `Outreach setup`: create templates, build a sequence, test it, and confirm readiness.
3. `Daily operation`: monitor schedules, work the inbox, and review reports.

## Recommended order across the app
### Phase 1: Set up the client record
Tabs involved:
- `OpensDoors Clients`
- `Onboarding`

Normal order:
1. Confirm or create the client.
2. Complete the onboarding form and progress tracker.
3. Add core contacts and commercial details.
4. Confirm targets, lead sheet references, and required files.

Why this matters:
- Marketing tabs are tenant-scoped to a client.
- Readiness and reporting become confusing if the base client record is incomplete.

## Phase 2: Make the client send-ready
Tabs involved:
- `Email Accounts`
- `Lead Sources`
- `Suppression List`
- `Readiness`

Normal order:
1. Connect sending mailboxes.
2. Confirm mailbox status, caps, and sending windows.
3. Connect lead-source sheets and review available batches.
4. Connect or replace suppression sheets and confirm email/domain protection.
5. Open `Readiness` to see what is still missing.

Dependencies:
- No mailbox means no real sending.
- No lead source means no live recipient handoff.
- No suppression setup increases risk and will surface as readiness issues.

## Phase 3: Build the outreach content
Tabs involved:
- `Templates`
- `Sequences`

Normal order:
1. Create or clean up templates.
2. Use the real placeholder chips that ODCRM supports.
3. Build a sequence from those templates.
4. Select the live lead batch or linked list.
5. Add a test audience and run a test batch.
6. Fix anything that fails in preview, preflight, or test results.
7. Start the live sequence only when you are satisfied with the live-recipient path.

Dependencies:
- Templates feed sequence steps.
- Sequences need a sender mailbox and usable recipients.
- `Start live sequence` and `Send test batch now` do not use the same recipient path.

## Phase 4: Monitor and respond
Tabs involved:
- `Schedules`
- `Inbox`
- `Reports`
- `Readiness`

Normal order:
1. Use `Schedules` to monitor active or paused sending.
2. Use `Inbox` to review replies, send replies, and record opt-outs.
3. Use `Reports` to check outcomes and trends.
4. Return to `Readiness` whenever you need a compact view of blockers and next actions.

Dependencies:
- Schedule status depends on live campaign-backed state.
- Inbox freshness depends on stored metadata plus refresh/reply-detection.
- Reports are database-backed historical truth, not live mailbox polling.

## Setup work vs daily operational work
### Setup tabs
Use these mostly when a client is being onboarded or materially changed:
- `Clients`
- `Onboarding`
- `Email Accounts`
- `Lead Sources`
- `Suppression List`
- `Templates`
- `Sequences`

### Daily operational tabs
Use these when outreach is already running:
- `Readiness`
- `Schedules`
- `Inbox`
- `Reports`

## How the tabs connect
### Clients -> Onboarding
The client record gives Onboarding somewhere to save account details, contacts, targets, and attachments.

### Onboarding -> Readiness
Onboarding contributes to whether the client is treated as incomplete, ready, or active.

### Email Accounts -> Templates / Sequences / Schedules
Mailboxes matter downstream because:
- template previews can use sender details,
- sequences need a sender identity,
- schedules monitor mailbox-backed live sending.

### Lead Sources -> Sequences
`Use in sequence` hands a reviewed lead batch into the sequence flow. It does not send by itself.

### Suppression -> Sequences / Schedules / Inbox
Suppression protects future sends and affects what can be queued or sent. Inbox opt-outs also feed back into this area.

### Templates -> Sequences
Templates are copied into sequence steps. Editing the shared template later does not automatically rewrite existing sequence steps.

### Sequences -> Schedules
Once a live sequence is started, the active sending state shows up in `Schedules`.

### Inbox -> Compliance / Reports
Replies and opt-outs affect future sending and reporting. The inbox is where operators handle actual replies; reports show the longer-term results.

## Operator-first workflow for a new launch
1. Select the client.
2. Finish onboarding basics.
3. Connect at least one real sending mailbox.
4. Connect lead-source sheets.
5. Connect suppression sources.
6. Create and preview templates.
7. Build the sequence.
8. Add test recipients and run a test batch.
9. Review readiness and fix blockers.
10. Start the live sequence.
11. Monitor schedules.
12. Work inbox replies.
13. Check reports.

## Operator-first workflow for an already-live client
1. Open `Readiness`.
2. Review the status, blockers, and next action.
3. Open `Schedules` for live sending detail.
4. Open `Inbox` for reply work.
5. Open `Reports` for performance review.
6. Return to `Templates`, `Sequences`, `Lead Sources`, or `Suppression List` only when something actually needs to change.

## Reality check
The UI contains some diagnostics-heavy areas, especially in `Sequences`. For normal operator work, use the path above instead of treating every visible control as part of the day-one workflow.

## Related docs
- [Master Index](./ODCRM_USER_TRAINING_MASTER_INDEX.md)
- [Task Playbooks](./ODCRM_TASK_PLAYBOOKS.md)
- [Known Limits and Gotchas](./ODCRM_KNOWN_LIMITS_AND_GOTCHAS.md)
