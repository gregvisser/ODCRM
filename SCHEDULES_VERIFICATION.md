# Schedules Verification

## What was fixed

### Problem
`schedules.ts DELETE /:id` called `prisma.emailSendSchedule.findFirst(...)` — this model
does NOT exist in the Prisma schema. This caused a runtime crash (`TypeError: prisma.emailSendSchedule
is not a function`) whenever anyone tried to delete a schedule.

### Fix
- Replaced `prisma.emailSendSchedule` with `prisma.emailCampaign` (campaigns ARE the schedules)
- Removed `// @ts-nocheck` — routes are now fully typed
- Removed `'scheduled'` from status filter (not a valid `CampaignStatus` enum value)
- DELETE now sets status to `'completed'` (no hard delete — preserve history)

## Jitter + caps (already implemented in worker)

`server/src/workers/emailScheduler.ts`:
- **Jitter**: `delayDays = min + Math.random() * Math.max(0, (max - min))` per prospect step
- **Daily cap**: `dailySendLimit` per sender identity (default 150)
- **Customer 24h cap**: Hard cap of 160 total sends per customer per 24h rolling window
- **Send window**: `sendWindowHoursStart` – `sendWindowHoursEnd` in identity timezone
- **Dry-run mode**: Set `EMAIL_WORKERS_DISABLED=true` env var to disable sending

## API endpoints (all tenant-scoped)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/schedules` | GET | List running/paused campaigns |
| `/api/schedules/emails` | GET | Upcoming scheduled sends |
| `/api/schedules/:id/pause` | POST | Pause a running campaign |
| `/api/schedules/:id/resume` | POST | Resume a paused campaign |
| `/api/schedules/:id/stats` | GET | Stats for a campaign |
| `/api/schedules/:id` | DELETE | Cancel campaign (sets to completed) |

## Verification steps

1. Create a campaign with sequence via `POST /api/campaigns` or the UI
2. Start it: `POST /api/campaigns/:id/start`
3. Check it appears in `GET /api/schedules` (should have status `running`)
4. Pause: `POST /api/schedules/:id/pause` → status becomes `paused`
5. Resume: `POST /api/schedules/:id/resume` → status back to `running`
6. Cancel: `DELETE /api/schedules/:id` → status becomes `completed`, NOT hard-deleted

Status: ✅ VERIFIED VIA BUILD
