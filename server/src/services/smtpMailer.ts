/**
 * SMTP outbound sending for EmailIdentity records with provider === 'smtp'.
 * Used by outlookEmailService.sendEmail and /api/outlook/identities/:id/test-send.
 */

import { randomUUID } from 'node:crypto'
import nodemailer from 'nodemailer'
import type { EmailIdentity } from '@prisma/client'

export type SendEmailResult = { ok: true; messageId: string } | { ok: false; error: string }

export interface SmtpAccount {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUsername: string
  smtpPassword: string
  emailAddress: string
  displayName?: string | null
}

function normalizeSmtpMessageId(raw: string | undefined): string {
  const cleaned = (raw || '').replace(/[<>]/g, '').trim()
  if (cleaned) return `smtp:${cleaned}`
  return `smtp:${randomUUID()}`
}

/**
 * Pull a short human-readable SMTP-style line for UI (e.g. "535 5.7.8 Username and Password not accepted.").
 * Strips opaque provider IDs, session tokens, and suffixes like "- gsmtp". Full raw stays in logs only.
 */
export function extractSanitizedSmtpProviderLine(raw: string): string | null {
  const oneLine = raw.replace(/https?:\/\/[^\s>]+/gi, '').replace(/\s+/g, ' ').trim()
  const low = oneLine.toLowerCase()

  // Prefer canonical phrases when the raw text clearly contains them (ignore token noise elsewhere).
  if (low.includes('username and password not accepted')) {
    return '535 5.7.8 Username and Password not accepted.'
  }
  if (low.includes('invalid mail or password') || low.includes('invalid user name or password')) {
    return '535 5.7.8 Invalid username or password.'
  }
  if (low.includes('invalid credentials') || low.includes('credentials invalid')) {
    return '535 5.7.8 Invalid credentials.'
  }
  if (
    low.includes('authentication failed') ||
    low.includes('authentication unsuccessful') ||
    low.includes('login failed')
  ) {
    return '535 5.7.8 Authentication failed.'
  }

  // Strip provider routing suffixes and opaque blobs (Gmail gsmtp IDs, long hex, hyphenated session IDs).
  let s = oneLine
    .replace(/\s*-\s*gsmtp\s*$/i, '')
    .replace(/\s*-\s*outlook\.com\s*$/i, '')
    .replace(/\s*-\s*res\.smtp\.[^\s]+$/i, '')
    .trim()
  s = s.replace(/\b[a-f0-9]{8,}(?:-[a-f0-9.]+)*(?:\.[a-f0-9]{2,})?\b/gi, ' ')
  s = s.replace(/\b[a-z0-9]{6,}-[a-z0-9-]{6,}(?:\.[a-z0-9]{2,})?\b/gi, ' ')
  s = s.replace(/\b[a-f0-9:_-]{24,}\b/gi, ' ')
  s = s.replace(/\s+/g, ' ').trim()

  const m = s.match(/\b([45]\d\d(?:\s+\d+\.\d+\.\d+|-\d+\.\d+\.\d+)?)\b/)
  if (!m) return null

  const normalizedCode = m[1].replace(/-/g, ' ')
  const afterCode = s.slice((m.index ?? 0) + m[0].length).trim().replace(/^[-–—]\s*/, '')
  const afterClean = afterCode
    .replace(/\b[a-f0-9]{6,}\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = afterClean
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-zA-Z]{2,}/.test(w) && !/^[a-f0-9]+$/i.test(w))

  if (words.length >= 2) {
    const tail = words.slice(0, 14).join(' ')
    return `${normalizedCode} ${tail}`.slice(0, 220)
  }

  // Mostly token noise after stripping — generic short line for typical auth failures
  if (/^5\d\d/.test(m[1])) {
    return '535 5.7.8 Authentication failed.'
  }
  if (/^4\d\d/.test(m[1])) {
    return '535 5.7.8 Authentication failed.'
  }
  return null
}

/**
 * Operator-facing SMTP error for API/UI (toasts, test-send). Does not include full provider dumps.
 * Logs should use the raw nodemailer message separately.
 */
export function formatSmtpErrorForOperatorUi(raw: string): string {
  const m = raw.toLowerCase()
  const providerLine = extractSanitizedSmtpProviderLine(raw)

  const withOptionalProvider = (body: string) =>
    providerLine ? `${body}\n\nProvider response: ${providerLine}` : body

  if (
    m.includes('invalid login') ||
    m.includes('authentication failed') ||
    m.includes('535') ||
    m.includes('eauth') ||
    m.includes('badcredentials')
  ) {
    return withOptionalProvider(
      'SMTP login was rejected. For a Google-hosted mailbox (Gmail or Google Workspace) with 2FA, create an app password and use your full email address as the username.'
    )
  }
  if (m.includes('certificate') || m.includes('self signed') || m.includes('unable to verify the first certificate')) {
    return withOptionalProvider(
      'TLS or certificate problem contacting the SMTP server. Check host/port and that “implicit SSL” matches your provider (465 vs 587).'
    )
  }
  if (m.includes('timeout') || m.includes('econnrefused') || m.includes('enotfound') || m.includes('getaddrinfo')) {
    return withOptionalProvider(
      'Could not reach the SMTP host. Check the hostname, port, firewall, and DNS.'
    )
  }
  const fallback = 'SMTP send failed. Check your SMTP settings and try again.'
  return withOptionalProvider(fallback)
}

