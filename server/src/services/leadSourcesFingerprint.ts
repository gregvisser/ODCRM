/**
 * Fingerprint for Lead Source rows (for virtual batching / firstSeen tracking).
 * Priority: 1) Normalized Email, 2) Normalized Personal LinkedIn URL, 3) Normalized (FirstName|LastName|Company|JobTitle).
 */

function normalizeForFingerprint(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\/+$/, '') // trailing slashes
    .trim()
}

function normalizeEmail(email: string): string {
  return normalizeForFingerprint(email)
}

function normalizeLinkedInUrl(url: string): string {
  let u = normalizeForFingerprint(url)
  // Optional: strip query and hash for consistency
  try {
    const parsed = new URL(u.startsWith('http') ? u : `https://${u}`)
    u = `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, '')
  } catch {
    // keep as-is if not URL
  }
  return u
}

function normalizeNameCompanyJob(firstName: string, lastName: string, companyName: string, jobTitle: string): string {
  const parts = [
    normalizeForFingerprint(firstName || ''),
    normalizeForFingerprint(lastName || ''),
    normalizeForFingerprint(companyName || ''),
    normalizeForFingerprint(jobTitle || ''),
  ]
  return parts.join('|')
}

export interface CanonicalLike {
  email?: string | null
  linkedinUrl?: string | null
  firstName?: string | null
  lastName?: string | null
  companyName?: string | null
  jobTitle?: string | null
}

/**
 * Compute fingerprint for a row. Priority: email > linkedinUrl > name+company+job.
 * Returns normalized string suitable for unique constraint (customerId, sourceType, spreadsheetId, fingerprint).
 */
export function computeFingerprint(row: CanonicalLike): string {
  const email = (row.email ?? '').trim()
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return `email:${normalizeEmail(email)}`
  }

  const linkedin = (row.linkedinUrl ?? '').trim()
  if (linkedin && (linkedin.includes('linkedin.com') || linkedin.startsWith('http'))) {
    return `linkedin:${normalizeLinkedInUrl(linkedin)}`
  }

  const firstName = (row.firstName ?? '').trim()
  const lastName = (row.lastName ?? '').trim()
  const companyName = (row.companyName ?? '').trim()
  const jobTitle = (row.jobTitle ?? '').trim()
  const composite = normalizeNameCompanyJob(firstName, lastName, companyName, jobTitle)
  if (composite !== '|||') {
    return `name:${composite}`
  }

  // Fallback: use a hash of JSON stringified row to avoid empty fingerprints (would break unique)
  return `fallback:${Buffer.from(JSON.stringify(row)).toString('base64').slice(0, 120)}`
}
