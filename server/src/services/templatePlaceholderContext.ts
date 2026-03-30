/**
 * Single source of truth for outbound/preview email template placeholder variables.
 * Separates target-recipient context from sending-client/sender-identity context.
 */
import type { TemplateVariables } from './templateRenderer.js'
import { buildPreviewTemplateVariables } from './templateRenderer.js'

function norm(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s).trim()
}

function titleCaseToken(s: string): string {
  const t = s.trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

/**
 * Deterministic company label from registrable domain, e.g. bidlow.co.uk -> Bidlow, company.com -> Company.
 */
export function companyLabelFromEmailDomain(email: string): string {
  const at = email.trim().toLowerCase().lastIndexOf('@')
  if (at < 0 || at === email.length - 1) return ''
  const domain = email.slice(at + 1).toLowerCase().trim()
  const parts = domain.split('.').filter(Boolean)
  if (parts.length === 0) return ''

  const multiSecond = new Set(['co', 'com', 'gov', 'net', 'org', 'ac', 'edu', 'govt', 'ltd'])
  if (parts.length >= 3) {
    const sld = parts[parts.length - 2]
    if (multiSecond.has(sld)) {
      return titleCaseToken(parts[parts.length - 3])
    }
  }
  if (parts.length >= 2) {
    return titleCaseToken(parts[parts.length - 2])
  }
  return titleCaseToken(parts[0])
}

export function websiteFromEmailDomain(email: string): string {
  const at = email.trim().toLowerCase().lastIndexOf('@')
  if (at < 0 || at === email.length - 1) return ''
  const domain = email.slice(at + 1).toLowerCase().trim()
  if (!domain) return ''
  return `https://${domain}`
}

function parseLocalPart(local: string): { first: string; last: string } {
  const raw = local.trim()
  if (!raw) return { first: '', last: '' }
  const segments = raw.split(/[._]+/).filter(Boolean)
  if (segments.length === 0) return { first: '', last: '' }
  if (segments.length === 1) {
    return { first: titleCaseToken(segments[0]), last: '' }
  }
  return {
    first: titleCaseToken(segments[0]),
    last: titleCaseToken(segments.slice(1).join(' ')),
  }
}

/**
 * Fallback when no bound contact/prospect row (or sparse row): derive from recipient email only.
 */
export function deriveRecipientFromEmailFallback(recipientEmail: string): {
  first_name: string
  last_name: string
  full_name: string
  company_name: string
  website: string
} {
  const email = recipientEmail.trim()
  const at = email.lastIndexOf('@')
  if (at < 1 || at === email.length - 1) {
    return { first_name: '', last_name: '', full_name: '', company_name: '', website: '' }
  }
  const local = email.slice(0, at)
  const { first, last } = parseLocalPart(local)
  const company_name = companyLabelFromEmailDomain(email)
  const website = websiteFromEmailDomain(email)
  const full_name = [first, last].filter(Boolean).join(' ').trim() || first
  return { first_name: first, last_name: last, full_name, company_name, website }
}

export type TargetRecipientInput = {
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  companyName?: string | null
  jobTitle?: string | null
  website?: string | null
  phone?: string | null
}

export type SenderCustomerInput = {
  name: string
  website?: string | null
  domain?: string | null
}

export type SenderIdentityInput = {
  displayName?: string | null
  emailAddress?: string | null
  signatureHtml?: string | null
}

/**
 * Build variables for live send, queue send, dry-run render, and any path that must match preview semantics.
 */
export function buildTemplateVariablesForSend(args: {
  recipientEmail: string
  target?: TargetRecipientInput | null
  senderCustomer: SenderCustomerInput
  senderIdentity: SenderIdentityInput
  unsubscribeLink?: string | null
}): TemplateVariables {
  const email = args.recipientEmail.trim()
  const derived = deriveRecipientFromEmailFallback(email)
  const t = args.target

  const first_name = norm(t?.firstName) || derived.first_name
  const last_name = norm(t?.lastName) || derived.last_name
  const full_from_parts = [first_name, last_name].filter(Boolean).join(' ').trim()
  const full_name = norm(t?.fullName) || full_from_parts || derived.full_name

  const company_name = norm(t?.companyName) || derived.company_name
  const role = norm(t?.jobTitle)
  const website = norm(t?.website) || derived.website
  const phone = norm(t?.phone)

  const senderName =
    norm(args.senderIdentity.displayName) || norm(args.senderIdentity.emailAddress)
  const senderEmail = norm(args.senderIdentity.emailAddress)
  const sig = norm(args.senderIdentity.signatureHtml)
  const unsub = norm(args.unsubscribeLink)

  const sender_company_name = norm(args.senderCustomer.name)

  return {
    first_name,
    firstName: first_name,
    last_name,
    lastName: last_name,
    full_name,
    fullName: full_name,
    company_name,
    companyName: company_name,
    company: company_name,
    accountName: company_name,
    account_name: company_name,
    email,
    role,
    jobTitle: role,
    title: role,
    phone,
    website,
    sender_name: senderName,
    senderName,
    sender_email: senderEmail,
    senderEmail,
    sender_company_name,
    senderCompanyName: sender_company_name,
    client_name: sender_company_name,
    clientName: sender_company_name,
    email_signature: sig || undefined,
    emailSignature: sig || undefined,
    sender_signature: sig || undefined,
    senderSignature: sig || undefined,
    unsubscribe_link: unsub || undefined,
    unsubscribeLink: unsub || undefined,
  }
}

function readVar(rv: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = rv[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/**
 * Resolve variables for POST /api/templates/preview — must not mix tenant name into recipient company placeholders.
 */
export function resolvePreviewTemplateVariables(input: {
  requestedVariables: Record<string, unknown>
  senderCustomer: { name: string; website?: string | null; domain?: string | null } | null
  senderName?: string | null
  senderEmail?: string | null
  signatureHtml?: string | null
}): TemplateVariables {
  const rv = input.requestedVariables
  const base = buildPreviewTemplateVariables()

  const email = readVar(rv, 'email', 'recipient_email', 'recipientEmail')
  const derived = email ? deriveRecipientFromEmailFallback(email) : null

  const first_name =
    readVar(rv, 'first_name', 'firstName') ||
    (derived?.first_name ?? '') ||
    norm(base.first_name)

  const last_name =
    readVar(rv, 'last_name', 'lastName') ||
    (derived?.last_name ?? '') ||
    norm(base.last_name)

  const full_name =
    readVar(rv, 'full_name', 'fullName', 'contact_name', 'contactName') ||
    [first_name, last_name].filter(Boolean).join(' ').trim() ||
    (derived?.full_name ?? '') ||
    norm(base.full_name)

  const company_name =
    readVar(rv, 'company_name', 'companyName', 'company', 'accountName', 'account_name') ||
    (derived?.company_name ?? '') ||
    norm(base.company_name)

  const website =
    readVar(rv, 'website') || (derived?.website ?? '') || norm(base.website)

  const role = readVar(rv, 'role', 'jobTitle', 'title') || norm(base.role ?? '')

  const sender_company_name =
    readVar(rv, 'sender_company_name', 'senderCompanyName', 'client_name', 'clientName') ||
    (input.senderCustomer?.name ?? '') ||
    'Preview Client'

  const sender_name =
    readVar(rv, 'sender_name', 'senderName') || norm(input.senderName) || norm(base.sender_name)
  const sender_email =
    readVar(rv, 'sender_email', 'senderEmail') || norm(input.senderEmail) || norm(base.sender_email)

  const email_signature =
    readVar(rv, 'email_signature', 'emailSignature', 'sender_signature', 'senderSignature') ||
    norm(input.signatureHtml) ||
    norm(base.email_signature)

  const unsubscribe_link =
    readVar(rv, 'unsubscribe_link', 'unsubscribeLink') || norm(base.unsubscribe_link)

  const phone = readVar(rv, 'phone') || norm(base.phone ?? '')

  return buildPreviewTemplateVariables({
    first_name,
    last_name,
    full_name,
    company_name,
    companyName: company_name,
    company: company_name,
    accountName: company_name,
    account_name: company_name,
    website,
    role,
    phone,
    email: email || norm(base.email),
    sender_name,
    senderName: sender_name,
    sender_email,
    senderEmail: sender_email,
    sender_company_name,
    senderCompanyName: sender_company_name,
    client_name: sender_company_name,
    clientName: sender_company_name,
    email_signature,
    emailSignature: email_signature,
    sender_signature: email_signature,
    senderSignature: email_signature,
    unsubscribe_link,
    unsubscribeLink: unsubscribe_link,
  })
}
