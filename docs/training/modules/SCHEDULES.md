# Schedules

## Purpose
Use `Schedules` to monitor and control active or paused outreach that is already linked to a sequence.

This is not the place to build a schedule from scratch. Treat it as the live-monitoring tab.

## When a user should use this tab
Use `Schedules` when you need to:
- review live sending status,
- check the linked sequence and mailbox,
- see the next send timing,
- inspect recent outcomes,
- pause or resume live sending,
- run a safe test batch when the linked sequence path allows it.

## Prerequisites
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
| Field | Operator meaning |
|---|---|
| `Status` | Whether the live path is currently sending, paused, waiting, or needs attention. |
| `Linked sequence` | The sequence definition this live schedule is tied to. |
| `Mailbox` | The sender identity currently associated with the schedule. |
| `Daily cap` | The effective mailbox sending cap affecting what can happen today. |
| `Send window` | The allowed send-time window associated with the schedule/mailbox path. |
| `Next send` | The next expected live send time, if ODCRM has one queued. |
| `Upcoming sends` | Future scheduled send rows waiting to go out. |
| `Recent outcomes` | Recent send results and operational feedback. |

## Step-by-step common workflows
### Review schedule status
1. Click `Schedules`.
2. Select the correct client.
3. Review the top summary cards.
4. In `Schedules to review`, click `Open summary` on the relevant row.
5. Read the schedule summary message first.
6. Review mailbox, linked sequence, next send, and recent outcomes.

### Pause live sending
1. Open the schedule summary.
2. Click `Pause schedule`.
3. Confirm the status switches to paused.
4. Refresh the schedule detail if you need confirmation.

### Resume live sending
1. Open the schedule summary.
2. Click `Resume schedule`.
3. Confirm the status switches back to running.
4. Review `Upcoming sends`.

### Run a safe test batch from the schedule view
1. Open the schedule summary.
2. Confirm the linked sequence exists.
3. Confirm the schedule mailbox and sequence mailbox match.
4. Click `Run safe test batch` only if the button is enabled.
5. Review the follow-up detail and send results.

## What happens after each action
- `Pause schedule` and `Resume schedule` toggle the underlying live campaign status.
- `Refresh schedules` reloads the live campaign-backed schedule view.
- `Run safe test batch` uses the linked sequence test-send path, not the live campaign send path directly.

## How this tab connects to other tabs
- `Sequences` is where you build and launch the underlying sequence.
- `Schedules` is where you monitor the live effect of that launch.
- `Readiness` helps explain why a schedule is blocked or needs attention.
- `Inbox` and `Reports` help you understand what happened after sending.

## Common mistakes / failure states / confusion points
- Thinking `Schedules` is a full schedule builder. It is not.
- Thinking `Run safe test batch` sends the live campaign directly. It uses the linked sequence test path.
- Ignoring mailbox mismatch messages. If the schedule mailbox and linked sequence mailbox differ, ODCRM blocks test-now behavior.
- Expecting draft or completed campaigns to appear here. This tab focuses on running or paused sequence-linked live state.

## Operational tips
- Start here for live monitoring after a launch.
- Use the operator message at the top of the summary before diving into detailed tables.
- If you need to change sequence content, go back to `Sequences`, not `Schedules`.

## Reality check notes
- Backend truth for a "schedule" is a running or paused campaign linked to a sequence.
- This tab intentionally hides much of the builder complexity and shows the operational monitoring truth instead.
- The `Run safe test batch` action can be unavailable even when the schedule itself looks healthy if the linked test prerequisites are not present.

## Related docs / next steps
- [Sequences](./SEQUENCES.md)
- [Readiness](./READINESS.md)
- [Inbox](./INBOX.md)
- [Reports](./REPORTS.md)
