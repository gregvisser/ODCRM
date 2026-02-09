/**
 * Safe Account Data Merge Utility
 * 
 * Ensures updates to accountData don't accidentally wipe other nested fields.
 * This is critical for onboarding where different tabs update different sections:
 * - ProgressTrackerTab updates: accountData.progressTracker
 * - CustomerOnboardingTab updates: accountData.clientProfile, accountData.accountDetails
 * 
 * Without proper merging, updating progressTracker could wipe clientProfile and vice versa.
 */

/**
 * Deep merge two objects safely
 * - Handles nested objects recursively
 * - Arrays are replaced (not merged) to avoid duplicates
 * - Null/undefined values in updates are preserved
 */
function deepMerge<T extends Record<string, any>>(base: T, updates: Partial<T>): T {
  const result = { ...base }

  for (const key in updates) {
    const updateValue = updates[key]
    const baseValue = result[key]

    // If update value is undefined, skip (don't overwrite with undefined)
    if (updateValue === undefined) {
      continue
    }

    // If update value is null, explicitly set to null
    if (updateValue === null) {
      result[key] = null as any
      continue
    }

    // If both are plain objects, merge recursively
    if (
      baseValue &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue) &&
      typeof updateValue === 'object' &&
      !Array.isArray(updateValue)
    ) {
      result[key] = deepMerge(baseValue, updateValue)
      continue
    }

    // Otherwise, replace the value (includes arrays, primitives)
    result[key] = updateValue
  }

  return result
}

/**
 * Safely merge updates into accountData
 * 
 * @param baseAccountData - Current accountData from database (latest state)
 * @param updates - Partial updates to apply
 * @returns Merged accountData with updates applied safely
 * 
 * @example
 * const base = { clientProfile: { name: 'X' }, progressTracker: { sales: {} } }
 * const updates = { progressTracker: { sales: { item1: true } } }
 * const result = safeAccountDataMerge(base, updates)
 * // Result: { clientProfile: { name: 'X' }, progressTracker: { sales: { item1: true } } }
 * // clientProfile is preserved!
 */
export function safeAccountDataMerge(
  baseAccountData: Record<string, any> | null | undefined,
  updates: Record<string, any>
): Record<string, any> {
  const base = baseAccountData && typeof baseAccountData === 'object' ? baseAccountData : {}
  return deepMerge(base, updates)
}
