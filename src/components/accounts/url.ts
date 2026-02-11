export function normalizeExternalHref(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return null
  try {
    // If it already parses as a URL, keep as-is.
    // new URL() requires protocol; we’ll add https:// as a safe default.
    if (value.startsWith('http://') || value.startsWith('https://')) return value
    const withProtocol = `https://${value}`
    // Validate final URL
    // eslint-disable-next-line no-new
    new URL(withProtocol)
    return withProtocol
  } catch {
    return null
  }
}

