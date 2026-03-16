# Reports

## Purpose
Use `Reports` to review outcome data for the selected client. This is the current tenant-scoped reporting dashboard, and it is best used for summary review, trend review, and deciding where the next investigation should happen.

## What users should use Reports for
Use Reports to:
- review lead volume against target,
- review source contribution,
- review outreach performance,
- compare mailbox-level performance,
- review compliance and health indicators,
- export CSV summaries.

Use other tabs when you need to act:
- `Inbox` for reply handling,
- `Schedules` for live-status monitoring,
- `Sequences` for launch/test changes,
- `Email Accounts`, `Lead Sources`, or `Suppression List` for prerequisite fixes.

## You are here in the workflow
Use this tab after sending activity already exists or when a manager/operator needs an outcome review.

What should already be true:
- the correct client is selected,
- there is enough activity for reporting to mean something.

## Before you start
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
- client selector `Select client`
- time-window selector:
  - `Last 7 days`
  - `Last 30 days`
  - `Last 90 days`
- `Refresh`
- `Export CSV` in source, sourcer, and outreach sections

## Summary vs drill-down meaning
| Area | How to use it |
|---|---|
| `Overview` | Start here for the shortest high-level summary. |
| `Leads vs target` | Compare lead volume against the target logic for the selected window. |
| `Leads by source` | Compare source contribution. |
| `Top sourcers (by lead count)` | Review top source contributors. |
| `Outreach performance` | Review send/reply/open-style summary signals. |
| `Pipeline` | Review later-stage funnel-style indicators when available. |
| `Performance by mailbox` | Compare sender/mailbox-level performance. |
| `Compliance & health` | Review suppressions, failures, unsubscribes, and related health signals. |
| `Activity trend` | Review time-based movement rather than a single summary snapshot. |

## Key overview values
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

## Recommended operator path
1. Open `Reports`.
2. Select the correct client.
3. Choose the reporting window.
4. Click `Refresh`.
5. Read `Overview` first.
6. Read `Leads vs target`.
7. Read source sections.
8. Read outreach and mailbox sections.
9. Read `Compliance & health`.
10. Use `Activity trend` last.

## Click-by-click workflows
### Review a client's current performance
1. Click `Reports`.
2. Select the client.
3. Choose the time window.
4. Click `Refresh`.
5. Read the overview row first.
6. Check `Leads vs target`.
7. Review `Leads by source` and `Top sourcers (by lead count)`.
8. Review `Outreach performance` and `Performance by mailbox`.
9. Check `Compliance & health` for suppressions and failures.
10. Check `Activity trend` if you need a trend view.

Expected result:
- you know whether performance currently looks healthy, weak, or risky.

### Export source or outreach data
1. Open `Reports`.
2. Select client and window.
3. Scroll to the desired section.
4. Click `Export CSV`.
5. Review the exported file outside the app.

Expected result:
- the CSV downloads locally. Export does not create new report data.

## What metrics are trustworthy/current based on backend truth
Safe operator rule:
- treat the visible dashboard as the current reporting truth for ODCRM,
- treat some later-stage metrics as partial if the UI shows them as unavailable or sparse.

Specific caution points:
- `Positive replies` can be unavailable.
- `Meetings booked` can be unavailable.
- older reporting routes still exist in the repo, but the current dashboard is the operator-facing source of truth.

## What happens after each action
- `Refresh` reloads all major reporting dashboard endpoints in parallel.
- `Export CSV` is client-side download behavior. It does not generate new report rows.

## What operators should do after spotting an issue in Reports
- If the issue is current live-state behavior, go to [Schedules](./SCHEDULES.md).
- If the issue is replies or opt-outs, go to [Inbox](./INBOX.md).
- If the issue is sender health, go to [Email Accounts](./EMAIL_ACCOUNTS.md).
- If the issue is source volume or source quality, go to [Lead Sources](./LEAD_SOURCES.md).
- If the issue is launch/test path quality, go to [Sequences](./SEQUENCES.md).
- If the issue is compliance or suppression, go to [Compliance and Suppression](./COMPLIANCE_AND_SUPPRESSION.md).

## Common mistakes / failure states / confusion points
- Expecting Reports to act like a live mailbox screen. It is historical/dashboard truth.
- Assuming every metric is fully implemented. Some values can show as not available yet.
- Confusing the current reporting dashboard with older reporting code/routes still present in the repo.

## How to verify success
You are done with this tab when:
- you understand which section is healthy or weak,
- you know which operational tab should be used next,
- you are not overclaiming precision for metrics the dashboard does not fully populate yet.

## What to do next
- Go to [Inbox](./INBOX.md) for reply-side issues.
- Go to [Schedules](./SCHEDULES.md) for live-state issues.
- Go to [Sequences](./SEQUENCES.md) or setup tabs if the issue is upstream.

## Reality check notes
- The current visible reporting surface is the reporting dashboard backed by `/api/reporting/*`.
- Some metrics such as positive replies and meetings booked are not yet fully populated in backend truth and may appear unavailable.
- Targets vary by reporting window length, so short and long windows are not using identical target logic.
