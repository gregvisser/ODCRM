import type { NextFunction, Request, Response } from 'express'
import { verifyMicrosoftJwtAndExtractIdentity } from '../utils/entraJwt.js'

type AuthMode = 'off' | 'warn' | 'enforce'

type ActorIdentity = {
  email: string | null
  source: 'admin_secret' | 'azure_swa' | 'jwt' | 'none'
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function resolveAuthMode(): AuthMode {
  const raw = String(process.env.MARKETING_MUTATION_AUTH_MODE || 'warn').trim().toLowerCase()
  if (raw === 'off' || raw === 'warn' || raw === 'enforce') return raw
  return 'warn'
}

function parseSwaPrincipalEmail(req: Request): string | null {
  const principalRaw = req.headers['x-ms-client-principal']
  if (!principalRaw || typeof principalRaw !== 'string') return null
  try {
    const decoded = Buffer.from(principalRaw, 'base64').toString('utf-8')
    const principal = JSON.parse(decoded) as {
      userDetails?: string
      claims?: Array<{ typ?: string; val?: string }>
    }
    const claimEmail =
      principal.claims?.find((c) => (c?.typ || '').toLowerCase() === 'preferred_username')?.val ||
      principal.claims?.find((c) => (c?.typ || '').toLowerCase() === 'email')?.val ||
      principal.claims?.find((c) => (c?.typ || '').toLowerCase() === 'upn')?.val
    const raw = (claimEmail || principal.userDetails || '').trim()
    return raw ? normalizeEmail(raw) : null
  } catch {
    return null
  }
}

function getExpectedAudience(): string | null {
  const aud = process.env.MICROSOFT_CLIENT_ID || process.env.AZURE_CLIENT_ID || ''
  return aud.trim() || null
}

async function resolveActor(req: Request): Promise<ActorIdentity> {
  const configuredAdminSecret = process.env.ADMIN_SECRET
  const providedAdminSecret = req.headers['x-admin-secret']
  if (
    configuredAdminSecret &&
    typeof providedAdminSecret === 'string' &&
    providedAdminSecret === configuredAdminSecret
  ) {
    return { email: 'admin-secret@system.local', source: 'admin_secret' }
  }

  const swaEmail = parseSwaPrincipalEmail(req)
  if (swaEmail) return { email: swaEmail, source: 'azure_swa' }

  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
  if (authHeader.startsWith('Bearer ')) {
    const expectedAudience = getExpectedAudience()
    if (!expectedAudience) return { email: null, source: 'none' }
    try {
      const token = authHeader.slice('Bearer '.length).trim()
      const verified = await verifyMicrosoftJwtAndExtractIdentity({ token, expectedAudience })
      if (verified.emailNormalized) {
        return { email: verified.emailNormalized, source: 'jwt' }
      }
    } catch {
      return { email: null, source: 'none' }
    }
  }

  return { email: null, source: 'none' }
}

export async function requireMarketingMutationAuth(req: Request, res: Response, next: NextFunction) {
  const mode = resolveAuthMode()
  if (mode === 'off') {
    res.setHeader('x-odcrm-marketing-auth-mode', 'off')
    return next()
  }

  const actor = await resolveActor(req)
  const isAuthorized = !!actor.email

  if (isAuthorized) {
    res.setHeader('x-odcrm-marketing-auth-mode', mode)
    res.setHeader('x-odcrm-marketing-actor-source', actor.source)
    return next()
  }

  if (mode === 'warn') {
    console.warn('[marketing-auth] WARN allow unauthenticated marketing mutation', {
      method: req.method,
      path: req.path,
      source: actor.source,
    })
    res.setHeader('x-odcrm-marketing-auth-mode', 'warn')
    return next()
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthenticated marketing mutation request',
    details: 'Provide a valid Microsoft bearer token, Azure SWA principal header, or X-Admin-Secret',
  })
}

