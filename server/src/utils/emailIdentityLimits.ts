export const MAX_DAILY_SEND_LIMIT_PER_IDENTITY = 30
export const DEFAULT_DAILY_SEND_LIMIT_PER_IDENTITY = 30

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
