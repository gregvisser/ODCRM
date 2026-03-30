# Mailbox warm-up audit — 2026-03-30

## Scope

Review of per-mailbox send caps, sender identity model, scheduling, and workers before adding **volume ramp / warm-up** (no engagement simulation).

## 1) Where are per-mailbox daily caps enforced today?

| Area | Mechanism |
|------|-----------|
| `server/src/utils/emailIdentityLimits.ts` | `clampDailySendLimit` enforces platform max **30/day**; configured values are clamped. |
| `server/src/workers/campaignSender.ts` | Counts `EmailEvent` type `sent` since UTC day start; compares to identity cap before sequence-based campaign sends. |
| `server/src/workers/emailScheduler.ts` | Counts `EmailEvent` `sent` in sender **local** calendar day; compares to daily limit; also hourly spread from daily ÷ `EMAIL_HOURLY_SEND_FACTOR`. |
| `server/src/workers/sendQueueWorker.ts` | Counts `EmailMessageMetadata` outbound rows since UTC day start; **SKIP / requeue** when cap reached (`daily_cap_reached`). |
| `server/src/routes/sendWorker.ts` | **Identity capacity** snapshot uses clamped daily limit vs recent audit stats for operator visibility. |
| `server/src/routes/schedules.ts` | Surfaces `dailySendLimit` / stats `dailyLimit` for schedules (UI-facing). |

## 2) What cap is shown in UI vs enforced in backend?

- **UI** (Email Accounts, Schedules, Sequences identity capacity) showed **configured** `dailySendLimit` (clamped in API list responses).
- **Backend** enforced `clampDailySendLimit(identity.dailySendLimit)` in workers; schema default `dailySendLimit` was historically **150** but runtime clamp reduced to **30**.
- **Gap:** No **effective** cap that combines configured limit, platform max, and a **ramp policy** for new mailboxes.

## 3) Where would a warm-up / ramp policy fit with minimal disruption?

- Centralize ramp math in **`emailIdentityLimits.ts`** (`resolveEffectiveDailySendCap`, `buildWarmupCapPayload`).
- **Additive** columns on `EmailIdentity`: `warmupEnabled`, `warmupStartedAt`.
- Replace raw `clampDailySendLimit` in send paths with **`resolveEffectiveDailySendCap(identity).effectiveCap`** in workers and capacity snapshots.

## 4) Safest place for backend truth

- **`resolveEffectiveDailySendCap`** in `server/src/utils/emailIdentityLimits.ts` — single source for:
  - `min(configured cap, platform max, warm-up ramp tier)` when warm-up applies.
- API list/detail attach **`buildWarmupCapPayload`** so operators see configured vs effective caps.

## 5) Operator surfaces for warm-up visibility

- **Email Accounts** (`EmailAccountsTab.tsx`): warm-up toggle, start date, effective vs configured cap.
- **Schedules** (`SchedulesTab.tsx`): effective daily cap card when a schedule has a sender identity.
- **Sequences** (`SequencesTab.tsx`): identity capacity table shows `effectiveCap` and warm-up hint.
- **Send worker** `/api/send-worker/identity-capacity`: `guardrails` extended with effective/configured/warm-up fields.

## 6) Existing protections

- Live send gates (`assertLiveSendAllowed`, kill switches, canary).
- Send queue: reply-stop, suppression, per-minute cap, step-0-only canary.
- Unsubscribe footer enforcement in template renderers (`enforceUnsubscribeFooter`) — unchanged by warm-up.
- Tenant scoping via `X-Customer-Id` on mutations and reads.

## 7) What must stay unchanged (compliance / unsubscribe)

- **No** removal or weakening of unsubscribe links, footers, or tracking required for compliance in live outreach.
- **No** simulated opens/clicks/replies or third-party warm-up networks.
- Warm-up **only** limits **volume** (effective daily cap) and surfaces **operator-visible** reasons when sends are delayed by cap.
