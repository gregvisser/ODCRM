/**
 * Client-side validation for SMTP outreach identities (non-Microsoft mailboxes).
 * Keep aligned with server checks in `server/src/routes/outlook.ts` POST /identities.
 */

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmailLike(s: string): boolean {
  const t = s.trim()
  return t.length > 3 && EMAIL_LIKE.test(t)
}

export function validateSmtpHost(host: string): { ok: true } | { ok: false; message: string } {
  const h = host.trim()
  if (!h) return { ok: false, message: 'SMTP host is required.' }
  if (/\s/.test(h)) return { ok: false, message: 'SMTP host must not contain spaces.' }
  if (h.length > 253) return { ok: false, message: 'SMTP host is too long.' }
  return { ok: true }
}

export function validateSmtpPort(port: number): { ok: true } | { ok: false; message: string } {
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return { ok: false, message: 'Port must be between 1 and 65535.' }
  }
  return { ok: true }
}

/**
 * Nodemailer: `secure: true` = implicit TLS (typical port 465). Port 587 uses STARTTLS with `secure: false`.
 */
export function validateImplicitSslVsPort(
  smtpSecure: boolean,
  port: number
): { ok: true } | { ok: false; message: string } {
  if (smtpSecure && port === 587) {
    return {
      ok: false,
      message:
        'Port 587 normally uses STARTTLS — turn off “Use implicit SSL (port 465)”. Or use port 465 with implicit SSL on.',
    }
  }
  if (!smtpSecure && port === 465) {
    return {
      ok: false,
      message:
        'Port 465 usually requires implicit SSL — enable “Use implicit SSL (port 465)”, or use port 587 with it off.',
    }
  }
  return { ok: true }
}

export type SmtpFormInput = {
  emailAddress: string
  smtpHost: string
  smtpPort: number
  smtpUsername: string
  smtpPassword: string
  smtpSecure: boolean
}

/** Returns first error message, or null if valid. */
export function validateSmtpIdentityForm(input: SmtpFormInput): string | null {
  if (!isValidEmailLike(input.emailAddress)) {
    return 'Enter a valid “From” email address (the address recipients will see).'
  }
  const host = validateSmtpHost(input.smtpHost)
  if (!host.ok) return host.message
  const port = validateSmtpPort(input.smtpPort)
  if (!port.ok) return port.message
  const tls = validateImplicitSslVsPort(input.smtpSecure, input.smtpPort)
  if (!tls.ok) return tls.message
  const u = input.smtpUsername.trim()
  if (!u) return 'SMTP username is required (often your full email address).'
  if (!input.smtpPassword.trim()) return 'SMTP password or app password is required.'
  return null
}
