# Sending Guardrails

## Architecture

Email sending is handled exclusively by `server/src/workers/emailScheduler.ts`.
The worker runs on a cron-like interval (every ~60s) when `ENABLE_EMAIL_SCHEDULER=true`.

---

## Guard Layers (in order of execution)

### 1. Send Window (per identity)
**File:** `emailScheduler.ts` lines ~94–110  
**Config:** `EmailIdentity.sendWindowHoursStart` / `sendWindowHoursEnd` / `sendWindowTimeZone`  
**Default:** 09:00–17:00 UTC  
The worker skips all emails for an identity when the current local hour is outside its configured window.

### 2. Per-Identity Daily Cap
**File:** `emailScheduler.ts` lines ~118–133  
**Config:** `EmailIdentity.dailySendLimit` (DB field, default 150)  
Counts `EmailEvent { type: 'sent' }` for the identity since midnight and stops if at/over limit.

### 3. Per-Identity Hourly Cap _(added Feb 2026)_
**File:** `emailScheduler.ts` — immediately after daily cap check  
**Config:** `EMAIL_HOURLY_SEND_FACTOR` env var (default `8`)  
Formula: `hourlyLimit = ceil(dailySendLimit / EMAIL_HOURLY_SEND_FACTOR)`  
Example: 150 daily ÷ 8 = 19/hour max.  
Counts `EmailEvent { type: 'sent' }` for the identity in the past 60 minutes.

### 4. Customer 24h Rolling Cap
**File:** `emailScheduler.ts` lines ~135–147  
**Config:** Hardcoded 160/24h per customer (covers multi-identity scenarios)  
Counts all `EmailEvent { type: 'sent' }` across all identities/campaigns for the customer in the past 24h.

### 5. Batch Size
**File:** `emailScheduler.ts` — `take: 10` in the due-steps query  
Max 10 prospects processed per scheduler tick (≈1 min).

### 6. Suppression Gate — Pre-Batch
**File:** `emailScheduler.ts` `processScheduledEmails` ~lines 178–210  
Loads `SuppressionEntry` set for the customer, filters the entire batch.  
Suppressed prospects are marked `lastStatus: 'suppressed'` and future steps are deleted.

### 7. Suppression Gate — Per Send (Hard Stop)
**File:** `emailScheduler.ts` `sendCampaignEmail` ~lines 476–560  
Double-checks via `isSuppressed()` DB query immediately before composing the email.  
If suppressed: writes `EmailEvent { type: 'failed', metadata.suppressed: true }`, marks prospect, returns `false` — **no email is sent**.

### 8. Jitter on Step Delays
**File:** `emailScheduler.ts` — next-step scheduling (~line 268)  
```typescript
const delayDays = min + Math.random() * Math.max(0, (max - min))
```
Randomises the delay between steps using per-template `delayDaysMin`/`delayDaysMax` windows (falls back to campaign-level values). This prevents predictable follow-up patterns.

### 9. Dry-Run Mode
**Config:** `ENABLE_SENDING=false` (or `ENABLE_EMAIL_SCHEDULER` not set)  
When the scheduler is not enabled, zero emails are sent. No code path can reach `sendEmail()`.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ENABLE_EMAIL_SCHEDULER` | `false` | Master switch — must be `true` to send |
| `EMAIL_HOURLY_SEND_FACTOR` | `8` | Divides daily limit to get hourly limit |

Per-identity limits are configured in the `EmailIdentity` DB table (`dailySendLimit`, `sendWindowHoursStart`, etc.).

---

## Event Writes on Send

Every successful send writes **two** events:
- `EmailEvent { type: 'sent' }` — used by cap counters and reports
- `EmailEvent { type: 'delivered' }` — Graph API accepted the message (accepted-by-sending-MTA = delivered)

Failures write:
- `EmailEvent { type: 'bounced' }` — permanent failure (bounce/rejected error)
- `EmailEvent { type: 'failed', metadata.suppressed: true }` — suppressed before send

---

## Deferred / Not Yet Automated

| Event | Status | Notes |
|---|---|---|
| `spam_complaint` | ❌ Not automated | Requires Microsoft Graph webhook subscription |
| `not_reached` | ❌ Not automated | Would require provider delivery callbacks |

These show as `0` in reports and do not affect delivery rate calculations. They require additional webhook infrastructure from the email provider.

---

**Last updated:** 2026-02-23  
**Status:** Active — all guardrails verified in code
