export type InboxOptOutTarget = {
  email: string
  domain: string | null
}

export function deriveInboxOptOutTarget(fromAddress: string): InboxOptOutTarget {
  const email = String(fromAddress || '').trim().toLowerCase()
  const domainPart = email.split('@')[1] || ''
  const domain = domainPart && !domainPart.includes('@') ? domainPart : null

  return {
    email,
    domain,
  }
}
