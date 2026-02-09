/**
 * Authentication utilities for deriving user identity from request context
 * 
 * CRITICAL: Never trust client-supplied identity. Only use server-side auth context.
 */

import type { Request } from 'express'

export interface ActorIdentity {
  userId: string | null
  email: string | null
  source: 'azure_swa' | 'jwt' | 'session' | 'none'
}

/**
 * Extract authenticated user identity from request
 * 
 * Checks multiple sources in priority order:
 * 1. Azure Static Web Apps auth (x-ms-client-principal header)
 * 2. JWT token (Authorization: Bearer header)
 * 3. Session (req.user from session middleware)
 * 
 * NEVER trusts client-supplied identity fields from request body/query.
 * 
 * @param req - Express request object
 * @returns ActorIdentity with userId/email if authenticated, or nulls if not
 * 
 * @example
 * const actor = getActorIdentity(req)
 * if (actor.email) {
 *   // User is authenticated
 *   auditEvent.actorEmail = actor.email
 * } else {
 *   // Anonymous action (allowed for some operations)
 *   auditEvent.actorEmail = null
 * }
 */
export function getActorIdentity(req: Request): ActorIdentity {
  // 1. Try Azure Static Web Apps authentication
  // Azure SWA injects x-ms-client-principal header with base64-encoded JSON
  const azurePrincipal = req.headers['x-ms-client-principal'] as string | undefined
  if (azurePrincipal) {
    try {
      const decoded = Buffer.from(azurePrincipal, 'base64').toString('utf-8')
      const principal = JSON.parse(decoded)
      
      if (principal.userDetails || principal.userId) {
        return {
          userId: principal.userId || null,
          email: principal.userDetails || principal.claims?.find((c: any) => c.typ === 'email')?.val || null,
          source: 'azure_swa'
        }
      }
    } catch (err) {
      // Invalid principal header - continue to next method
      console.warn('[Auth] Failed to parse x-ms-client-principal:', err)
    }
  }

  // 2. Try JWT token from Authorization header
  const authHeader = req.headers['authorization'] as string | undefined
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    // TODO: Decode and verify JWT when JWT auth is implemented
    // For now, we don't have JWT infrastructure, so skip
  }

  // 3. Try session (if session middleware is used)
  if ((req as any).user) {
    const user = (req as any).user
    return {
      userId: user.id || user.userId || null,
      email: user.email || null,
      source: 'session'
    }
  }

  // 4. No authentication found
  return {
    userId: null,
    email: null,
    source: 'none'
  }
}

/**
 * Check if request has authenticated user
 */
export function isAuthenticated(req: Request): boolean {
  const actor = getActorIdentity(req)
  return actor.email !== null || actor.userId !== null
}
