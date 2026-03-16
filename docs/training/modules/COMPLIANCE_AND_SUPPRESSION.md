# Compliance and Suppression

## Purpose
Use the `Suppression List` sub-tab to protect contacts from outreach. The page content is titled `Compliance`, but this module is the current suppression/DNC workspace.

## When a user should use this tab
Use this tab when you need to:
- review whether email and domain protection are configured,
- add a protected email or domain manually,
- connect or replace a Google Sheet source for suppression,
- re-sync suppression data,
- review what ODCRM currently treats as protected.

## Prerequisites
- A client must be selected.
- If using a sheet source, you need a valid Google Sheet URL.

## What the user sees on screen
Main areas:
- page heading `Compliance`,
- client card,
- top protection-status alert,
- protection cards for email and domain suppression,
- manual add panel `Add protected email or domain`,
- suppression entries table,
- pagination,
- `Source setup & troubleshooting`.

## Main actions available
- `Email suppression`
- `Domain suppression`
- `Review protected emails`
- `Review protected domains`
- `Add protection`
- `Connect source`
- `Replace source`
- `Re-sync source`
- `Refresh protection status`
- `Sync source now`
- `Show source settings`
- `Hide source settings`
- `Replace linked source`
- `Open linked source`
- `Previous`
- `Next`

## Field-by-field explanation
| Field | What it means | Why it matters |
|---|---|---|
| `Client` | Which client's suppression data you are managing. | Suppression is client-specific. |
| `Value` | The email address or domain to protect. | ODCRM lowercases and normalizes these values. |
| `Reason (optional)` | Operator note explaining why the suppression exists. | Useful for manual overrides and support follow-up. |
| `Google Sheet URL` | The source sheet used for suppression import. | Drives connect/replace/re-sync behavior for sheet-managed suppression. |

## Email DNC vs Domain DNC
### Email suppression
Use this when you need to block a single email address.

### Domain suppression
Use this when you need to block a whole domain.

### Why the difference matters
- Email suppression protects one exact address.
- Domain suppression protects everyone on that domain.
- ODCRM exposes both because the operational risk is different.

## Step-by-step common workflows
### Add a manual protected email or domain
1. Open `Suppression List`.
2. Select the correct client.
3. Switch to `Email suppression` or `Domain suppression`.
4. Enter the `Value`.
5. Optionally enter a `Reason`.
6. Click `Add protection`.
7. Confirm the entry appears in the list.

### Connect a suppression sheet
1. Open `Suppression List`.
2. Select the correct client.
3. Open the relevant source settings area.
4. Paste the `Google Sheet URL`.
5. Click `Connect source` or `Replace source`.
6. Wait for sync to finish.
7. Review the protection status cards and entry counts.

### Replace or re-sync a source
1. Open the relevant email or domain source section.
2. Click `Re-sync source` if you want a refresh from the existing linked sheet.
3. Click `Replace source` if the sheet itself has changed.
4. Review the updated counts and health state.

## What happens after each action
- Manual add upserts the normalized value and refreshes the health view.
- Delete removes that suppression entry and refreshes the list.
- `Connect source` or `Replace source` performs a real import, not just a visual link update.
- `Replace` removes stale sheet-managed rows for that linked source while keeping manual rows intact.

## What unsubscribes do
### Unsubscribe footer clicks
Current send paths generate unsubscribe links. When a recipient uses that link, ODCRM marks the related outreach record as unsubscribed and uses tracking-based suppression handling to stop future sending for that recipient path.

### Inbox opt-outs
Current visible `Mark as Opt-out` behavior in the Inbox creates an email suppression row for the sender address.

### What to tell operators
- Use this tab as the source of truth for client-specific protection.
- Treat tracked unsubscribe behavior and manual opt-out actions as things that should eventually be visible here.

## How this tab connects to other tabs
- `Email Accounts` and `Lead Sources` help determine whether the client is ready to send.
- `Sequences` and `Schedules` rely on suppression to block invalid or protected recipients.
- `Inbox` opt-outs feed back into this safety layer.
- `Reports` surface suppression and opt-out trends later.

## Common mistakes / failure states / confusion points
- Confusing the sub-tab label `Suppression List` with the page heading `Compliance`.
- Thinking `Connected` means the sheet definitely contains many rows. A source can be linked but still have zero imported entries.
- Thinking `Replace linked source` is config-only. It performs a real replace import.
- Forgetting to switch between `Email suppression` and `Domain suppression` when reviewing counts.

## Operational tips
- Use manual add for urgent protection changes.
- Use sheet connect/replace for controlled bulk truth.
- After any source update, review both the card status and the actual entry table.

## Reality check notes
- Protection is client-specific.
- The current visible inbox opt-out path is email-focused.
- Send paths enforce suppression beyond what a casual user would see just by looking at this one screen.

## Related docs / next steps
- [Inbox](./INBOX.md)
- [Readiness](./READINESS.md)
- [Schedules](./SCHEDULES.md)
- [Known Limits and Gotchas](../ODCRM_KNOWN_LIMITS_AND_GOTCHAS.md)
