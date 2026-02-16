import { setTimeout as sleep } from 'timers/promises'

export function sanitizeText(value: unknown, maxLen: number): string {
  const v = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!v) return ''
  return v.length > maxLen ? v.slice(0, maxLen).trim() : v
}

export function normalizeWebsiteUrl(input: string): string {
  const raw = String(input || '').trim()
  if (!raw) return ''
  const withScheme = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`
  const url = new URL(withScheme)
  return `${url.protocol}//${url.host}`
}

export function normalizeDomain(input: string): string {
  const raw = String(input || '').trim()
  if (!raw) return ''
  try {
    const withScheme = raw.startsWith('http') ? raw : `https://${raw}`
    const host = new URL(withScheme).hostname
    return host.replace(/^www\./, '').toLowerCase()
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase()
  }
}

export function isPrivateOrLocalHost(hostname: string): boolean {
  const host = String(hostname || '').trim().toLowerCase()
  if (!host) return true
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  if (host.endsWith('.local')) return true

  const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  if (!isIPv4) return false

  const parts = host.split('.').map((p) => Number(p))
  if (parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

export async function fetchTextWithTimeout(
  url: string,
  timeoutMs: number,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController()
  const handle = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'ODCRM Enrichment (UK pipeline)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...(options.headers || {}),
      },
      ...options,
    })
    const text = await res.text()
    return { ok: res.ok, status: res.status, text }
  } finally {
    clearTimeout(handle)
  }
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs: number,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; json: T | null }> {
  const controller = new AbortController()
  const handle = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'ODCRM Enrichment (UK pipeline)',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    })
    const json = (await res.json().catch(() => null)) as T | null
    return { ok: res.ok, status: res.status, json }
  } finally {
    clearTimeout(handle)
  }
}

export function dedupeStrings(values: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of values) {
    const v = String(raw || '').trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

export function keepSameDomainUrls(baseDomain: string, urls: string[]): string[] {
  const domain = normalizeDomain(baseDomain)
  if (!domain) return []
  const kept: string[] = []
  for (const u of urls) {
    try {
      const url = new URL(u)
      const host = normalizeDomain(url.hostname)
      if (host === domain) kept.push(url.toString())
    } catch {
      // ignore
    }
  }
  return dedupeStrings(kept)
}

export async function backoffDelay(attempt: number): Promise<void> {
  const ms = Math.min(800, 100 + attempt * 150)
  await sleep(ms)
}

