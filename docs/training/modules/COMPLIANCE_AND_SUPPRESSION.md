# Compliance and Suppression

## Purpose
Use the `Suppression List` sub-tab to protect contacts from outreach. The page body is titled `Compliance`, but this module is the current suppression/DNC workspace.

Operationally, this tab answers:
- who must not be contacted,
- whether email and domain protection are configured,
- whether sheet-based protection imported correctly,
- whether the client looks safe to launch.

## You are here in the workflow
Use this tab after selecting the correct client and before starting live outreach.

What should already be true:
- you know which client you are working on,
- you have the Google Sheet URL if you are connecting or replacing a protection source.

Where users usually go next:
- [Readiness](./READINESS.md) for a compact safety summary,
- [Sequences](./SEQUENCES.md) before live launch,
- [Inbox](./INBOX.md) when an opt-out came from a real reply.

## When a user should use this tab
Use this tab when you need to:
- review whether email and domain protection are configured,
- add a protected email or domain manually,
- connect or replace a Google Sheet source for suppression,
- re-sync suppression data,
- review what ODCRM currently treats as protected.

## Before you start
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
| Field | What it means | Editable, derived, or informational |
|---|---|---|
| `Client` | Which client's suppression data you are managing. | Informational/current context |
| `Value` | The email address or domain to protect. | Editable |
| `Reason (optional)` | Operator note explaining why the suppression exists. | Editable |
| `Google Sheet URL` | The source sheet used for suppression import. | Editable |

## Email DNC vs Domain DNC
### Email suppression
Use this when you need to block one exact email address.

### Domain suppression
Use this when you need to block a whole domain.

### Why the difference matters
- email suppression protects one exact address,
- domain suppression protects everyone on that domain,
- ODCRM exposes both because the operational effect is different.

## Recommended operator path
1. Select the correct client.
2. Review email and domain protection cards.
3. Add urgent manual protection rows if needed.
4. Connect or refresh sheet-based protection.
5. Review the table counts and actual rows.
6. Only then treat the client as safely protected.

## Click-by-click workflows
### Add a manual protected email or domain
1. Open `Suppression List`.
2. Select the correct client.
3. Switch to `Email suppression` or `Domain suppression`.
4. Enter the `Value`.
5. Optionally enter a `Reason`.
6. Click `Add protection`.
7. Confirm the entry appears in the list.

Expected result:
- the selected email or domain is added to the client-scoped protection list.

### Connect a suppression sheet
1. Open `Suppression List`.
2. Select the correct client.
3. Switch to the correct suppression type.
4. Open the source settings area.
5. Paste the `Google Sheet URL`.
6. Click `Connect source`.
7. Wait for sync to finish.
8. Review the protection cards and the entries table.

Expected result:
- ODCRM links the source and imports sheet-managed protection rows.

### Replace or re-sync a source
1. Open the relevant email or domain source section.
2. Click `Re-sync source` if you want a refresh from the existing linked sheet.
3. Click `Replace source` or `Replace linked source` if the sheet itself has changed.
4. Review the updated counts and health state.
5. Review the table rows, not just the connection status.

Expected result:
- the source link and imported protection data are refreshed.

## Connect sheet vs replace sheet
### Connect source
Use this when there is not already a linked source for that suppression type.

### Replace source / Replace linked source
Use this when the current linked sheet should no longer be the source of truth.

Current implementation truth:
- replace is a real import action,
- replace is not just a label or settings update,
- manual rows are preserved while stale linked-source rows for that source are replaced.

## What happens after connect, replace, or re-sync
- `Connect source` links the source and imports rows.
- `Re-sync source` refreshes from the current linked sheet.
- `Replace source` or `Replace linked source` performs a real replace import against the linked-source rows.
- `Refresh protection status` reloads health and counts.

## Client-specific scope
Suppression is client-specific in current operator truth.

Operator takeaway:
- always confirm the correct client before adding, syncing, replacing, or reviewing protection rows.

## Unsubscribe behavior
### Unsubscribe footer clicks
Current send paths generate unsubscribe links. When a recipient uses that link, ODCRM marks the related outreach record as unsubscribed and uses tracking-based suppression handling to stop future sending for that recipient path.

### Inbox opt-outs
Current visible `Mark as Opt-out` behavior in the Inbox creates an email suppression row for the sender address.

### What operators should expect
- unsubscribe and opt-out behavior should feed back into protection state,
- the current visible inbox path is email-focused,
- operators should not assume a visible inbox opt-out also created domain suppression.

## What operators should check before launching campaigns
Before live launch, confirm:
- the correct client is selected,
- email suppression looks reviewed,
- domain suppression looks reviewed,
- urgent manual blocks have been added,
- connected sheet sources have been refreshed if needed,
- counts and actual rows make sense for the current client.

## Common misunderstanding: counts, status, and import expectations
Common traps:
- `Connected` does not automatically mean many rows imported.
- A source can be linked but still have zero or low useful rows.
- Reviewing the card alone is not enough; users should also review the table.

## How this tab connects to other tabs
- [Sequences](./SEQUENCES.md) and [Schedules](./SCHEDULES.md) rely on suppression to block invalid or protected recipients.
- [Inbox](./INBOX.md) opt-outs feed back into this safety layer.
- [Reports](./REPORTS.md) surface suppression and opt-out trends later.
- [Readiness](./READINESS.md) can surface protection gaps as a blocker or warning.

## Common mistakes / failure states / confusion points
- Confusing the sub-tab label `Suppression List` with the page heading `Compliance`.
- Thinking `Connected` means the sheet definitely contains many rows.
- Thinking `Replace linked source` is config-only. It performs a real replace import.
- Forgetting to switch between `Email suppression` and `Domain suppression` when reviewing counts.

## How to verify success
You are done with this tab when:
- the correct client's protection state is visible,
- manual additions or sheet syncs have completed,
- counts and actual rows both look sensible for that client.

## What to do next
- Go to [Readiness](./READINESS.md) if you want a compact safety check.
- Go to [Sequences](./SEQUENCES.md) if you are ready to test or launch.
- Go to [Inbox](./INBOX.md) if the protection change came from reply handling.

## Reality check notes
- Protection is client-specific.
- The current visible inbox opt-out path is email-focused.
- Send paths enforce suppression beyond what a casual user would see just from this one screen.
