# Inbox

## Purpose
Use `Inbox` to review stored conversations, monitor recent replies, send replies, and record opt-outs.

## When a user should use this tab
Use this tab when you need to:
- work reply conversations,
- focus on inbound messages that need review,
- refresh stored mailbox data,
- send a reply from ODCRM,
- mark an email address as opted out,
- move from reply review back into Sequences, Reports, or Readiness.

## Prerequisites
- A client must be selected.
- Active mailboxes should already exist if you expect refresh to pull recent inbox data.

## What the user sees on screen
Two main modes:
- `Conversations`
- `Recent replies`

Other visible areas:
- client selector,
- time-window selector (`Last 7 days`, `Last 30 days`, `Last 90 days`),
- conversation list and message thread,
- reply composer,
- follow-up links (`Open Sequences`, `Open Reports`, `Back to Readiness`),
- `Follow-up & troubleshooting`.

## Main actions available
- `Needs action only`
- `All conversations`
- `Open recent replies`
- `Open conversations`
- `Send Reply`
- `Mark as Opt-out`
- `Check for new messages`
- `Open Sequences`
- `Open Reports`
- `Back to Readiness`

## Field-by-field explanation
| Control | What it means |
|---|---|
| `Conversations` / `Recent replies` | Choose the working inbox view or the reply-monitoring slice. |
| `Last 7 days` / `Last 30 days` / `Last 90 days` | Filters the time range of what you are viewing. |
| `Needs action only` | Filters the conversation list toward unread/inbound work that still needs review. |
| `Search contacts, companies, campaigns, or reply text...` | Search inside the recent-replies view. |
| `Type your reply...` | Reply body field for thread replies. |

## Step-by-step common workflows
### Work reply conversations
1. Click `Inbox`.
2. Select the correct client.
3. Stay on `Conversations`.
4. Click `Needs action only` if you want a tighter work queue.
5. Open a thread.
6. Read the message history.
7. Type a reply and click `Send Reply`, or click `Mark as Opt-out` if the sender wants no further contact.

### Check recent detected replies only
1. Open `Inbox`.
2. Switch to `Recent replies`.
3. Choose the date range.
4. Use search if needed.
5. Review the reply table.
6. Switch back to `Conversations` if you need the full message thread to act on it.

### Refresh inbox data
1. Open `Inbox`.
2. Click `Check for new messages`.
3. Wait for the refresh to complete.
4. Re-open the relevant conversation or reply view.

## What happens after each action
- Opening a conversation thread loads stored messages and marks inbound unread messages as read.
- `Send Reply` sends through the mailbox path and stores the outbound metadata.
- `Check for new messages` fetches recent inbox items for active identities and stores unseen inbound metadata.
- Current UI `Mark as Opt-out` creates an email suppression entry for the sender address.

## How this tab connects to other tabs
- `Schedules` shows live sending state.
- `Inbox` handles the replies that result from that sending.
- `Compliance and Suppression` becomes relevant when a contact opts out.
- `Reports` shows the larger outcome picture.
- `Readiness` is the fastest place to jump back if you want the next-action view.

## Common mistakes / failure states / confusion points
- Treating `Recent replies` as the full inbox. It is a reply-monitoring slice, not the whole thread workspace.
- Assuming `Mark as Opt-out` from the current UI also adds domain suppression. The current visible button path adds the email suppression row.
- Relying only on `Needs action only` without sanity-checking the broader conversation list.

## Operational tips
- Use `Conversations` for actual reply handling.
- Use `Recent replies` for quick monitoring and scanning.
- Refresh manually if you believe mailbox truth is newer than what you are seeing in ODCRM.

## Reality check notes
- Inbox views are database-backed stored metadata, not a fresh live Graph read on every screen load.
- Reply freshness depends on refresh/reply-detection behavior.
- Current unread-only behavior should be treated as helpful but not perfect.

## Related docs / next steps
- [Compliance and Suppression](./COMPLIANCE_AND_SUPPRESSION.md)
- [Schedules](./SCHEDULES.md)
- [Reports](./REPORTS.md)
- [Readiness](./READINESS.md)
