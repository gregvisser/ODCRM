export type FieldEnrichmentMode = 'original' | 'enhanced' | 'both'
export type FieldEnrichmentActive = 'original' | 'enhanced'

export type FieldEnrichmentEntry<T> = {
  original?: T
  enhanced?: T
  mode?: FieldEnrichmentMode
  active?: FieldEnrichmentActive
}

export type FieldEnrichmentStore = {
  version: 1
  fields: Record<string, FieldEnrichmentEntry<any>>
}

export const ACCOUNTDATA_FIELD_ENRICHMENT_KEY = 'fieldEnrichment' as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function coerceFieldEnrichmentStore(value: unknown): FieldEnrichmentStore | null {
  if (!isPlainObject(value)) return null
  const version = (value as any).version
  const fields = (value as any).fields
  if (version !== 1) return null
  if (!isPlainObject(fields)) return null
  return { version: 1, fields: fields as Record<string, FieldEnrichmentEntry<any>> }
}

export function readFieldEnrichmentStoreFromAccountData(accountData: unknown): FieldEnrichmentStore | null {
  if (!isPlainObject(accountData)) return null
  return coerceFieldEnrichmentStore((accountData as any)[ACCOUNTDATA_FIELD_ENRICHMENT_KEY])
}

export function normalizeFieldEnrichmentEntry<T>(entry: FieldEnrichmentEntry<T> | null | undefined): FieldEnrichmentEntry<T> {
  const safe = entry && typeof entry === 'object' ? entry : {}
  const mode: FieldEnrichmentMode =
    safe.mode === 'enhanced' || safe.mode === 'both' || safe.mode === 'original' ? safe.mode : 'original'

  const activeRaw = safe.active === 'enhanced' || safe.active === 'original' ? safe.active : undefined
  const active: FieldEnrichmentActive =
    mode === 'both'
      ? (activeRaw ?? 'original')
      : mode === 'enhanced'
        ? 'enhanced'
        : 'original'

  return {
    original: safe.original,
    enhanced: safe.enhanced,
    mode,
    active,
  }
}

export function getFieldEnrichmentEntry<T>(params: {
  store: FieldEnrichmentStore | null | undefined
  fieldKey: string
  fallbackOriginal?: T
}): FieldEnrichmentEntry<T> {
  const raw = params.store?.version === 1 ? (params.store.fields[params.fieldKey] as any) : undefined
  const normalized = normalizeFieldEnrichmentEntry<T>(raw)
  if (normalized.original === undefined && params.fallbackOriginal !== undefined) {
    normalized.original = params.fallbackOriginal
  }
  return normalized
}

export function resolveEnrichedValue<T>(params: { entry: FieldEnrichmentEntry<T> | null | undefined; fallback?: T }): T | undefined {
  const normalized = normalizeFieldEnrichmentEntry(params.entry)
  const original = normalized.original ?? params.fallback
  const enhanced = normalized.enhanced

  if (normalized.mode === 'enhanced') return (enhanced ?? original) as any
  if (normalized.mode === 'both') return (normalized.active === 'enhanced' ? enhanced ?? original : original) as any
  return original as any
}

export function upsertFieldEnrichmentEntry<T>(params: {
  store: FieldEnrichmentStore | null | undefined
  fieldKey: string
  next: FieldEnrichmentEntry<T>
}): FieldEnrichmentStore {
  const base: FieldEnrichmentStore = params.store && params.store.version === 1 ? params.store : { version: 1, fields: {} }
  const nextEntry = normalizeFieldEnrichmentEntry(params.next)
  return {
    version: 1,
    fields: {
      ...base.fields,
      [params.fieldKey]: nextEntry,
    },
  }
}

