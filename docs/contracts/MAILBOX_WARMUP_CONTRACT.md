# Mailbox warm-up contract

## Purpose

Provide a **safe volume ramp** for newly connected **sender identities** so new mailboxes do not immediately behave like fully loaded campaign senders. This is **not** engagement simulation and **not** a third-party “warm-up network.”

## States

Each mailbox may be reported as:

| State | Meaning |
|-------|---------|
| **paused** | `warmupEnabled === false` — ramp does not apply; effective cap = `min(configured, platform max)`. |
| **active** | `warmupEnabled === true` and `warmupStartedAt` set — ramp tier applies until day 31+ of the ramp calendar. |
| **complete** | `warmupEnabled === true` and **31+ UTC calendar days** since `warmupStartedAt` — ramp tier is platform max (30); operator may turn warm-up off to return to “normal” UI labeling only. |

If `warmupEnabled === true` but **`warmupStartedAt` is null**, ramp **does not** clamp sends until a start date is set (explicit; no silent default in resolver).

## Backend truth

- **Effective daily send cap** = `min(configuredDailySendCap, MAX_DAILY_SEND_LIMIT_PER_IDENTITY, warmupRampDailyCap)` when warm-up applies.
- **MAX_DAILY_SEND_LIMIT_PER_IDENTITY** remains **30** (hard upper bound).
- Implementation: `resolveEffectiveDailySendCap`, `buildWarmupCapPayload` in `server/src/utils/emailIdentityLimits.ts`.

## Ramp table (UTC calendar days since `warmupStartedAt` day, day 0 = first day)

| Days | Max sends/day (ramp tier) |
|------|---------------------------|
| 0–3 | 5 |
| 4–7 | 10 |
| 8–14 | 15 |
| 15–21 | 20 |
| 22–30 | 25 |
| 31+ | 30 (same as platform max) |

## Persistence (additive schema)

- `EmailIdentity.warmupEnabled` (boolean, default `false`)
- `EmailIdentity.warmupStartedAt` (optional `DateTime`)

## API

- `GET /api/outlook/identities` — each identity includes `warmup: { … }` from `buildWarmupCapPayload`.
- `PATCH /api/outlook/identities/:id` — whitelist-only: `warmupEnabled`, `warmupStartedAt` (ISO string); first enable without start date defaults start to **now** on the server when appropriate.

## Workers

- **Campaign sender**, **email scheduler**, **send queue worker** use **effective** cap, not raw configured cap alone.
- Rate-limit audit metadata may include `warmupLimitReason` when the warm-up tier is the limiting factor.

## Compliance

- Unsubscribe/signature/compliance behavior for live outreach is **unchanged** by this feature.

## Validation

- `npm run test:mailbox-warmup-cap` — deterministic cap tests in `server/tests/mailbox-warmup-cap.test.ts`.
