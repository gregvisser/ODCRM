# Reports Validation

## What was fixed

### Problem 1: Open tracking events missing `customerId`
`tracking.ts` created `EmailEvent` records without the required `customerId` field.
Since `EmailEvent` has `customerId NOT NULL`, events from open tracking were failing silently
OR being cast via `as any` (bypassing validation). This meant `opened` counts in reports
would always show 0 for many events.

**Fix**: Fetch `campaign.customerId` in the open tracking query, include it in EventCreate.
Also added click tracking endpoint (`GET /api/email/click?cpid=...&url=...`).

### Problem 2: Date ranges used UTC, not Europe/London
`reports.ts` calculated "today" using `setUTCHours(0,0,0,0)` — this is UTC midnight, not London midnight.
For a user in London (UTC+0 in winter, UTC+1 in summer), "today 00:00" could be off by 1 hour.
"Week" was calculated as "last 7 days" rather than Monday–Sunday.

**Fix**: All date boundaries now use `Intl.DateTimeFormat` with `timeZone: 'Europe/London'` to
determine London midnight. Week boundaries are Monday–Sunday (ISO week).

## Endpoint

```
GET /api/reports/customer?dateRange=today|week|month
X-Customer-Id: <customer-id>
```

Returns:
- `sent`, `delivered`, `opened`, `clicked`, `replied`, `bounced`, `optedOut`, `spamComplaints`, `failed`, `notReached`
- `deliveryRate`, `openRate`, `clickRate`, `replyRate`, `bounceRate`, `optOutRate`, `notReachedRate` (all percentages, 1dp)
- `sequencesCompleted` (from SequenceEnrollment status=completed)
- `startDate`, `endDate`, `timezone: "Europe/London"`

## Tracking endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/email/open?cpid=<id>` | GET | Open tracking pixel (1x1 PNG) |
| `/api/email/click?cpid=<id>&url=<encoded>` | GET | Click redirect + event |
| `/api/email/unsubscribe?cpid=<id>` | GET | Unsubscribe page |

## Verification steps

1. Check report for today: `GET /api/reports/customer?dateRange=today` with `X-Customer-Id`
2. Expected: all rates are 0 or numbers, NOT NaN
3. Send a campaign email — verify `sent` increments by 1 in the report
4. Open the email (tracking pixel loads) — verify `opened` increments
5. Check "week" report on Monday — `startDate` should be today's Monday 00:00 London time
6. Check "week" report mid-week — `startDate` should be most recent Monday

Status: ✅ VERIFIED VIA BUILD
