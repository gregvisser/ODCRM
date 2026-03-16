# Email Accounts

## Purpose
Use `Email Accounts` to connect and manage the mailboxes ODCRM uses for sending. This tab controls the sender identities that affect:
- template preview context,
- sender signatures,
- sequence sending,
- live schedule activity,
- mailbox-based readiness.

## You are here in the workflow
Use this tab after selecting the correct client and before relying on templates, sequences, or schedules.

What should already be true:
- you know which client you are working on,
- you are ready to connect or check a sender mailbox.

What usually comes next:
- [Templates](./TEMPLATES.md) if you need to preview or build copy,
- [Sequences](./SEQUENCES.md) if you need to test or launch sending,
- [Readiness](./READINESS.md) if you want the shortest summary of mailbox-related blockers.

## When a user should use this tab
Use this tab when you need to:
- connect an Outlook mailbox,
- confirm mailbox health,
- adjust daily send limits,
- set or update the mailbox signature,
- confirm the sending window,
- send a mailbox test email.

## Before you start
- A client must be selected.
- For Outlook connect, you must be able to complete the Microsoft sign-in and consent flow.

## What the user sees on screen
Main areas:
- client selector,
- summary cards:
  - `Connected mailboxes`
  - `Ready to send`
  - `Need attention`
  - `Outlook mailboxes`
- mailbox list/table,
- `Follow-up & troubleshooting`,
- `Mailbox safety cap`,
- `Mailbox health details`,
- edit modal `Edit Email Account`.

## What each summary card means
| Card | What it tells the operator |
|---|---|
| `Connected mailboxes` | How many active mailboxes ODCRM currently sees for the selected client. |
| `Ready to send` | How many mailboxes are currently interpreted as usable. |
| `Need attention` | How many mailboxes currently look risky or incomplete. |
| `Outlook mailboxes` | How many of the current active mailboxes are Outlook identities. |

## Main actions available
Buttons and row actions you will commonly use:
- `Connect Outlook`
- `Connect Outlook mailbox`
- `Manage mailbox`
- `Send test email`
- `Turn off mailbox`
- `Turn on mailbox`
- `Disconnect mailbox`
- `Refresh mailbox status`
- `Save Changes`
- `Cancel`

## Field-by-field explanation of the mailbox edit modal
| Field | What it means | Editable, derived, or informational |
|---|---|---|
| `Display Name` | Friendly sender name for the mailbox. | Editable |
| `Daily Send Limit` | The mailbox's daily cap. | Editable, but backend-enforced and clamped |
| `Signature HTML` | The mailbox signature content. | Editable |
| `Send Window` | Allowed sending time window for that mailbox. | Editable |

Other screen controls:
- search box `Search mailboxes...`
- status filter options:
  - `All mailboxes`
  - `Ready to send`
  - `Needs attention`

## Recommended operator path
1. Select the correct client.
2. Connect Outlook if no usable mailbox exists.
3. Open `Manage mailbox`.
4. Review display name, daily limit, signature, and send window.
5. Save changes if needed.
6. Use `Send test email`.
7. Only then treat the mailbox as truly ready for sequence work.

## Advanced or edge path
Use these carefully:
- `Turn off mailbox`
- `Disconnect mailbox`

These are operationally real, but they can remove the mailbox from the active list and create confusion if used casually.

## Click-by-click workflows
### Connect a mailbox
1. Open `OpensDoors Marketing -> Email Accounts`.
2. Confirm the correct client is selected.
3. Click `Connect Outlook` or `Connect Outlook mailbox`.
4. Complete the Microsoft sign-in flow.
5. Return to ODCRM.
6. Confirm the mailbox appears in the list.
7. Click `Manage mailbox`.
8. Review the settings.

Expected result:
- the mailbox appears as a sender identity for that client.

### Review whether a mailbox is ready for sending
1. Open `Email Accounts`.
2. Filter to `Needs attention` if you want only the risky rows.
3. Review the visible status/health signals.
4. Open `Manage mailbox`.
5. Review `Daily Send Limit`.
6. Review `Signature HTML`.
7. Review `Send Window`.
8. Click `Refresh mailbox status` if you changed anything.

Expected result:
- you know whether the mailbox is safe to use in a sequence or schedule path.

### Send a mailbox test email
1. Open `Email Accounts`.
2. Find the mailbox row.
3. Click `Send test email`.
4. Confirm the test succeeds.

Expected result:
- the mailbox proves it can still send through the current Outlook path.

## What happens after each action
- `Connect Outlook` redirects into Microsoft OAuth and creates or updates a sender identity when the callback completes.
- `Save Changes` patches mailbox settings, reloads the list, and closes the modal.
- `Send test email` uses the Outlook send path and may refresh the mailbox token first.
- `Turn off mailbox` changes the mailbox to inactive.
- `Disconnect mailbox` also disables the current identity.

## How this tab connects to other tabs
- [Templates](./TEMPLATES.md): sender fields and signature rendering depend on mailbox data.
- [Sequences](./SEQUENCES.md): a usable sender mailbox is required to save and launch properly.
- [Schedules](./SCHEDULES.md): live schedule summaries show mailbox-based state.
- [Readiness](./READINESS.md): mailbox health shows up as blockers or warnings.

## Common account problems
- the daily cap is too high in the user's expectations but is clamped by backend truth,
- the mailbox connects but was never test-sent,
- the mailbox signature was never reviewed,
- the mailbox was turned off and then appears to vanish from the active list,
- the wrong client was selected during connect or review.

## How to verify an account is ready for sending
Treat a mailbox as ready only when all of these are true:
- it appears in the active mailbox list,
- it does not show obvious health problems,
- its daily limit looks sensible,
- its signature is reviewed,
- its send window is reviewed,
- `Send test email` succeeds.

## Common mistakes / failure states / confusion points
- Thinking the daily limit can be set arbitrarily high. Current backend truth clamps the limit to 30 per mailbox.
- Treating `Turn off mailbox` as a harmless visible toggle. Inactive mailboxes can disappear from the current active list response.
- Assuming a successful connect means the mailbox is fully production-ready. You still need to review cap, signature, window, and test send.
- Expecting SMTP account creation from this marketing tab. The current visible operator path is Outlook connect.

## What to do next
- Go to [Templates](./TEMPLATES.md) if you need content work.
- Go to [Sequences](./SEQUENCES.md) if you are ready to test or launch.
- Go to [Readiness](./READINESS.md) if you want the shortest summary of whether mailbox issues are still blocking progress.

## Reality check notes
- Outlook connect enforces a maximum of 5 active Outlook identities per client.
- The operator-visible list only returns active identities, which is why a turned-off mailbox can seem to vanish.
- Current backend safety rails enforce low daily caps compared with older operator expectations.

