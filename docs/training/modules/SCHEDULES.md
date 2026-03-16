# Schedules

## Purpose
Use `Schedules` to monitor and control outreach that has already moved into the live campaign-backed path.

This tab is not a schedule builder. It is the operator screen for questions like:
- what is currently running,
- what is paused,
- what mailbox is being used,
- when is the next send due,
- what happened recently,
- can I pause, resume, or safely re-test.

## What this screen is actually showing
Current implementation truth:
- a "schedule" here is a live or paused campaign-backed sequence path,
- the screen derives mailbox, linked-sequence, next-send, and outcome information from backend truth,
- users do not configure the whole outreach model here.

Operator translation:
- build in `Sequences`,
- monitor in `Schedules`.

## You are here in the workflow
Use this tab after `Start live sequence` or when a previously launched sequence already exists.

What should already be true:
- the correct client is selected,
- a live or paused sequence-linked campaign already exists.

Where users usually go next:
- `Inbox` to work replies,
- `Reports` to review trends,
- `Sequences` if setup changes are required.

## When a user should use this tab
Use `Schedules` when you need to:
- review live sending status,
- check the linked sequence and mailbox,
- see the next send timing,
- inspect recent outcomes,
- pause or resume live sending,
- run a safe test batch when the linked sequence path allows it.

## Before you start
- A client must be selected.
- There must already be a running or paused sequence-linked live campaign.

## What the user sees on screen
Main areas:
- summary cards,
- `Schedules to review`,
- selected `Schedule summary`,
- `Follow-up & troubleshooting`,
- `Recent outcomes`,
- `Upcoming sends`.

## Main actions available
- `Open summary`
- `Summary open`
- `Run safe test batch`
- `Pause schedule`
- `Resume schedule`
- `Refresh schedules`
- `Refresh follow-up detail`

You may also see quick row-level `Pause` or `Resume` actions.

## What each key schedule field means
| Field | Operator meaning | Editable here or derived |
|---|---|---|
| `Status` | Whether the live path is running, paused, waiting, blocked, or needs attention. | Derived |
| `Linked sequence` | The sequence definition this live schedule is tied to. | Derived |
| `Mailbox` | The sender identity currently associated with the schedule. | Derived |
| `Daily cap` | The effective mailbox sending cap affecting what can happen today. | Derived from mailbox/live state |
| `Send window` | The allowed send-time window associated with the schedule/mailbox path. | Derived here; configured elsewhere |
| `Next send` | The next expected live send time, if ODCRM has one queued. | Derived |
| `Upcoming sends` | Future scheduled send rows waiting to go out. | Derived |
| `Recent outcomes` | Recent send results and operational feedback. | Derived |

## Recommended operator path
1. Open `Schedules`.
2. Select the correct client.
3. Review the summary cards.
4. Click `Open summary` on the relevant schedule.
5. Read the top operator message first.
6. Review `Status`, `Linked sequence`, `Mailbox`, `Daily cap`, `Send window`, and `Next send`.
7. Review `Recent outcomes` and `Upcoming sends`.
8. Pause or resume only if a real operational change is required.

## Advanced or edge path
The safe-test action is useful, but it is not the same as the live send path.

Treat `Run safe test batch` as:
- a linked sequence test action,
- not a "send the live schedule now" action,
- subject to mailbox-mismatch and test-prerequisite rules.

## Click-by-click workflows
### Review schedule status
1. Click `Schedules`.
2. Select the correct client.
3. Review the top summary cards.
4. In `Schedules to review`, click `Open summary` on the relevant row.
5. Read the summary message first.
6. Review `Status`.
7. Review `Linked sequence`.
8. Review `Mailbox`.
9. Review `Daily cap`.
10. Review `Send window`.
11. Review `Next send`.
12. Review `Recent outcomes`.
13. Review `Upcoming sends`.

Expected result:
- you understand what the live path is doing and what should happen next.

### Pause live sending
1. Open the schedule summary.
2. Click `Pause schedule`.
3. Confirm the status switches to paused.
4. Click `Refresh schedules` if you want an extra confirmation pass.

Expected result:
- the live campaign-backed path stops active progression until resumed.

### Resume live sending
1. Open the schedule summary.
2. Click `Resume schedule`.
3. Confirm the status switches away from paused.
4. Review `Next send` and `Upcoming sends`.

Expected result:
- the live path becomes eligible to continue according to current backend truth.

### Run a safe test batch from the schedule view
1. Open the schedule summary.
2. Confirm the linked sequence exists.
3. Confirm the schedule mailbox and sequence mailbox match.
4. Click `Run safe test batch` only if the button is enabled.
5. Review the follow-up detail and send results.

Expected result:
- ODCRM runs the linked sequence's safe test path, not the live campaign send path.

## Mailbox mismatch limitation
If the schedule mailbox and linked sequence mailbox do not match:
- the schedule can still appear otherwise healthy,
- `Run safe test batch` is disabled,
- the operator should fix the mailbox relationship in the sequence path instead of treating the schedule screen as broken.

## What users cannot configure here
Users often expect to change these in `Schedules`, but this screen is not the main place for it:
- sequence step content,
- live recipient source,
- sender selection,
- template selection,
- step delays,
- core launch configuration.

Those belong in [Sequences](./SEQUENCES.md) or other setup tabs.

## What happens after each action
- `Pause schedule` and `Resume schedule` toggle the underlying live campaign status.
- `Refresh schedules` reloads the live campaign-backed schedule view.
- `Run safe test batch` uses the linked sequence test-send path, not the live campaign send path directly.

## How this tab connects to other tabs
- [Sequences](./SEQUENCES.md) is where you build and launch the underlying sequence.
- [Readiness](./READINESS.md) helps explain why a schedule is blocked or needs attention.
- [Inbox](./INBOX.md) and [Reports](./REPORTS.md) help explain what happened after the sends.

## Common mistakes / failure states / confusion points
- Thinking `Schedules` is a full schedule builder. It is not.
- Thinking `Run safe test batch` sends the live campaign directly. It uses the linked sequence test path.
- Ignoring mailbox mismatch messages. If the schedule mailbox and linked sequence mailbox differ, ODCRM blocks test-now behavior.
- Expecting draft or completed campaigns to appear here. This tab focuses on running or paused sequence-linked live state.

## How to verify success
You are done with this tab when:
- you know the live schedule status,
- you know whether a pause/resume change succeeded,
- you know whether the next action belongs in `Inbox`, `Reports`, or `Sequences`.

## What to do next
- Go to [Inbox](./INBOX.md) if reply handling is next.
- Go to [Reports](./REPORTS.md) if trend review is next.
- Go to [Sequences](./SEQUENCES.md) if launch configuration needs to change.

## Reality check notes
- Backend truth for a "schedule" is a running or paused campaign linked to a sequence.
- This tab intentionally hides much of the builder complexity and shows the operational monitoring truth instead.
- `Run safe test batch` can be unavailable even when the schedule itself looks healthy if the linked test prerequisites are not present.
