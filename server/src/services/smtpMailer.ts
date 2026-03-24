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
 * Pull a short SMTP-style line (e.g. "535 5.7.8 ...") for UI — no URLs or long opaque tokens.
 * Full raw message must only appear in server logs, not in API/toast text.
 */
export function extractSanitizedSmtpProviderLine(raw: string): string | null {
  const noUrl = raw.replace(/https?:\/\/[^\s>]+/gi, '').replace(/\s+/g, ' ').trim()
  const noOpaque = noUrl.replace(/[a-fA-F0-9:_-]{40,}/g, '').trim()
  const m = noOpaque.match(/\b([45]\d\d(?:\.\d+\.\d+)?)\s+(.{1,200})/)
  if (m) {
    const rest = m[2].trim()
    const line = `${m[1]} ${rest}`.trim()
    return line.length > 220 ? `${line.slice(0, 217)}...` : line
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
      'SMTP login was rejected. For Gmail / Google Workspace with 2FA, create an app password and use your full email address as the username.'
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
 * Verify SMTP credentials (login + connection) without sending mail.
 */
/** Server-side checks for POST /api/outlook/identities (SMTP). Returns error message or null. */
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
