/**
 * Normalized labels for reusable taxonomy options (sectors, roles, etc.).
 * Keep in sync with server/src/utils/taxonomyLabel.ts
 */
export function normalizeTaxonomyLabel(input: string): string {
  return String(input ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}
