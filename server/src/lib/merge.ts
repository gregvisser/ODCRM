// Utilities for safely merging partial JSON payloads into stored JSON blobs.
// Goal: Non-destructive updates where missing/undefined keys never wipe stored data.

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
type JsonObject = { [key: string]: JsonValue }

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Recursively removes keys with `undefined` values (deep), without changing `null`.
 * - Objects: returns a new object with undefined keys removed
 * - Arrays: returns a new array with children cleaned (keeps array length; undefined items become null)
 * - Primitives: returned as-is
 */
export function stripUndefinedDeep<T>(input: T): T {
  if (Array.isArray(input)) {
    // Keep array shape stable; undefined items are not valid JSON anyway.
    return input.map((v) => (v === undefined ? null : (stripUndefinedDeep(v) as any))) as any
  }

  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined) continue
      out[k] = stripUndefinedDeep(v as any)
    }
    return out as any
  }

  return input
}

export type DeepMergeOptions = {
  /**
   * Explicitly allow specific dot-paths to be overwritten with `null`.
   * Example: "accountDetails.primaryContact.phone"
   */
  allowNullOverwritePaths?: Set<string>
}

/**
 * Deep merges `incoming` into `existing` with preservation rules:
 * - Objects: recursive merge
 * - Arrays: replace only if incoming array provided
 * - undefined: ignored (preserve existing)
 * - missing keys: preserve existing
 * - null: preserved by default (only overwrites if path is explicitly allowed)
 */
export function deepMergePreserve<TExisting, TIncoming>(
  existing: TExisting,
  incoming: TIncoming,
  options: DeepMergeOptions = {},
  path: string[] = [],
): any {
  // Ignore undefined incoming values entirely
  if (incoming === undefined) return existing

  // Handle null overwrite rules
  if (incoming === null) {
    const keyPath = path.join('.')
    if (options.allowNullOverwritePaths?.has(keyPath)) return null
    return existing
  }

  // Arrays: replace if explicitly provided
  if (Array.isArray(incoming)) {
    return incoming
  }

  // Objects: recursive merge
  if (isPlainObject(incoming)) {
    const base: Record<string, unknown> = isPlainObject(existing) ? (existing as any) : {}
    const out: Record<string, unknown> = { ...base }
    for (const [k, v] of Object.entries(incoming)) {
      const nextPath = [...path, k]
      const prev = (base as any)[k]
      ;(out as any)[k] = deepMergePreserve(prev, v as any, options, nextPath)
    }
    return out
  }

  // Primitives (string/number/boolean) overwrite
  return incoming
}

