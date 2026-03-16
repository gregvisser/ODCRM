# Lead Sources

## Purpose
Use `Lead Sources` to connect source sheets, review batches, inspect batch contacts, and hand a usable batch into the sequence workflow.

This is the operator answer to:
- where are the current leads coming from,
- are they actually reviewable,
- is there a usable batch for outreach,
- has the right batch been handed into `Sequences`.

## What a lead source is in ODCRM
A lead source here is a client-scoped or shared Google Sheet connection for one of the supported source types:
- `Cognism`
- `Apollo`
- `Social`
- `Blackbook`

The source connection does not send anything by itself. It gives ODCRM source data that can later be reviewed and handed into the sequence flow.

## You are here in the workflow
Use this tab after selecting the client and before relying on `Sequences` for live outreach.

What should already be true:
- you know the correct client,
- you have the correct Google Sheet URL if you are connecting or replacing a source.

Where users usually go next:
- [Sequences](./SEQUENCES.md) after batch review,
- [Readiness](./READINESS.md) if they want a short setup-health summary,
- [Reports](./REPORTS.md) later when they want source-outcome review.

## When a user should use this tab
Use this tab when you need to:
- connect or replace a source sheet,
- refresh source data from Google Sheets,
- review which batches are available,
- inspect the contacts inside a batch,
- hand a reviewed batch into the sequence workflow.

## Before you start
- A client must be selected.
- You need a normal Google Sheets edit URL for source connection.

## What the user sees on screen
Main areas:
- client selector,
- readiness/status alert,
- source cards for `Cognism`, `Apollo`, `Social`, and `Blackbook`,
- `Lead batches` panel,
- `Batch contacts preview` panel,
- column chooser,
- `Source setup & troubleshooting`,
- connect/replace modal or panel.

## Main actions available
- `Review batches`
- `Connect source`
- `Replace source`
- `Review contacts`
- `Reviewing contacts`
- `Use in sequence`
- `Back`
- `Set date to yesterday`
- `Choose columns`
- `Hide columns`
- `Recommended`
- `Show all`
- `Open linked sheet`
- `Refresh from sheet`
- `Connect`
- `Cancel`

## Field-by-field explanation
| Field or control | What it means | Editable, derived, or informational |
|---|---|---|
| `Select client` | Which client's lead-source setup you are reviewing. | Action control |
| `Date` | Filters batch review to a specific day. | Action control |
| `Sheet URL` | Google Sheets edit URL for the source. | Editable |
| `Display name` | Operator-friendly label for the sheet connection. | Editable |
| `Apply to all accounts` | Makes the sheet a shared fallback for customers without their own source. | Editable, but operationally important |

## Recommended operator path
1. Select the correct client.
2. Connect or replace the relevant source.
3. Click `Refresh from sheet` if needed.
4. Click `Review batches`.
5. Pick a recent usable batch.
6. Click `Review contacts`.
7. Check whether the contacts look usable.
8. Click `Use in sequence` only after review.

## What `Use in sequence` actually means
`Use in sequence` is a handoff action.

It means:
- ODCRM stores the selected batch for sequence work,
- the user is pushed toward the sequence workflow.

It does not mean:
- sending started,
- the live campaign launched,
- the batch was already contacted.

## Click-by-click workflows
### Connect a new source sheet
1. Click `Lead Sources`.
2. Select the correct client.
3. On the correct source card, click `Connect source`.
4. Paste the `Sheet URL`.
5. Add a `Display name`.
6. Decide whether `Apply to all accounts` should be enabled.
7. Click `Connect`.
8. Confirm the source status updates.

Expected result:
- the source is linked for that client or as a shared fallback, depending on the chosen setting.

### Review batches and inspect contacts
1. On a ready source card, click `Review batches`.
2. Adjust the `Date` filter if needed.
3. Choose the batch.
4. Click `Review contacts`.
5. Use `Choose columns` if you need a focused view.
6. Review the contact rows.
7. Click `Use in sequence` if this is the batch you want to work with.

Expected result:
- you understand whether the batch looks usable and have handed it into the sequence flow if appropriate.

### Refresh a stale source
1. Open the source card.
2. Click `Refresh from sheet`.
3. Wait for counts and timestamps to update.
4. Re-open `Review batches`.
5. Re-check the contacts if needed.

Expected result:
- ODCRM reloads the source metadata and reviewable batch/contact state.

## How the sheet/source connection affects downstream work
- The source connection makes batches available for review.
- Batch review gives the user confidence that the data is usable.
- `Use in sequence` passes the reviewed batch into the sequence path.
- No part of this tab starts live sending directly.

## How users verify the source is usable
Treat a source as usable only when:
- the correct client is selected,
- the source is connected,
- a usable batch is visible,
- batch contacts can be reviewed,
- the contact preview looks correct enough for outreach,
- the batch can be handed into `Sequences`.

## What to do if counts or imports look wrong
1. Confirm the correct client.
2. Check whether the source is shared or client-specific.
3. Click `Refresh from sheet`.
4. Re-open `Review batches`.
5. Try a different date or use `Set date to yesterday` if appropriate.
6. Open `Review contacts`.
7. Only then conclude the source is stale, missing, or misconfigured.

## What `ready for outreach` really depends on
A lead source is only one part of readiness. A client is not truly ready for outreach unless:
- a mailbox is ready,
- suppression is configured,
- templates exist,
- a sequence is ready,
- the reviewed batch has been handed into the sequence path.

## How this tab connects to other tabs
- [Sequences](./SEQUENCES.md): this is the main handoff.
- [Readiness](./READINESS.md): missing or stale source data can show up as blockers.
- [Reports](./REPORTS.md): source-side activity appears later in reporting.

## Common mistakes / failure states / confusion points
- Thinking `Use in sequence` starts sending. It does not.
- Using a published CSV URL instead of a normal Google Sheets edit URL.
- Forgetting that a shared source may come from an all-accounts configuration rather than a client-specific sheet.
- Missing the fact that a date filter can change what batch view is shown.

## How to verify success
You are done with this tab when:
- the source is connected,
- the batch and contact preview look usable,
- the correct batch has been handed into `Sequences`.

## What to do next
Go to [Sequences](./SEQUENCES.md), then [Readiness](./READINESS.md) if you want a compact check before launch.

## Reality check notes
- The wired implementation is `LeadSourcesTabNew`, not older lead-source components still present in the repo.
- Current contact review is live/cached source review, not a promise that every contact is already materialized everywhere else in the product.
- The sequence handoff is stateful and operational, not a final launch action.
