/**
 * Account health scale (DB field `defcon`, 1–6).
 * 1 = lowest maturity, 6 = strongest health — positive wording only.
 */
/** Short labels for compact table cells (1–6). */
export const ACCOUNT_HEALTH_LABELS: Record<number, string> = {
  1: 'Foundational',
  2: 'Developing',
  3: 'Progressing',
  4: 'Strong',
  5: 'Advanced',
  6: 'Excellent',
}

export function formatAccountHealthLabel(defcon: number): string {
  const n = Math.round(defcon)
  const label = ACCOUNT_HEALTH_LABELS[n]
  if (!label) return 'Not set'
  return `${n} — ${label}`
}

export const ACCOUNT_HEALTH_SELECT_OPTIONS: Array<{ value: string; label: string }> = [1, 2, 3, 4, 5, 6].map(
  (n) => ({
    value: String(n),
    label: formatAccountHealthLabel(n),
  }),
)
