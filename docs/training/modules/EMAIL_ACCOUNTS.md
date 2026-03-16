# Email Accounts

## Purpose
Use `Email Accounts` to connect and manage the mailboxes ODCRM uses for sending. This is the mailbox readiness tab for operators.

## When a user should use this tab
Use this tab when you need to:
- connect an Outlook mailbox,
- confirm mailbox health,
- adjust daily send limits,
- set or update the mailbox signature,
- confirm the sending window,
- send a mailbox test email.

## Prerequisites
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

## Main actions available
Buttons and actions you will commonly use:
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
| Field | What it means | Why it matters |
|---|---|---|
| `Display Name` | Friendly sender name for the mailbox. | This affects how the sender appears in messages. |
| `Daily Send Limit` | The mailbox's daily cap. | This is enforced downstream and affects whether the mailbox is treated as ready or capped out. |
| `Signature HTML` | The mailbox signature content. | ODCRM can render this through `{{email_signature}}` in templates. |
| `Send Window` | Allowed sending time window. | This affects when the system can use the mailbox. |

Other screen controls:
- Search box `Search mailboxes...`
- Status filter options:
  - `All mailboxes`
  - `Ready to send`
  - `Needs attention`

## Step-by-step common workflows
### Connect a mailbox
1. Open `Email Accounts`.
2. Select the correct client.
3. Click `Connect Outlook` or `Connect Outlook mailbox`.
4. Complete the Microsoft sign-in flow.
5. Return to ODCRM.
6. Confirm the mailbox appears in the list.
7. Open `Manage mailbox` and review the daily limit, signature, and send window.

### Review whether a mailbox is safe to use
1. Open `Email Accounts`.
2. Filter to `Needs attention` if you only want problem mailboxes.
3. Review the readiness/health messaging.
4. Open `Manage mailbox` if you need to update cap, signature, or window.
5. Click `Refresh mailbox status` after making changes.

### Send a mailbox test email
1. Open `Email Accounts`.
2. Find the mailbox.
3. Use `Send test email`.
4. Confirm the test succeeds before treating the mailbox as fully ready for sequence work.

## What happens after each action
- `Connect Outlook` redirects into Microsoft OAuth and creates or updates a sender identity when the callback completes.
- `Save Changes` patches the mailbox settings, reloads the list, and closes the modal.
- `Send test email` uses the Outlook send path and may refresh the mailbox token first.
- `Turn off mailbox` changes the mailbox to inactive.
- `Disconnect mailbox` also disables the current identity.

## How this tab connects to other tabs
- `Templates`: sender fields and signature rendering depend on mailbox data.
- `Sequences`: a usable sender mailbox is required to save and launch properly.
- `Schedules`: live schedule summaries show mailbox-based state.
- `Readiness`: mailbox health shows up as readiness blockers or warnings.

## Common mistakes / failure states / confusion points
- Thinking the daily limit can be set arbitrarily high. Current backend truth clamps the limit to 30 per mailbox.
- Treating `Turn off mailbox` as a harmless visible toggle. Inactive mailboxes can disappear from the current active list response.
- Assuming a successful connect means the mailbox is fully production-ready. You still need to review cap, window, and test send.
- Expecting SMTP account creation from this marketing tab. The current visible operator path is Outlook connect.

## Operational tips
- Manage signature and send-window settings immediately after connect, not later.
- Use the mailbox test action before sequence testing.
- If a mailbox shows up as risky or capped, treat that as a real downstream sending constraint.

## Reality check notes
- Outlook connect enforces a maximum of 5 active Outlook identities per client.
- The operator-visible list only returns active identities, which is why a turned-off mailbox can seem to vanish.
- Current backend safety rails enforce low daily caps compared with legacy expectations.

## Related docs / next steps
- [Templates](./TEMPLATES.md)
- [Sequences](./SEQUENCES.md)
- [Schedules](./SCHEDULES.md)
- [Readiness](./READINESS.md)
