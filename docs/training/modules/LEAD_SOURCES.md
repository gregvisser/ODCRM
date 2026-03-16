# Lead Sources

## Purpose
Use `Lead Sources` to connect source sheets, review available lead batches, inspect contacts in those batches, and hand a chosen batch into the sequence workflow.

## When a user should use this tab
Use this tab when you need to:
- connect or replace a source sheet,
- refresh source data from Google Sheets,
- review which batches are available for a source,
- inspect the contacts inside a batch,
- move a reviewed batch into the sequence flow.

## Prerequisites
- A client must be selected.
- You need a normal Google Sheets edit URL for source connection.

## What the user sees on screen
Main areas:
- client selector,
- readiness/status alert,
- source cards for:
  - `Cognism`
  - `Apollo`
  - `Social`
  - `Blackbook`
- `Lead batches` panel,
- `Batch contacts preview` panel,
- column chooser,
- `Source setup & troubleshooting`,
- connect modal.

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
| Field | What it means | Why it matters |
|---|---|---|
| `Select client` | Which client's lead-source setup you are reviewing. | Source configuration is client-scoped. |
| `Date` | Filters batch review to a specific day. | Useful when the source has many batches. |
| `Sheet URL` | Google Sheets edit URL for the source. | ODCRM expects a normal editable sheet URL, not a published CSV link. |
| `Display name` | Operator-friendly label for the sheet connection. | Helps identify the source setup later. |
| `Apply to all accounts` | Makes that source sheet a shared fallback for multiple customers. | This creates shared-source behavior, which operators should understand before using it. |

## Step-by-step common workflows
### Connect a new source sheet
1. Click `Lead Sources`.
2. Select the correct client.
3. On the correct source card, click `Connect source`.
4. Paste the `Sheet URL`.
5. Add a `Display name`.
6. Decide whether `Apply to all accounts` should be enabled.
7. Click `Connect`.
8. Confirm the source status updates.

### Review batches and inspect contacts
1. On a ready source card, click `Review batches`.
2. Adjust the `Date` filter if needed.
3. Choose the batch.
4. Click `Review contacts`.
5. Use `Choose columns` if you need to focus the preview.
6. Review the contact rows.
7. Click `Use in sequence` if this is the batch you want to work with.

### Refresh a stale source
1. Open the source card.
2. Click `Refresh from sheet`.
3. Wait for the counts and timestamps to update.
4. Re-open `Review batches`.

## What happens after each action
- `Connect source` stores the sheet configuration.
- `Refresh from sheet` fetches and fingerprints source rows, updates metadata, and refreshes what ODCRM can review.
- `Review contacts` reads the current batch contact view.
- `Use in sequence` stores the selected batch for the sequence flow and navigates you toward the `Sequences` workspace.

## How this tab connects to other tabs
- `Lead Sources` -> `Sequences`: this is the main handoff.
- `Lead Sources` -> `Readiness`: missing or stale lead data affects readiness.
- `Lead Sources` -> `Reports`: source-side activity appears later in reporting.

## Common mistakes / failure states / confusion points
- Thinking `Use in sequence` starts sending. It does not.
- Using a published CSV URL instead of a normal Google Sheets edit URL.
- Forgetting that a `Shared source` may come from an all-accounts configuration rather than a client-specific sheet.
- Missing the fact that the date filter can fall back to the latest batches when the chosen day has nothing useful.

## Operational tips
- Review contacts before using a batch in Sequences.
- Use `Refresh from sheet` when counts look stale before you assume the batch is missing.
- Be cautious with shared-source setups so operators know which client-specific truth they are really using.

## Reality check notes
- The wired implementation is `LeadSourcesTabNew`, not the older lead-source component still present in the repo.
- Current contact review is live/cached source review, not a promise that full contact materialization already exists everywhere.
- The sequence handoff is stateful and operational, not a final launch action.

## Related docs / next steps
- [Sequences](./SEQUENCES.md)
- [Readiness](./READINESS.md)
- [Reports](./REPORTS.md)
