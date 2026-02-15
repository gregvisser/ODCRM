import type { Request } from 'express'
import { verifyMicrosoftJwtAndExtractIdentity } from './entraJwt.js'

export type VerifiedActorIdentity = {
  userId: string | null
  email: string | null
  emailNormalized: string | null
  source: 'azure_swa' | 'jwt' | 'session' | 'none'
  claimUsed: string | null
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function parseAzureClientPrincipal(req: Request): null | {
  userId?: string
  userDetails?: string
  claims?: Array<{ typ?: string; val?: string }>
} {
  const azurePrincipal = req.headers['x-ms-client-principal'] as string | undefined
  if (!azurePrincipal) return null
  try {
    const decoded = Buffer.from(azurePrincipal, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

function extractEmailFromSwaPrincipal(principal: any): {
  emailRaw: string | null
  emailNormalized: string | null
  claimUsed: string | null
} {
  const claims = Array.isArray(principal?.claims) ? principal.claims : []

  const findClaim = (typ: string): string | null => {
    const found = claims.find((c: any) => String(c?.typ || '').trim().toLowerCase() === typ)
    const v = String(found?.val || '').trim()
    return v ? v : null
  }

  // Priority order aligned with /api/users/me:
  // preferred_username OR email OR upn OR userDetails
  const preferred = findClaim('preferred_username')
  const email = findClaim('email')
  const upn = findClaim('upn')
  const details = typeof principal?.userDetails === 'string' ? principal.userDetails.trim() : null

  const emailRaw = preferred || email || upn || details || null
  const emailNormalized = emailRaw ? normalizeEmail(emailRaw) : null
  const claimUsed = preferred
    ? 'preferred_username'
    : email
      ? 'email'
      : upn
        ? 'upn'
        : details
          ? 'userDetails'
          : null

  return { emailRaw, emailNormalized, claimUsed }
}

/**
 * Extract authenticated actor identity for auditing.
 *
 * CRITICAL:
 * - Never trusts request body/query for identity.
 * - Supports SWA client principal header OR verified Microsoft Entra JWT.
 * - This is intended for server-side auditing so it still works if the frontend is bypassed.
 */
export async function getVerifiedActorIdentity(req: Request): Promise<VerifiedActorIdentity> {
  // 1) Azure Static Web Apps client principal
  const principal = parseAzureClientPrincipal(req)
  if (principal) {
    const { emailNormalized, claimUsed } = extractEmailFromSwaPrincipal(principal)
    const userId = typeof principal.userId === 'string' && principal.userId.trim() ? principal.userId.trim() : null
    const email = emailNormalized
    if (email || userId) {
      return {
        userId,
        email,
        emailNormalized: email,
        source: 'azure_swa',
        claimUsed,
      }
    }
  }

  // 2) Verified Microsoft Entra JWT (Authorization: Bearer)
  const authHeader = (req.headers['authorization'] as string | undefined) || ''
  if (authHeader.startsWith('Bearer ')) {
    const expectedAudience = process.env.MICROSOFT_CLIENT_ID || process.env.AZURE_CLIENT_ID || ''
    // SECURITY: If audience is not configured, do NOT accept bearer tokens.
    // This mirrors /api/users/me behavior and avoids weakening auth.
    if (!expectedAudience) {
      return {
        userId: null,
        email: null,
        emailNormalized: null,
        source: 'none',
        claimUsed: null,
      }
    }
    const token = authHeader.slice(7).trim()
    const verified = await verifyMicrosoftJwtAndExtractIdentity({
      token,
      expectedAudience,
    })
    return {
      userId: verified.oid || verified.sub || null,
      email: verified.emailNormalized,
      emailNormalized: verified.emailNormalized,
      source: 'jwt',
      claimUsed: verified.claimUsed || 'bearer',
    }
  }

  // 3) Session (if present)
  if ((req as any).user) {
    const user = (req as any).user
    const email = typeof user.email === 'string' ? normalizeEmail(user.email) : null
    const userId = (typeof user.id === 'string' && user.id) || (typeof user.userId === 'string' && user.userId) || null
    return {
      userId,
      email,
      emailNormalized: email,
      source: 'session',
      claimUsed: email ? 'session.email' : userId ? 'session.userId' : null,
    }
  }

  // 4) Development-only override (explicitly configured)
  // This keeps local development unblocked without weakening production auth.
  if (process.env.NODE_ENV === 'development') {
    const devEmailRaw = String(process.env.ODCRM_DEV_ACTOR_EMAIL || '').trim()
    if (devEmailRaw) {
      const devEmail = normalizeEmail(devEmailRaw)
      return {
        userId: null,
        email: devEmail,
        emailNormalized: devEmail,
        source: 'none',
        claimUsed: 'ODCRM_DEV_ACTOR_EMAIL',
      }
    }
  }

  return {
    userId: null,
    email: null,
    emailNormalized: null,
    source: 'none',
    claimUsed: null,
  }
}