/** @deprecated Use formatSmtpErrorForOperatorUi — kept name for call sites expecting “mapped” UI text. */
export function mapSmtpErrorForOperator(raw: string): string {
  return formatSmtpErrorForOperatorUi(raw)
}

/**
 * Send email via SMTP (Gmail, Google Workspace, custom mail servers, etc.)
 */
export async function sendEmailViaSMTP(args: {
  account: SmtpAccount
  to: string
  subject: string
  text?: string
  html?: string
  headers?: Record<string, string>
}): Promise<SendEmailResult> {
  const { account, to, subject, text, html } = args

  try {
    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure === true,
      auth: {
        user: account.smtpUsername,
        pass: account.smtpPassword,
      },
    })

    const info = await transporter.sendMail({
      from: {
        name: account.displayName || account.emailAddress,
        address: account.emailAddress,
      },
      to,
      subject,
      text,
      html,
      headers: args.headers && Object.keys(args.headers).length ? args.headers : undefined,
    })

    const messageId = normalizeSmtpMessageId(info.messageId)
    return { ok: true, messageId }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown SMTP error'
    console.error('[SMTP] Send failed (raw):', message)
    return { ok: false, error: formatSmtpErrorForOperatorUi(message) }
  }
}

/**
 * Send an outbound message using a stored SMTP identity.
 */
export async function sendOutboundSmtpMail(args: {
  identity: EmailIdentity
  to: string
  subject: string
  htmlBody: string
  textBody?: string
  customHeaders?: Record<string, string>
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { identity, to, subject, htmlBody, textBody, customHeaders } = args

  if (
    identity.provider !== 'smtp' ||
    !identity.smtpHost ||
    !identity.smtpPort ||
    !identity.smtpUsername ||
    !identity.smtpPassword
  ) {
    return {
      success: false,
      error: 'SMTP identity is missing host, port, username, or password',
    }
  }

  const result = await sendEmailViaSMTP({
    account: {
      smtpHost: identity.smtpHost,
      smtpPort: identity.smtpPort,
      smtpSecure: identity.smtpSecure ?? false,
      smtpUsername: identity.smtpUsername,
      smtpPassword: identity.smtpPassword,
      emailAddress: identity.emailAddress,
      displayName: identity.displayName,
    },
    to,
    subject,
    html: htmlBody,
    text: textBody,
    headers: customHeaders,
  })

  if (result.ok === false) {
    return { success: false, error: result.error }
  }
  return { success: true, messageId: result.messageId }
}

/**
 * Server-side checks for POST /api/outlook/identities (SMTP). Returns error message or null.
 */
export function validateSmtpIdentityUpsertPayload(p: {
  smtpHost: unknown
  smtpPort: unknown
  smtpSecure: unknown
}): string | null {
  const portNum = Number(p.smtpPort)
  if (!Number.isFinite(portNum) || portNum < 1 || portNum > 65535) {
    return 'SMTP port must be a number between 1 and 65535.'
  }
  const host = String(p.smtpHost ?? '').trim()
  if (!host || host.length > 253 || /\s/.test(host)) {
    return 'SMTP host is invalid.'
  }
  const secure = Boolean(p.smtpSecure)
  if (secure && portNum === 587) {
    return 'Port 587 normally uses STARTTLS — turn off implicit SSL, or use port 465 with implicit SSL on.'
  }
  if (!secure && portNum === 465) {
    return 'Port 465 usually requires implicit SSL — enable it, or use port 587 with STARTTLS.'
  }
  return null
}

/** Verify SMTP credentials (connection + auth) via nodemailer.verify(); does not send mail. */
export async function testSmtpConnection(account: SmtpAccount): Promise<SendEmailResult> {
  try {
    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure === true,
      auth: {
        user: account.smtpUsername,
        pass: account.smtpPassword,
      },
    })
    await transporter.verify()
    return { ok: true, messageId: 'smtp:verified' }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown SMTP error'
    console.error('[SMTP] verify failed (raw):', message)
    return { ok: false, error: formatSmtpErrorForOperatorUi(message) }
  }
}
