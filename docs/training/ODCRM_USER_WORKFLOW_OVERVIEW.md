# ODCRM User Workflow Overview

## Purpose
This guide explains the safest normal order for using ODCRM. It separates setup work from day-to-day operation and tells a user what should already be done before entering each major tab.

## First day as a new ODCRM operator
Use this as your first-day path through the product.

1. Open `OpensDoors Clients` and confirm you are in the correct client record.
2. Open `Onboarding` and make sure the correct client is selected.
3. Complete the essential onboarding details for that client.
4. Open `Email Accounts` and connect at least one sending mailbox.
5. Open `Lead Sources` and confirm a usable source is connected and reviewable.
6. Open `Suppression List` and confirm email/domain protection is configured.
7. Open `Templates` and create or review the outreach copy.
8. Open `Sequences` and build the draft sequence.
9. Add a test audience and run a test batch.
10. Open `Readiness` and confirm the client/sequence is ready to move forward.
11. Start the live sequence only after the test path and readiness checks look right.
12. Move to `Schedules`, `Inbox`, and `Reports` for day-to-day operation.

## Daily operator checklist
Use this when you are handling already-live work.

1. Select the correct client.
2. Open `Readiness` and read the current status first.
3. Open `Schedules` and check live status, next send, and recent outcomes.
4. Open `Inbox` and work new replies or opt-outs.
5. Open `Reports` and review whether results still look healthy.
6. Go back to `Email Accounts`, `Lead Sources`, `Suppression List`, `Templates`, or `Sequences` only if you need to change setup or fix a blocker.

## The big picture
ODCRM is easiest to use when you think about it in four phases:
1. `Client context`: confirm the correct client record.
2. `Client setup`: finish onboarding, mailboxes, lead sources, and suppression.
3. `Outreach setup`: create templates, build a sequence, test it, and confirm readiness.
4. `Daily operation`: monitor schedules, work the inbox, and review reports.

## Workflow map
### Phase 1: Confirm the client context
Tabs involved:
- `OpensDoors Clients`
- `Onboarding`

Before you enter Marketing, make sure:
- you are looking at the right client,
- the client record is not obviously incomplete,
- onboarding is using the same client context you expect.

Why this matters:
- marketing routes are tenant-scoped,
- sequence, schedule, and report confusion often starts with the wrong client being selected.

What to do next:
- go to `Onboarding` if setup is incomplete,
- go to `Readiness` only after the client context looks correct.

### Phase 2: Make the client send-ready
Tabs involved:
- `Email Accounts`
- `Lead Sources`
- `Suppression List`
- `Readiness`

Before you move on:
- at least one real mailbox should be connected,
- the mailbox should have a sensible cap, signature, and send window,
- a lead source should be connected and reviewable,
- suppression should be configured or manually populated.

Dependencies:
- no mailbox means no real sending,
- no lead source means no live-recipient handoff,
- no suppression setup increases risk and surfaces later as readiness or send blocking.

What to do next:
- move to `Templates` and `Sequences` after these setup tabs look healthy,
- return to `Readiness` whenever you need the shortest view of what is still missing.

### Phase 3: Build the outreach content
Tabs involved:
- `Templates`
- `Sequences`

Normal order:
1. Create or review templates.
2. Use the real ODCRM placeholder tokens.
3. Build the sequence from those templates.
4. Select the live lead batch/list.
5. Add a test audience.
6. Run a test batch.
7. Fix anything that fails in preview, preflight, or test results.
8. Start the live sequence only when the live-recipient path is ready.

Critical dependency:
- `Start live sequence` and `Send test batch now` do not use the same recipient path.

What to do next:
- after live launch, move to `Schedules` first,
- use `Readiness` again if you want a compact launch-health view.

### Phase 4: Monitor and respond
Tabs involved:
- `Schedules`
- `Inbox`
- `Reports`
- `Readiness`

Normal order:
1. Use `Schedules` to monitor active or paused sending.
2. Use `Inbox` to review replies, send replies, and record opt-outs.
3. Use `Reports` to review outcomes and trends.
4. Return to `Readiness` when you need a quick blocker summary.

Important truth:
- `Schedules` reflects live campaign-backed state,
- `Inbox` reflects stored message/reply truth rather than a live mailbox read on every screen load,
- `Reports` reflects database-backed history rather than direct live mailbox polling.

## Setup tabs vs day-to-day tabs
### Setup tabs
Use these mostly when a client is being onboarded or materially changed:
- `Clients`
- `Onboarding`
- `Email Accounts`
- `Lead Sources`
- `Suppression List`
- `Templates`
- `Sequences`

### Day-to-day operational tabs
Use these when outreach is already running:
- `Readiness`
- `Schedules`
- `Inbox`
- `Reports`

## How the tabs connect
### `Clients` -> `Onboarding`
The client record gives onboarding somewhere to save account details, contacts, targets, and attachments.

### `Onboarding` -> `Readiness`
Onboarding affects whether the client is interpreted as incomplete, ready, or active.

### `Email Accounts` -> `Templates`
Mailbox data affects sender fields, signature rendering, and what preview/send paths can show.

### `Email Accounts` -> `Sequences`
A usable sender mailbox is required for reliable sequence setup and launch.

### `Templates` -> `Sequences`
Templates provide the starting subject/body content, but sequence steps become copied content rather than live references.

### `Lead Sources` -> `Sequences`
`Use in sequence` hands a reviewed lead batch into the sequence flow. It does not send by itself.

### `Suppression List` -> `Sequences` / `Schedules` / `Inbox`
Suppression blocks invalid or protected recipients, affects send eligibility, and is updated indirectly by unsubscribe and opt-out behavior.

### `Sequences` -> `Schedules`
Once you use `Start live sequence`, the active sending state becomes visible in `Schedules`.

### `Schedules` -> `Inbox` / `Reports`
Schedules tells you what is happening now. Inbox tells you what recipients did in response. Reports tell you what the trend looks like over time.

## Recommended operator path vs advanced path
### Recommended operator path
Use this for user training and daily work:
- client selection,
- onboarding/setup,
- mailbox setup,
- lead-source review,
- suppression review,
- template creation,
- sequence build,
- test audience,
- test batch,
- live start,
- schedule monitoring,
- inbox reply handling,
- reporting review.

### Advanced or diagnostic path
Use only when something is wrong or support work is needed:
- deep sequence diagnostics,
- queue workbench-style actions,
- preview-vs-outcome analysis,
- run-history panels,
- admin/setup work in `Settings`.

## How to know where you go next
- If setup is incomplete, go back to `Onboarding`, `Email Accounts`, `Lead Sources`, or `Suppression List`.
- If content is the problem, go to `Templates`.
- If launch or test behavior is the problem, go to `Sequences`.
- If live sending is already running, go to `Schedules`.
- If replies or opt-outs need action, go to `Inbox`.
- If you need trend review or performance context, go to `Reports`.

## Reality check
The UI contains some diagnostics-heavy areas, especially inside `Sequences`. For normal operator work, use the path above instead of treating every visible control as part of the day-one workflow.

## Related docs
- [Master Index](./ODCRM_USER_TRAINING_MASTER_INDEX.md)
- [Task Playbooks](./ODCRM_TASK_PLAYBOOKS.md)
- [Known Limits and Gotchas](./ODCRM_KNOWN_LIMITS_AND_GOTCHAS.md)
