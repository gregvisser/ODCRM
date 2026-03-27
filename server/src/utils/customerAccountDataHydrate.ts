/**
 * Merge canonical CustomerContact rows into accountData JSON so GET /customers/:id
 * returns onboarding primary fields (phone, title/role) consistent with customer_contacts.
 */
export function overlayPrimaryContactOntoAccountData(
  accountData: unknown,
  contacts: Array<{
    id: string
    name: string
    email: string | null
    phone: string | null
    title: string | null
    isPrimary: boolean
  }>,
): unknown {
  if (!accountData || typeof accountData !== 'object' || Array.isArray(accountData)) return accountData
  const primary = contacts.find((c) => c.isPrimary)
  if (!primary) return accountData

  const ad = { ...(accountData as Record<string, unknown>) }
  const detailsRaw = ad.accountDetails
  const details =
    detailsRaw && typeof detailsRaw === 'object' && !Array.isArray(detailsRaw)
      ? { ...(detailsRaw as Record<string, unknown>) }
      : {}

  const prevPc =
    details.primaryContact && typeof details.primaryContact === 'object' && !Array.isArray(details.primaryContact)
      ? { ...(details.primaryContact as Record<string, unknown>) }
      : {}

  const rawName = String(primary.name || '').trim()
  const parts = rawName.split(/\s+/).filter(Boolean)
  const firstName = parts[0] ? String(parts[0]) : String(prevPc.firstName || '')
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : String(prevPc.lastName || '')

  const email =
    (primary.email ?? (typeof prevPc.email === 'string' ? prevPc.email : '')) || ''
  const phone =
    (primary.phone ?? (typeof prevPc.phone === 'string' ? prevPc.phone : '')) || ''
  const roleLabel =
    (primary.title ?? (typeof prevPc.roleLabel === 'string' ? prevPc.roleLabel : '')) || ''

  details.primaryContact = {
    ...prevPc,
    id: primary.id,
    firstName,
    lastName,
    email,
    phone,
    roleLabel,
  }

  ad.accountDetails = details
  ad.contactPersons = rawName || String(ad.contactPersons || '')
  ad.contactEmail = email
  ad.contactNumber = phone
  ad.contactRoleLabel = roleLabel

  return ad
}

export function buildPrimaryContactDisplayName(primary: {
  firstName?: unknown
  lastName?: unknown
  email?: unknown
}): string {
  const first = typeof primary.firstName === 'string' ? primary.firstName : ''
  const last = typeof primary.lastName === 'string' ? primary.lastName : ''
  const full = `${first} ${last}`.trim()
  if (full) return full
  if (typeof primary.email === 'string' && primary.email.trim()) {
    const local = primary.email.split('@')[0]?.trim()
    return local || 'Primary contact'
  }
  return 'Primary contact'
}
