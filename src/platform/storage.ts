export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

function canUseLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage
  } catch {
    return false
  }
}

export function isStorageAvailable(): boolean {
  return canUseLocalStorage()
}

export function getItem(key: string): string | null {
  if (!canUseLocalStorage()) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function setItem(key: string, value: string): void {
  if (!canUseLocalStorage()) return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore quota/security errors
  }
}

export function removeItem(key: string): void {
  if (!canUseLocalStorage()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function getJson<T>(key: string): T | null {
  const raw = getItem(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setJson(key: string, value: unknown): void {
  setItem(key, JSON.stringify(value))
}

export function keys(): string[] {
  if (!canUseLocalStorage()) return []
  try {
    const out: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k) out.push(k)
    }
    return out
  } catch {
    return []
  }
}


