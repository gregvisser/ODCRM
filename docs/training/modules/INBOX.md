# Inbox

## Purpose
Use `Inbox` to review stored conversations, monitor recent replies, send replies, and record opt-outs.

Operationally, this tab answers:
- who replied,
- what needs human follow-up,
- who should no longer be contacted,
- whether inbox data needs a refresh.

## You are here in the workflow
Use this tab after sending is already happening or when reply handling is the next real task.

What should already be true:
- a client is selected,
- at least one active mailbox exists if you expect inbox refresh to matter,
- schedules or campaigns have already created recipient activity.

Where users usually go next:
- `Suppression List` if they want to confirm opt-out protection,
- `Reports` if they want broader outcome context,
- `Readiness` if they want to jump back to the compact next-action view.

## When a user should use this tab
Use this tab when you need to:
- work reply conversations,
- focus on inbound messages that need review,
- refresh stored mailbox data,
- send a reply from ODCRM,
- mark an email address as opted out.

## Before you start
- A client must be selected.
- Active mailboxes should already exist if you expect refresh to pull recent inbox data.

## What the user sees on screen
Two main modes:
- `Conversations`
- `Recent replies`

Other visible areas:
- client selector,
- time-window selector:
  - `Last 7 days`
  - `Last 30 days`
  - `Last 90 days`
- conversation list and message thread,
- reply composer,
- follow-up links:
  - `Open Sequences`
  - `Open Reports`
  - `Back to Readiness`
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

## Field and control explanation
| Control | What it means | Editable, derived, or informational |
|---|---|---|
| `Conversations` / `Recent replies` | Choose the full thread workspace or the reply-monitoring slice. | Action control |
| `Last 7 days` / `Last 30 days` / `Last 90 days` | Filters the time range of what you are viewing. | Action control |
| `Needs action only` | Filters toward unread/inbound work that still looks like it needs review. | Derived helper filter |
| `Search contacts, companies, campaigns, or reply text...` | Search inside the recent-replies view. | Action control |
| `Type your reply...` | Reply body field for thread replies. | Editable |

## Recommended operator path
1. Open `Inbox`.
2. Confirm the correct client is selected.
3. Stay in `Conversations` for actual reply handling.
4. Use `Needs action only` as a helper, not as the only source of truth.
5. Open the thread.
6. Reply or opt out.
7. Use `Check for new messages` if the stored inbox view looks stale.

## Advanced or edge path
`Recent replies` is useful for scanning and triage, but it is not the full inbox workspace.

Treat it as:
- a focused reply-monitoring view,
- not a full replacement for `Conversations`.

## Click-by-click workflows
### Work reply conversations
1. Click `Inbox`.
2. Select the correct client.
3. Stay on `Conversations`.
4. Click `Needs action only` if you want a tighter work queue.
5. Open a thread.
6. Read the message history.
7. Type a reply and click `Send Reply`, or click `Mark as Opt-out` if the sender wants no further contact.

Expected result:
- the reply is sent, or the sender is protected from future outreach.

### Check recent detected replies only
1. Open `Inbox`.
2. Switch to `Recent replies`.
3. Choose the date range.
4. Use search if needed.
5. Review the reply table.
6. Switch back to `Conversations` if you need the full thread to act on it.

Expected result:
- you have a quick scan of recent reply activity without losing sight of the full thread workspace.

### Refresh inbox data
1. Open `Inbox`.
2. Click `Check for new messages`.
3. Wait for the refresh to complete.
4. Re-open the relevant conversation or reply view.

Expected result:
- ODCRM refreshes stored inbox truth for active identities.

## Opt-out flow
Current visible operator path:
1. Open the relevant conversation.
2. Click `Mark as Opt-out`.
3. Confirm the action if prompted.

Current implementation truth:
- the visible inbox opt-out action creates an email suppression row for the sender address.
- users should not assume that same visible action also created a domain suppression entry.

## What Inbox does not do
Inbox is not:
- a fresh live mailbox read on every screen load,
- the full source of reporting truth,
- the place where users configure templates, sequences, or suppression sources.

## What happens after each action
- Opening a conversation loads stored messages and marks inbound unread messages as read.
- `Send Reply` sends through the mailbox path and stores outbound metadata.
- `Check for new messages` fetches recent inbox items for active identities and stores unseen inbound metadata.
- `Mark as Opt-out` creates an email suppression entry for the sender address in the current visible UI path.

## How this tab connects to other tabs
- [Schedules](./SCHEDULES.md) shows current live sending state.
- [Compliance and Suppression](./COMPLIANCE_AND_SUPPRESSION.md) becomes relevant when a contact opts out.
- [Reports](./REPORTS.md) shows larger outcome trends.
- [Readiness](./READINESS.md) is the fastest route back to a compact next-action view.

## Common mistakes / failure states / confusion points
- Treating `Recent replies` as the full inbox.
- Assuming `Mark as Opt-out` from the current UI also adds domain suppression.
- Relying only on `Needs action only` without sanity-checking the broader conversation list.
- Forgetting that the view is stored metadata and may need refresh.

## How to verify success
You are done with this tab when:
- the reply was sent or the opt-out was applied,
- the conversation state looks updated,
- you know whether the next step belongs in `Suppression List`, `Reports`, or `Readiness`.

## What to do next
- Go to [Compliance and Suppression](./COMPLIANCE_AND_SUPPRESSION.md) if you want to review protection state.
- Go to [Reports](./REPORTS.md) if you want broader outcome context.
- Go to [Readiness](./READINESS.md) if you need the next-action summary.

## Reality check notes
- Inbox views are database-backed stored metadata, not a fresh live Graph read on every screen load.
- Reply freshness depends on refresh and reply-detection behavior.
- Current unread-only behavior should be treated as helpful but not perfect.
