/**
 * Deterministic checks for mailbox warm-up effective daily cap (backend truth).
 * Run: cd server && npx tsx tests/mailbox-warmup-cap.test.ts
 */
import assert from 'node:assert/strict'
import {
  MAX_DAILY_SEND_LIMIT_PER_IDENTITY,
  resolveEffectiveDailySendCap,
  utcCalendarDaysSince,
  warmupRampCapForDayIndex,
} from '../src/utils/emailIdentityLimits.js'

function mustEqual<T>(actual: T, expected: T, label: string) {
  assert.equal(actual, expected, label)
}

// 1) age 2 days => 5/day (Mar 30 vs Mar 28 UTC)
{
  const start = new Date(Date.UTC(2026, 2, 28, 12, 0, 0))
  const now = new Date(Date.UTC(2026, 2, 30, 12, 0, 0))
  mustEqual(utcCalendarDaysSince(start, now), 2, 'two UTC days')
  const r = resolveEffectiveDailySendCap({ dailySendLimit: 30, warmupEnabled: true, warmupStartedAt: start }, now)
  mustEqual(r.effectiveCap, 5, '2 days in ramp => 5/day')
}

// 2) ~10 days => 15/day (tier 8-14)
{
  const start = new Date(Date.UTC(2026, 2, 20, 0, 0, 0))
  const now = new Date(Date.UTC(2026, 2, 30, 0, 0, 0))
  mustEqual(utcCalendarDaysSince(start, now), 10, '10 UTC days')
  mustEqual(warmupRampCapForDayIndex(10), 15, 'tier table day 10 => 15')
  const r = resolveEffectiveDailySendCap({ dailySendLimit: 30, warmupEnabled: true, warmupStartedAt: start }, now)
  mustEqual(r.effectiveCap, 15, 'effective 15/day')
}

// 3) 40+ days => 30/day max (platform cap)
{
  const start = new Date(Date.UTC(2026, 1, 1, 0, 0, 0))
  const now = new Date(Date.UTC(2026, 3, 15, 0, 0, 0))
  mustEqual(utcCalendarDaysSince(start, now) >= 31, true, 'long ramp')
  const r = resolveEffectiveDailySendCap({ dailySendLimit: 30, warmupEnabled: true, warmupStartedAt: start }, now)
  mustEqual(r.effectiveCap, 30, 'post-ramp => platform max')
}

// 4) configured cap lower than warm-up tier => configured wins
{
  const start = new Date(Date.UTC(2026, 2, 28, 0, 0, 0))
  const now = new Date(Date.UTC(2026, 2, 29, 0, 0, 0))
  const r = resolveEffectiveDailySendCap({ dailySendLimit: 3, warmupEnabled: true, warmupStartedAt: start }, now)
  mustEqual(r.effectiveCap, 3, 'min(config 3, ramp 5) => 3')
}

// 5) platform hard cap — already enforced via clamp; identity cannot exceed 30
{
  const r = resolveEffectiveDailySendCap(
    { dailySendLimit: 999, warmupEnabled: false, warmupStartedAt: null },
    new Date(),
  )
  mustEqual(r.configuredCap, MAX_DAILY_SEND_LIMIT_PER_IDENTITY, 'clamp configured to 30')
  mustEqual(r.effectiveCap, MAX_DAILY_SEND_LIMIT_PER_IDENTITY, 'effective respects platform max')
}

// 6) warm-up disabled => normal cap (no ramp)
{
  const r = resolveEffectiveDailySendCap(
    { dailySendLimit: 20, warmupEnabled: false, warmupStartedAt: new Date() },
    new Date(),
  )
  mustEqual(r.effectiveCap, 20, 'no warm-up => configured')
  mustEqual(r.warmupPublicStatus, 'paused', 'status paused')
}

// 7) Worker-style path: effective cap derived from same resolver used in send queue / scheduler
{
  const identity = { dailySendLimit: 30, warmupEnabled: true, warmupStartedAt: new Date(Date.UTC(2026, 2, 28, 0, 0, 0)) }
  const now = new Date(Date.UTC(2026, 2, 29, 0, 0, 0))
  const fromResolver = resolveEffectiveDailySendCap(identity, now).effectiveCap
  const rawConfigured = 30
  mustEqual(fromResolver < rawConfigured, true, 'ramp day should be below raw configured cap in early tier')
}

console.log('mailbox-warmup-cap.test.ts: PASS')
