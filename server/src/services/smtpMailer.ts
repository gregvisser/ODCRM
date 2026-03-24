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
    console.error('[SMTP] Send failed:', message)
    return { ok: false, error: message }
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
    return { ok: false, error: message }
  }
}
