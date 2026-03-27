/** URLs that are favicon services or favicon paths — not acceptable as a company logo in Accounts. */
export function isLikelyFaviconUrl(url: string): boolean {
  const u = url.toLowerCase()
  return u.includes('google.com/s2/favicons') || u.includes('/favicon') || u.includes('favicon.ico')
}

/** Logo shown in Accounts: persisted HTTPS URL only, or empty (Avatar falls back to initials). */
export function accountLogoUrlForDisplay(account: { logoUrl?: string | null }): string {
  const p = typeof account.logoUrl === 'string' ? account.logoUrl.trim() : ''
  if (!p || isLikelyFaviconUrl(p)) return ''
  return p
}
