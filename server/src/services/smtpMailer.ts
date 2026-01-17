/**
 * SMTP Email Sending Service
 * NOTE: SMTP functionality disabled - using Microsoft Graph/Outlook instead
 * This file is kept for compatibility but all functions return errors
 */

import type { email_identities } from '@prisma/client'

export type SendEmailResult = { ok: true } | { ok: false; error: string }

export interface SmtpAccount {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUsername: string
  smtpPassword: string
  emailAddress: string
  displayName?: string | null
}

/**
 * Send email via SMTP
 */
export async function sendEmailViaSMTP(args: {
  account: SmtpAccount
  to: string
  subject: string
  text?: string
  html?: string
}): Promise<SendEmailResult> {
  // SMTP functionality disabled
  return { ok: false, error: 'SMTP not configured - use Outlook instead' }
  /* const { account, to, subject, text, html } = args

  try {
    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure,
      auth: {
        user: account.smtpUsername,
        pass: account.smtpPassword,
      },
    })

    // Verify connection
    await transporter.verify()

    // Send email
    await transporter.sendMail({
      from: {
        name: account.displayName || account.emailAddress,
        address: account.emailAddress,
      },
      to,
      subject,
      text,
      html,
    })

    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown SMTP error'
    console.error('[SMTP] Send failed:', message)
    return { ok: false, error: message }
  } */
}

/**
 * Send email using EmailIdentity record (supports both SMTP and OAuth)
 */
export async function sendEmail(args: {
  identity: email_identities
  to: string
  subject: string
  text?: string
  html?: string
}): Promise<SendEmailResult> {
  const { identity, to, subject, text, html } = args

  // Use SMTP if configured
  if (identity.provider === 'smtp' && identity.smtpHost && identity.smtpPort && identity.smtpUsername && identity.smtpPassword) {
    return sendEmailViaSMTP({
      account: {
        smtpHost: identity.smtpHost,
        smtpPort: identity.smtpPort,
        smtpSecure: identity.smtpSecure ?? true,
        smtpUsername: identity.smtpUsername,
        smtpPassword: identity.smtpPassword,
        emailAddress: identity.emailAddress,
        displayName: identity.displayName,
      },
      to,
      subject,
      text,
      html,
    })
  }

  // Use OAuth (Outlook) - delegate to existing outlookEmailService
  if (identity.provider === 'outlook') {
    // This will be handled by the existing ODCRM outlook service
    return {
      ok: false,
      error: 'OAuth sending not yet integrated with unified service',
    }
  }

  return {
    ok: false,
    error: `Unsupported email provider: ${identity.provider}`,
  }
}

/**
 * Test SMTP connection
 */
export async function testSmtpConnection(account: SmtpAccount): Promise<SendEmailResult> {
  return { ok: false, error: 'SMTP not configured - use Outlook instead' }
}
