export const MAX_DAILY_SEND_LIMIT_PER_IDENTITY = 30
export const DEFAULT_DAILY_SEND_LIMIT_PER_IDENTITY = 30

/** Calendar days (UTC) from warm-up start through day 30 inclusive; day 31+ uses platform max ramp tier. */
export const WARMUP_RAMP_LAST_DAY_INDEX = 30

export function clampDailySendLimit(
  value: unknown,
  fallback: number = DEFAULT_DAILY_SEND_LIMIT_PER_IDENTITY,
): number {
  const normalizedFallback = Math.min(
    MAX_DAILY_SEND_LIMIT_PER_IDENTITY,
    Math.max(1, Number.isFinite(Number(fallback)) ? Number(fallback) : DEFAULT_DAILY_SEND_LIMIT_PER_IDENTITY),
  )

  const raw =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN

  if (!Number.isFinite(raw) || raw < 1) return normalizedFallback
  return Math.min(Math.trunc(raw), MAX_DAILY_SEND_LIMIT_PER_IDENTITY)
}

export function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0))
}

/** Whole UTC calendar days from `from` (inclusive start day) to `now` (inclusive). */
export function utcCalendarDaysSince(from: Date, now: Date): number {
  const a = utcDayStart(now).getTime()
  const b = utcDayStart(from).getTime()
  return Math.floor((a - b) / 86_400_000)
}

/**
 * Max sends/day from ramp tier by day index since warm-up start (day 0 = first day).
 * Days 0–3: 5; 4–7: 10; 8–14: 15; 15–21: 20; 22–30: 25; 31+: 30 (capped at platform max).
 */
export function warmupRampCapForDayIndex(dayIndex: number): number {
  if (dayIndex < 0) return 5
  if (dayIndex <= 3) return 5
  if (dayIndex <= 7) return 10
  if (dayIndex <= 14) return 15
  if (dayIndex <= 21) return 20
  if (dayIndex <= 30) return 25
  return MAX_DAILY_SEND_LIMIT_PER_IDENTITY
}

export type WarmupPublicStatus = 'paused' | 'active' | 'complete'

export type EmailIdentityWarmupInput = {
  dailySendLimit: number | unknown
  warmupEnabled: boolean
  warmupStartedAt: Date | null
}

export type EffectiveDailySendCapResult = {
  configuredCap: number
  platformCap: number
  warmupRampCap: number | null
  effectiveCap: number
  warmupPublicStatus: WarmupPublicStatus
  daysSinceWarmupStart: number | null
  warmupStartedAtIso: string | null
  estimatedWarmupCompleteAtIso: string | null
  /** Plain language for operators / schedule views */
  warmupLimitReason: string | null
}

/**
 * Backend truth: effective daily send cap = min(configured cap, platform hard cap, warm-up ramp cap when warm-up applies).
 * Warm-up applies only when warmupEnabled and warmupStartedAt are set.
 */
export function resolveEffectiveDailySendCap(
  identity: EmailIdentityWarmupInput,
  now: Date = new Date(),
): EffectiveDailySendCapResult {
  const configuredCap = clampDailySendLimit(identity.dailySendLimit)
  const platformCap = MAX_DAILY_SEND_LIMIT_PER_IDENTITY

  let warmupRampCap: number | null = null
  let daysSinceWarmupStart: number | null = null
  let warmupPublicStatus: WarmupPublicStatus = 'paused'
  let warmupStartedAtIso: string | null = null
  let estimatedWarmupCompleteAtIso: string | null = null
  let warmupLimitReason: string | null = null

  if (identity.warmupEnabled && identity.warmupStartedAt) {
    const start = identity.warmupStartedAt instanceof Date ? identity.warmupStartedAt : new Date(identity.warmupStartedAt)
    warmupStartedAtIso = start.toISOString()
    daysSinceWarmupStart = utcCalendarDaysSince(start, now)
    warmupRampCap = warmupRampCapForDayIndex(daysSinceWarmupStart)
    warmupPublicStatus = daysSinceWarmupStart >= 31 ? 'complete' : 'active'
    const completeAt = new Date(start)
    completeAt.setUTCDate(completeAt.getUTCDate() + 31)
    estimatedWarmupCompleteAtIso = utcDayStart(completeAt).toISOString()
  } else if (!identity.warmupEnabled) {
    warmupPublicStatus = 'paused'
  } else {
    // warmupEnabled but no start date — no ramp clamp until operator sets start (explicit; no silent default).
    warmupPublicStatus = 'active'
    warmupLimitReason =
      'Warm-up is enabled but no start date is set yet. Set a warm-up start date for the volume ramp to apply.'
  }

  let effectiveCap: number
  if (identity.warmupEnabled && identity.warmupStartedAt && warmupRampCap != null) {
    effectiveCap = Math.min(configuredCap, platformCap, warmupRampCap)
    if (effectiveCap === warmupRampCap && warmupRampCap < Math.min(configuredCap, platformCap)) {
      warmupLimitReason =
        daysSinceWarmupStart != null
          ? `Daily sends are limited by mailbox warm-up (day ${daysSinceWarmupStart + 1} of ramp; effective cap ${effectiveCap}/day until the ramp completes). Unsubscribe and compliance behavior are unchanged.`
          : `Daily sends are limited by mailbox warm-up (effective cap ${effectiveCap}/day).`
    }
  } else {
    effectiveCap = Math.min(configuredCap, platformCap)
  }

  return {
    configuredCap,
    platformCap,
    warmupRampCap,
    effectiveCap,
    warmupPublicStatus,
    daysSinceWarmupStart,
    warmupStartedAtIso,
    estimatedWarmupCompleteAtIso,
    warmupLimitReason,
  }
}

/** Serialize warm-up + cap fields for API responses (no secrets). */
export function buildWarmupCapPayload(identity: EmailIdentityWarmupInput, now?: Date) {
  const r = resolveEffectiveDailySendCap(identity, now ?? new Date())
  return {
    warmupEnabled: Boolean(identity.warmupEnabled),
    warmupStartedAt: identity.warmupStartedAt ? new Date(identity.warmupStartedAt).toISOString() : null,
    warmupStatus: r.warmupPublicStatus,
    daysSinceWarmupStart: r.daysSinceWarmupStart,
    configuredDailySendCap: r.configuredCap,
    effectiveDailySendCap: r.effectiveCap,
    platformDailySendCap: r.platformCap,
    warmupRampDailyCap: r.warmupRampCap,
    estimatedWarmupCompleteAt: r.estimatedWarmupCompleteAtIso,
    warmupLimitReason: r.warmupLimitReason,
  }
}
