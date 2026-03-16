# Reports

## Purpose
Use `Reports` to review outcome data for the selected client. This is the current tenant-scoped reporting dashboard.

## When a user should use this tab
Use this tab when you need to:
- review lead volume against target,
- review source contribution,
- review sequence performance,
- review mailbox performance,
- review compliance and health signals,
- export CSV summaries.

## Prerequisites
- A client must be selected.

## What the user sees on screen
Main dashboard areas:
- `Overview`
- `Leads vs target`
- `Leads by source`
- `Top sourcers (by lead count)`
- `Outreach performance`
- `Pipeline`
- `Performance by mailbox`
- `Compliance & health`
- `Activity trend`

## Main actions available
- client selector (`Select client`)
- time-window selector:
  - `Last 7 days`
  - `Last 30 days`
  - `Last 90 days`
- `Refresh`
- `Export CSV` in source, sourcer, and outreach sections

## Field-by-field explanation
### Client selector
Choose which client's reporting data you want to review.

### Time window selector
Sets the reporting window used across the dashboard.

### Key overview values
Examples of labels you will see:
- `Leads created`
- `Leads target`
- `% to target`
- `Emails sent`
- `Delivered`
- `Open rate`
- `Reply rate`
- `Replies`
- `Positive replies`
- `Meetings booked`
- `Bounces`
- `Unsubscribes`
- `Suppressions (emails)`
- `Send failures`

## Step-by-step common workflows
### Review a client's current performance
1. Click `Reports`.
2. Select the client.
3. Choose the time window.
4. Click `Refresh`.
5. Read the overview row first.
6. Check `Leads vs target`.
7. Review `Leads by source` and `Top sourcers`.
8. Review `Outreach performance` and `Performance by mailbox`.
9. Check `Compliance & health` for suppressions and failure signals.

### Export source or outreach data
1. Open `Reports`.
2. Select client and window.
3. Scroll to the desired section.
4. Click `Export CSV`.
5. Review the exported file outside the app.

## What happens after each action
- `Refresh` reloads all major reporting dashboard endpoints in parallel.
- `Export CSV` is client-side download behavior. It does not create new report data.

## How this tab connects to other tabs
- `Lead Sources` explains where source-side records come from.
- `Sequences` and `Schedules` explain what is being launched and monitored.
- `Inbox` explains where reply handling happens.
- `Compliance and Suppression` explains some of the opt-out and suppression values you see here.

## Common mistakes / failure states / confusion points
- Expecting Reports to act like a live mailbox screen. It is historical/dashboard truth.
- Assuming every metric is fully implemented. Some values can show as not available yet.
- Confusing the current reporting dashboard with older reporting code/routes still present in the repo.

## Operational tips
- Read top-to-bottom: overview first, then source, then outreach/mailbox, then compliance/trend.
- Use the same date window across review meetings so comparisons stay consistent.

## Reality check notes
- The current visible reporting surface is the reporting dashboard backed by `/api/reporting/*`.
- Some metrics such as positive replies and meetings booked are not yet fully populated in backend truth and may appear unavailable.
- Targets vary by reporting window length, so short and long windows are not using the exact same target logic.

## Related docs / next steps
- [Inbox](./INBOX.md)
- [Lead Sources](./LEAD_SOURCES.md)
- [Sequences](./SEQUENCES.md)
- [Known Limits and Gotchas](../ODCRM_KNOWN_LIMITS_AND_GOTCHAS.md)
