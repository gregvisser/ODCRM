# Sequences

## Purpose
Use `Sequences` to build reusable outreach step plans, test them safely, and then launch the live sending path.

## What a sequence is in ODCRM
A sequence in ODCRM is not just one thing.

Current implementation truth:
- the saved `sequence` is the reusable definition and step structure,
- the `test audience` path uses enrollments and send-queue items,
- the `live start` path copies the sequence into a linked campaign-backed send flow.

That means you should think about `Sequences` as both:
- a builder, and
- an operator console.

## When a user should use this tab
Use this tab when you need to:
- create or edit a sequence,
- pick templates for steps,
- choose the live lead batch/list,
- add a safe test audience,
- run a test batch,
- start the live sequence,
- inspect launch diagnostics and send results.

## Prerequisites
- A client must be selected.
- At least one mailbox should be connected.
- At least one usable template should exist.
- A usable lead batch/list should exist for live sending.

## What the user sees on screen
Main areas usually include:
- header with `New Sequence`,
- KPI cards,
- sequence table/list,
- create/edit sequence modal,
- launch workflow area,
- test audience area,
- send results / audit / preview panels,
- diagnostics area behind `Open troubleshooting & audits`.

## Main actions available
Normal operator actions:
- `New Sequence`
- `Open sequence`
- `Edit sequence setup`
- `Add Step`
- `Save draft`
- `Save changes`
- `Add test audience`
- `View test audience`
- `Send test batch now`
- `View send results`
- `Review before start`
- `Start live sequence`
- `Pause sequence`
- `Delete`

Test-audience controls:
- `Use linked lead batch recipients`
- `Use manual test recipients`
- `Save test recipients`

Diagnostics/support actions also exist, including preflight, queue, run history, preview-vs-outcome, and audit tooling.

## Field-by-field explanation of the main sequence setup
| Field | What it means | Why it matters |
|---|---|---|
| `Sequence Name` | Operator label for the sequence. | Use a name that clearly identifies the campaign and audience. |
| `Leads Snapshot` | The linked live recipient source. | This is the live-recipient path used by `Start live sequence`. |
| `Sender` | Mailbox used for the sequence. | A real sender identity is required for proper launch. |
| `Template` | Shared template chosen for each step. | The content is copied into the step; it is not a live reference later. |
| `Delay after previous step (days)` | Delay before the next step. | ODCRM validates delay values and limits the total number of steps. |

### Test-audience fields
| Field | What it means |
|---|---|
| `Test group name (optional)` | Friendly label for the test audience/enrollment. |
| `Test recipient source` | Choose linked recipients or manual recipients. |
| `Manual test recipients` | Explicit email addresses for a safe test audience. |

## Live audience vs test audience
### Live audience
- Used by `Start live sequence`.
- Comes from the linked lead batch/list.
- This is the real send path.

### Test audience
- Used by `Send test batch now`.
- Comes from active enrollments.
- This is the safe queue-backed test path.

### Most important difference
`Send test batch now` does not send to the live recipients used by `Start live sequence`.

## Step-by-step common workflows
### Build a new sequence
1. Click `Sequences`.
2. Select the correct client.
3. Click `New Sequence`.
4. Enter `Sequence Name`.
5. Choose `Leads Snapshot`.
6. Choose the `Sender` mailbox.
7. Add at least one step.
8. For each step, choose a `Template` and review the copied subject/body.
9. Set the `Delay after previous step (days)`.
10. Click `Save draft`.

### Add a test audience and run a test send
1. Open the sequence.
2. Click `Add test audience`.
3. Choose either `Use linked lead batch recipients` or `Use manual test recipients`.
4. If using manual recipients, enter the email addresses.
5. Click `Save test recipients`.
6. Click `Send test batch now`.
7. Click `View send results` to confirm what sent, failed, or was blocked.

### Start the live sequence
1. Save the sequence draft first.
2. Confirm the live lead batch/list is linked.
3. Confirm the sender mailbox is correct.
4. Review sequence steps and content.
5. Click `Review before start` if needed.
6. Click `Start live sequence`.
7. Confirm the start dialog.
8. Move to `Schedules` and `Readiness` to monitor the live path.

## What happens after each action
### Save draft
- Saves or updates the reusable sequence definition.
- Saves step rows.
- Creates or updates the linked draft campaign record used for later live-start behavior.

### Send test batch now
- Sends only to due test recipients from active enrollments.
- Current test-send path is capped and intentionally conservative.
- Use `View send results` to review what actually happened.

### Start live sequence
- Copies the sequence steps into the linked campaign-backed sending path.
- Uses the linked live recipients, not the test audience.
- Marks the campaign for active sending/scheduling.

### Pause sequence
- In practice this pauses the linked live campaign path, not the reusable sequence definition itself.

## How this tab connects to other tabs
- `Templates` provide step content.
- `Lead Sources` provide the live audience handoff.
- `Email Accounts` provide the sender mailbox.
- `Readiness` summarizes launch blockers and preview vs outcome.
- `Schedules` monitor live sending after launch.

## Common mistakes / failure states / confusion points
- Mixing up test audience and live audience.
- Thinking `Start live sequence` uses manual test recipients. It does not.
- Forgetting that step content is copied from the shared template, not linked live forever.
- Treating every diagnostics panel as part of the basic operator workflow.
- Trying to delete a sequence that is still referenced by a campaign.

## Operational tips
- Build and save the draft before worrying about diagnostics.
- Use a real, named test audience before a live start.
- Read the labels carefully: ODCRM does try to separate `test recipients` from `live recipients` in the UI.

## Diagnostics vs normal operator path
### Normal operator path
Use these first:
- create/edit sequence,
- add steps,
- save draft,
- add test audience,
- send test batch,
- start live sequence,
- view send results.

### Diagnostics/support path
Use only when needed:
- `Open troubleshooting & audits`
- preflight details,
- identity capacity details,
- run history,
- preview vs outcome,
- queue/audit drilldowns.

## How to interpret current state
### If you see blockers before start
You are still in setup mode. Fix mailbox, lead, suppression, or template issues first.

### If test send results are weak
Stay in `Sequences` and review results before moving to `Start live sequence`.

### If live sending is already active
Move to `Schedules` for operational monitoring and `Inbox` for replies.

## What paused and cancelled mean
- `Pause sequence` affects the live campaign-backed path.
- Test enrollments also have their own `Pause`, `Resume`, and `Cancel` behavior in the test/send-results side.

## Reality check notes
- Current implementation mixes operator flow and deep diagnostics in the same tab.
- The queue-backed test path is not identical to the live campaign-backed path.
- Current queue-backed test sending is conservative and does not represent full unlimited production send behavior.

## Related docs / next steps
- [Templates](./TEMPLATES.md)
- [Lead Sources](./LEAD_SOURCES.md)
- [Schedules](./SCHEDULES.md)
- [Readiness](./READINESS.md)
- [Known Limits and Gotchas](../ODCRM_KNOWN_LIMITS_AND_GOTCHAS.md)
