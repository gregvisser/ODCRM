/**
 * Account health / DEFCON-style scale (DB field `defcon`, 1–6).
 * Business contract: 1 = Stable … 6 = Emergency (higher = more severe).
 */
/** Short labels for compact table cells (1–6). */
export const ACCOUNT_HEALTH_LABELS: Record<number, string> = {
  1: 'Stable',
  2: 'Healthy',
  3: 'Watch',
  4: 'At Risk',
  5: 'Critical',
  6: 'Emergency',
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
