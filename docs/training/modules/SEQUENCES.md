# Sequences

## Purpose
Use `Sequences` to build reusable outreach step plans, test them safely, and then launch the live sending path.

This is the most important module to understand correctly because ODCRM currently combines:
- reusable sequence setup,
- test audience handling,
- live launch behavior,
- diagnostics and audit-style follow-up.

## What a sequence is in the current implementation
A sequence in ODCRM is not just one thing.

Current implementation truth:
- the saved `sequence` is the reusable definition and step structure,
- the `test audience` path uses enrollments and queue-backed send items,
- the `Start live sequence` path copies the sequence into a linked campaign-backed send flow.

Operator translation:
- use the sequence draft to define the outreach steps,
- use test audiences to validate safely,
- use live start to move into real sending.

## You are here in the workflow
Use this tab after:
- the correct client is selected,
- at least one sender mailbox exists,
- at least one usable template exists,
- a usable live lead batch/list exists or is close to ready.

Users normally go here after [Templates](./TEMPLATES.md) and [Lead Sources](./LEAD_SOURCES.md), then move to [Schedules](./SCHEDULES.md) after live start.

## Recommended operator path
1. Create or open the sequence.
2. Set the name, live leads snapshot, and sender.
3. Add and review steps.
4. Save the draft.
5. Add a test audience.
6. Run `Send test batch now`.
7. Review results.
8. Use `Start live sequence` only when the live-recipient path is ready.

## Advanced or diagnostic path
Use these only when something needs deeper investigation:
- `Open troubleshooting & audits`
- launch preflight panels
- queue, audit, or preview-vs-outcome panels
- run-history detail panels

These are real and useful, but they are not the recommended day-one operator flow.

## Before you start
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

## Field-by-field explanation of the main sequence setup
| Field | What it means | Editable, derived, or informational |
|---|---|---|
| `Sequence Name` | Operator label for the sequence. | Editable |
| `Leads Snapshot` | The linked live recipient source. | Editable and critical for live start |
| `Sender` | Mailbox used for the sequence. | Editable and critical for send path |
| `Template` | Shared template chosen for each step. | Editable, but copied into the step |
| `Delay after previous step (days)` | Delay before the next step. | Editable |

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
- This is the real live-recipient path.

### Test audience
- Used by `Send test batch now`.
- Comes from active enrollments.
- This is the safe queue-backed path.

### What enrollments are doing in practice
An enrollment is the test-send container for selected test recipients. It creates queue-backed work that ODCRM can use for controlled testing.

Operator translation:
- test audience = test recipients,
- enrollment = ODCRM's saved test-send container for them,
- live start = separate path using linked live recipients.

## Click-by-click workflows
### Build a new sequence draft
1. Click `Sequences`.
2. Select the correct client.
3. Click `New Sequence`.
4. Enter `Sequence Name`.
5. Choose `Leads Snapshot`.
6. Choose `Sender`.
7. Add at least one step.
8. For each step, choose a `Template`.
9. Review the copied subject and body.
10. Set `Delay after previous step (days)`.
11. Click `Save draft`.

Expected result:
- the sequence is saved and ready for test-audience work.

### Add a test audience and run a test batch
1. Open the saved sequence.
2. Click `Add test audience`.
3. Choose `Use linked lead batch recipients` or `Use manual test recipients`.
4. Enter or confirm the recipients.
5. Click `Save test recipients`.
6. Click `Send test batch now`.
7. Click `View send results`.
8. Review what sent, failed, or was blocked.

Expected result:
- only test recipients are used.
- the live-recipient path is not launched.

### Start the live sequence
1. Save the sequence draft first.
2. Confirm the live lead batch/list is linked.
3. Confirm the sender mailbox is correct.
4. Review sequence steps and content.
5. Click `Review before start` if needed.
6. Click `Start live sequence`.
7. Confirm the launch dialog.
8. Move to `Schedules` and `Readiness`.

Expected result:
- the live campaign-backed path starts using the linked live recipients.

## Difference between live launch and test send
| Action | Uses | What it is for |
|---|---|---|
| `Send test batch now` | active test recipients from enrollments | safe validation |
| `Start live sequence` | linked live recipients | real live launch |

## What happens after each action
### Save draft
- Saves or updates the reusable sequence definition.
- Saves step rows.
- Creates or updates the linked draft campaign record used for later live-start behavior.

### Send test batch now
- Sends only to due test recipients from active enrollments.
- Current test-send behavior is intentionally conservative.
- `View send results` is the main operator follow-up.

### Start live sequence
- Copies the sequence steps into the linked campaign-backed sending path.
- Uses the linked live recipients, not the test audience.
- Marks the campaign for active sending and later schedule visibility.

### Pause sequence
- In practice this pauses the linked live campaign path, not the reusable sequence definition itself.

## What paused or cancelled means operationally
- `Pause sequence` affects the live campaign-backed path.
- Test enrollments can also have their own `Pause`, `Resume`, or `Cancel` state in the test-side flow.
- A paused live path is not the same thing as an unsaved draft.

## How to interpret current state
### If you see blockers before start
You are still in setup mode. Fix mailbox, lead, suppression, or template issues first.

### If test send results are weak
Stay in `Sequences`, review the test-side results, and do not treat the live path as cleared yet.

### If live sending is already active
Move to `Schedules` for current live monitoring and `Inbox` for reply work.

## What users should check before going live
Before clicking `Start live sequence`, confirm:
- the correct client is selected,
- the sequence is saved,
- the live recipient source is linked,
- the sender mailbox is correct,
- template content looks right,
- test results look acceptable,
- major readiness warnings have been reviewed.

## How this tab connects to other tabs
- [Templates](./TEMPLATES.md) provide step content.
- [Lead Sources](./LEAD_SOURCES.md) provide the live audience handoff.
- [Email Accounts](./EMAIL_ACCOUNTS.md) provide the sender mailbox.
- [Readiness](./READINESS.md) summarizes launch blockers and preview-vs-outcome follow-up.
- [Schedules](./SCHEDULES.md) monitor live sending after launch.

## Common mistakes / failure states / confusion points
- mixing up test audience and live audience,
- thinking `Start live sequence` uses manual test recipients,
- forgetting that step content is copied from the shared template,
- treating every diagnostics panel as part of the basic operator workflow,
- trying to delete a sequence that is still referenced by a campaign.

## How to verify success
You are done with the draft stage when:
- the sequence is saved,
- the steps are visible and correct,
- the sender and live snapshot are correct,
- a test audience can be added.

You are done with the launch stage when:
- the live sequence starts,
- `Schedules` reflects the live path,
- `Readiness` no longer reads like a draft-only setup state.

## What to do next
- Go to [Schedules](./SCHEDULES.md) after live launch.
- Go to [Inbox](./INBOX.md) when replies start arriving.
- Go to [Reports](./REPORTS.md) for wider outcome review.

## Reality check notes
- Current implementation mixes operator flow and deep diagnostics in the same tab.
- The queue-backed test path is not identical to the live campaign-backed path.
- Current queue-backed test sending is conservative and should not be treated as a full simulation of all live behavior.
