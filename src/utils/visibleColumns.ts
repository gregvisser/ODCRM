/**
 * Return only columns that have at least one non-empty value in the rows.
 * Used to hide empty columns in Lead Sources contacts and Sequences preview.
 */
export function visibleColumns(
  columns: string[],
  rows: Array<Record<string, unknown>>
): string[] {
  return columns.filter((col) =>
    rows.some((row) => {
      const v = row?.[col]
      if (v === null || v === undefined) return false
      if (typeof v === 'string') return v.trim() !== ''
      if (Array.isArray(v)) return v.length > 0
      return true // numbers/booleans/objects treated as present
    })
  )
}
