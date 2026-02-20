/** Treat empty: null, undefined, '', whitespace-only, 'N/A', '-'. */
export function isEmptyCell(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') {
    const s = v.trim()
    return s === '' || s === 'N/A' || s === '-'
  }
  if (Array.isArray(v)) return v.length === 0
  return false
}

/**
 * Return only columns that have at least one non-empty value in the rows.
 * Used to hide empty columns in Lead Sources contacts and Sequences preview.
 */
export function visibleColumns(
  columns: string[],
  rows: Array<Record<string, unknown>>
): string[] {
  const cols = Array.isArray(columns) ? columns : []
  const safeRows = Array.isArray(rows) ? rows : []
  return cols.filter((col) =>
    safeRows.some((row) => !isEmptyCell(row?.[col]))
  )
}
