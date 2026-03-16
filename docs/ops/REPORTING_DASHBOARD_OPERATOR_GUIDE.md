# Reporting Dashboard — Operator Guide

The Reporting Dashboard is the central analytics surface for ODCRM outreach. All numbers are derived from database truth; no metrics are invented or guessed in the frontend.

## What the dashboard reports

- **Overview** — Executive summary: leads created, target, % to target, emails sent, delivered, open rate (if available), reply rate, reply count, bounces, unsubscribes, suppressions, send failures.
- **Leads vs target** — Current period leads vs the client’s lead target (weekly or monthly). Progress bar and trend vs previous period. If no target is set, “No target set” is shown.
- **Leads by source** — Leads broken down by source (channel/sheet). Count and % of total. Export to CSV.
- **Top sourcers** — Users/owners who sourced or imported leads. Count and % of total. Export to CSV.
- **Outreach performance** — By sequence: sent, failed, suppressed, replies, opt-outs. Top sequence. Export to CSV.
- **Pipeline** — Funnel: leads created → contacted → replied → positive (if available) → converted.
- **Performance by mailbox** — Sends, replies, bounces, opt-outs, failures per sending identity.
- **Compliance & health** — Suppressed emails/domains, unsubscribes in period, suppression blocks in period.
- **Activity trend** — Daily breakdown of leads, sent, and replies for the selected period.

## Authoritative metrics

| Metric | Source | Notes |
|--------|--------|--------|
| Leads created | `LeadRecord` count in period (occurredAt or createdAt) | Period = last 7 / 30 / 90 days |
| Leads target | `Customer.weeklyLeadTarget` or `Customer.monthlyLeadTarget` | Depends on period length; no target → “No target set” |
| Emails sent | `EmailEvent` type=sent and/or `OutboundSendQueueItem` status=SENT | |
| Delivered | `EmailEvent` type=delivered | May be null if tracking not in use |
| Open rate | delivered > 0 ? (opened / delivered) * 100 : null | Shown as “Not available yet” if no delivered/opened data |
| Reply rate | (replies / sent) * 100 | |
| Replies | `EmailEvent` type=replied | |
| Bounces / Unsubscribes | `EmailEvent` bounced, opted_out | |
| Suppressions | `SuppressionEntry` counts by type (email, domain) | |
| Contacted | `OutboundSendQueueItem` status=SENT in period | |
| Converted | `LeadRecord` with `convertedToContactId` set in period | |

## Caveats / not-yet-available metrics

- **Positive reply count** — Not stored in the current data model; UI shows “Not available yet”.
- **Meetings booked** — Not in schema; UI shows “Not available yet”.
- **Open rate** — Only shown when we have delivered (and opened) event data; otherwise “Not available yet”.

## How “leads vs target” works

- Target is read from the **customer** record: `weeklyLeadTarget` for periods ≤ 14 days, `monthlyLeadTarget` otherwise.
- If the customer has no target set (null), the dashboard shows “No target set” and does not show a percentage or progress bar.
- Leads in period are counted from `LeadRecord` where `occurredAt` (or, if null, `createdAt`) falls in the selected window.
- Trend vs previous period = current period leads − previous period leads (same length window, immediately before).

## Operator usage notes

- **Select client** — Always choose an active client; the dashboard is tenant-scoped via `X-Customer-Id`.
- **Period** — Use “Last 7 days”, “Last 30 days”, or “Last 90 days” to scope all widgets.
- **Refresh** — Use the Refresh button to refetch from the API after data changes.
- **Export** — Use “Export CSV” on Leads by source, Top sourcers, and Outreach by sequence for offline analysis.
- **Empty states** — If a section has no data, the dashboard shows a short message (e.g. “No leads in this period”) instead of invented numbers.

## API endpoints (for operators / support)

All under `/api/reporting/`, require `X-Customer-Id` (or query `customerId`). No silent default tenant.

- `GET /api/reporting/summary?sinceDays=7|30|90`
- `GET /api/reporting/leads-vs-target?sinceDays=...`
- `GET /api/reporting/leads-by-source?sinceDays=...`
- `GET /api/reporting/top-sourcers?sinceDays=...`
- `GET /api/reporting/outreach-performance?sinceDays=...`
- `GET /api/reporting/funnel?sinceDays=...`
- `GET /api/reporting/mailboxes?sinceDays=...`
- `GET /api/reporting/compliance?sinceDays=...`
- `GET /api/reporting/trends?sinceDays=...`

## Target storage

- **Reused** — Lead targets come from existing `Customer` fields: `weeklyLeadTarget`, `monthlyLeadTarget`. No new migration was added for the reporting dashboard.
