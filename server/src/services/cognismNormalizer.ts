/**
 * Map Cognism redeem/search payloads into Lead Sources canonical row shape
 * (aligned with leadSourcesCanonicalMapping field names).
 */

export interface CognismNormalizedRow {
  canonical: {
    firstName: string
    lastName: string
    email: string
    linkedinUrl: string
    companyName: string
    jobTitle: string
    country: string
    city: string
    mobile: string
    directPhone: string
    officePhone: string
    website: string
    client: string
  }
  extraFields: Record<string, string>
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function firstPhone(phones: unknown): string {
  if (!Array.isArray(phones) || phones.length === 0) return ''
  const p0 = phones[0] as { number?: string }
  return str(p0?.number)
}

/**
 * Redeem response contact object (subset; fields vary by entitlement).
 */
export function normalizeCognismRedeemedContact(raw: Record<string, unknown>): CognismNormalizedRow {
  const emailObj = raw.email as { address?: string } | undefined
  const email = str(emailObj?.address)
  const account = raw.account as Record<string, unknown> | undefined
  const companyName = str(account?.name)
  const website = str(account?.website)
  const jobTitle = str(raw.jobTitle)
  const firstName = str(raw.firstName)
  const lastName = str(raw.lastName)
  const linkedinUrl = str(raw.linkedinUrl)
  const country = str(raw.country)
  const city = str(raw.city)
  const mobile = firstPhone(raw.mobilePhoneNumbers)
  const directPhone = firstPhone(raw.directPhoneNumbers)
  const officePhone = firstPhone(account?.officePhoneNumbers as unknown)

  const id = str(raw.id)
  const redeemId = str(raw.redeemId)

  const cognismRaw = JSON.stringify(raw).slice(0, 50_000)

  const canonical = {
    firstName,
    lastName,
    email,
    linkedinUrl,
    companyName,
    jobTitle,
    country,
    city,
    mobile,
    directPhone,
    officePhone,
    website,
    client: companyName,
  }

  const extraFields: Record<string, string> = {
    cognismContactId: id,
    cognismRedeemId: redeemId,
    provider: 'cognism',
    sourceType: 'COGNISM',
    cognismRaw,
  }

  return { canonical, extraFields }
}

export function cognismNormalizedToFlatRow(row: CognismNormalizedRow): Record<string, string> {
  return {
    ...row.canonical,
    ...row.extraFields,
  }
}
