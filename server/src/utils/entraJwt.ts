import { createRemoteJWKSet, jwtVerify } from 'jose'

type VerifiedMicrosoftIdentity = {
  emailRaw: string | null
  emailNormalized: string | null
  claimUsed: string | null
  tid?: string | null
  oid?: string | null
  sub?: string | null
  aud?: string | string[] | null
  iss?: string | null
}

const jwks = createRemoteJWKSet(new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys'))

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function extractEmailFromPayload(payload: Record<string, any>): {
  emailRaw: string | null
  emailNormalized: string | null
  claimUsed: string | null
} {
  const preferred = typeof payload.preferred_username === 'string' ? payload.preferred_username : null
  const email = typeof payload.email === 'string' ? payload.email : null
  const upn = typeof payload.upn === 'string' ? payload.upn : null
  const uniqueName = typeof payload.unique_name === 'string' ? payload.unique_name : null

  const emailRaw = (preferred || email || upn || uniqueName || '').trim() || null
  const emailNormalized = emailRaw ? normalizeEmail(emailRaw) : null
  const claimUsed = preferred
    ? 'preferred_username'
    : email
      ? 'email'
      : upn
        ? 'upn'
        : uniqueName
          ? 'unique_name'
          : null

  return { emailRaw, emailNormalized, claimUsed }
}

function isIssuerLikelyMicrosoftV2(iss: unknown): boolean {
  if (typeof iss !== 'string') return false
  return iss.startsWith('https://login.microsoftonline.com/') && iss.endsWith('/v2.0')
}

/**
 * Verify a Microsoft Entra ID JWT and extract normalized email.
 *
 * Supports being called from a separate backend (App Service) where Azure SWA
 * client-principal headers are not available. Uses remote JWKS validation.
 */
export async function verifyMicrosoftJwtAndExtractIdentity(opts: {
  token: string
  expectedAudience?: string
}): Promise<VerifiedMicrosoftIdentity> {
  const { token, expectedAudience } = opts

  const { payload } = await jwtVerify(token, jwks, {
    ...(expectedAudience ? { audience: expectedAudience } : {}),
  })

  if (!isIssuerLikelyMicrosoftV2(payload.iss)) {
    const err = new Error('Invalid token issuer') as Error & { code?: string }
    err.code = 'invalid_issuer'
    throw err
  }

  const { emailRaw, emailNormalized, claimUsed } = extractEmailFromPayload(payload as any)
  return {
    emailRaw,
    emailNormalized,
    claimUsed,
    tid: typeof (payload as any).tid === 'string' ? (payload as any).tid : null,
    oid: typeof (payload as any).oid === 'string' ? (payload as any).oid : null,
    sub: typeof (payload as any).sub === 'string' ? (payload as any).sub : null,
    aud: (payload as any).aud ?? null,
    iss: typeof (payload as any).iss === 'string' ? (payload as any).iss : null,
  }
}

