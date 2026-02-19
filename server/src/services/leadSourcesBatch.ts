/**
 * Virtual batch key for Lead Sources.
 * Format: YYYY-MM-DD|client=<clientNorm>|job=<jobTitleNorm>
 * Date is Europe/London. If client/jobTitle missing use "(none)".
 */

const BATCH_TZ = 'Europe/London'

function normalizeBatchPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim() || '(none)'
}

/**
 * Format a date in Europe/London as YYYY-MM-DD.
 */
export function formatDateBucketEuropeLondon(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: BATCH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * Build batch key: YYYY-MM-DD|client=<norm>|job=<norm>
 */
export function buildBatchKey(
  date: Date,
  client: string | undefined | null,
  jobTitle: string | undefined | null
): string {
  const dateStr = formatDateBucketEuropeLondon(date)
  const clientNorm = normalizeBatchPart(client ?? '')
  const jobNorm = normalizeBatchPart(jobTitle ?? '')
  return `${dateStr}|client=${clientNorm}|job=${jobNorm}`
}

/**
 * Parse batch key into { date, client, jobTitle }.
 */
export function parseBatchKey(batchKey: string): { date: string; client: string; jobTitle: string } {
  const match = batchKey.match(/^(\d{4}-\d{2}-\d{2})\|client=(.+)\|job=(.*)$/)
  if (!match) {
    return { date: '', client: '(none)', jobTitle: '(none)' }
  }
  return {
    date: match[1],
    client: match[2] || '(none)',
    jobTitle: match[3] || '(none)',
  }
}
