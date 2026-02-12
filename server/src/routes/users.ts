// @ts-nocheck
/**
 * Users Management API
 * Migrated from localStorage to database
 */

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getActorIdentity } from '../utils/auth.js'
import { randomUUID } from 'crypto'

const router = Router()

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function parseAzureClientPrincipal(req: any): null | {
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

function extractEmailFromRequest(req: any): {
  emailRaw: string | null
  emailNormalized: string | null
  claimUsed: string | null
  availableClaimTypes: string[]
  principalPresent: boolean
  actorSource: string
} {
  const actor = getActorIdentity(req)
  const principal = parseAzureClientPrincipal(req)
  const claims = Array.isArray(principal?.claims) ? principal!.claims! : []
  const availableClaimTypes = claims
    .map((c: any) => String(c?.typ || '').trim())
    .filter(Boolean)

  const findClaim = (typ: string): string | null => {
    const found = claims.find((c: any) => String(c?.typ || '').trim().toLowerCase() === typ)
    const v = String(found?.val || '').trim()
    return v ? v : null
  }

  // Required priority: preferred_username OR email OR upn
  const preferred = findClaim('preferred_username')
  const email = findClaim('email')
  const upn = findClaim('upn')
  const details = typeof principal?.userDetails === 'string' ? principal.userDetails.trim() : null

  const emailRaw = preferred || email || upn || details || actor.email
  const emailNormalized = emailRaw ? normalizeEmail(emailRaw) : null

  const claimUsed = preferred
    ? 'preferred_username'
    : email
      ? 'email'
      : upn
        ? 'upn'
        : details
          ? 'userDetails'
          : actor.email
            ? 'actor.email'
            : null

  return {
    emailRaw: emailRaw || null,
    emailNormalized: emailNormalized || null,
    claimUsed,
    availableClaimTypes,
    principalPresent: Boolean(principal),
    actorSource: actor.source,
  }
}

async function generateUniqueUserId(): Promise<string> {
  for (let attempts = 0; attempts < 30; attempts++) {
    const randomNum = Math.floor(10000000 + Math.random() * 90000000)
    const candidate = `ODS${randomNum}`
    const exists = await prisma.user.findUnique({ where: { userId: candidate }, select: { id: true } })
    if (!exists) return candidate
  }
  // Fallback: timestamp-based
  const ts = Date.now().toString().slice(-8).padStart(8, '0')
  return `ODS${ts}`
}

// GET /api/users/me - Resolve authenticated actor + authorization status from DB
router.get('/me', async (req, res) => {
  try {
    const allowAutoProvision = String(process.env.ALLOW_AUTO_USER_PROVISION || '').toLowerCase() === 'true'
    const info = extractEmailFromRequest(req)

    if (!info.emailNormalized) {
      console.warn('[AuthZ] /api/users/me unauthenticated', {
        principalPresent: info.principalPresent,
        actorSource: info.actorSource,
        availableClaimTypes: info.availableClaimTypes.slice(0, 12),
      })
      return res.status(401).json({ authorized: false, error: 'unauthenticated' })
    }

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: info.emailNormalized, mode: 'insensitive' },
      },
    })

    if (user) {
      // Deny inactive accounts
      if (String(user.accountStatus || 'Active') !== 'Active') {
        console.warn('[AuthZ] denied (inactive user)', {
          emailNormalized: info.emailNormalized,
          claimUsed: info.claimUsed,
          actorSource: info.actorSource,
          userId: user.userId,
          accountStatus: user.accountStatus,
        })
        return res.status(403).json({ authorized: false, error: 'inactive' })
      }

      // Normalize stored email (best-effort) + update lastLoginDate
      try {
        const nextEmail = info.emailNormalized
        const needsEmailNormalize = user.email !== nextEmail
        await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(needsEmailNormalize ? { email: nextEmail, username: nextEmail } : {}),
            lastLoginDate: new Date(),
          },
        })
      } catch (e: any) {
        // Don't block login if normalization fails due to uniqueness edge cases
        console.warn('[AuthZ] user normalization update failed (non-fatal)', {
          emailNormalized: info.emailNormalized,
          claimUsed: info.claimUsed,
          error: e?.message || String(e),
        })
      }

      return res.json({
        authorized: true,
        email: info.emailNormalized,
        user: {
          id: user.id,
          userId: user.userId,
          email: user.email,
          role: user.role,
          department: user.department,
          accountStatus: user.accountStatus,
        },
      })
    }

    // Not found
    if (!allowAutoProvision) {
      console.warn('[AuthZ] denied (user not registered)', {
        emailNormalized: info.emailNormalized,
        claimUsed: info.claimUsed,
        actorSource: info.actorSource,
        principalPresent: info.principalPresent,
        availableClaimTypes: info.availableClaimTypes.slice(0, 12),
      })
      return res.status(403).json({ authorized: false, error: 'not_registered' })
    }

    // Auto-provision (flag gated)
    const local = info.emailNormalized.split('@')[0] || 'User'
    const parts = local.split(/[._-]+/).filter(Boolean)
    const cap = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v)
    const firstName = cap(parts[0] || 'User')
    const lastName = parts.slice(1).map(cap).join(' ') || ''

    const newUserId = await generateUniqueUserId()
    const created = await prisma.user.create({
      data: {
        id: randomUUID(),
        userId: newUserId,
        firstName,
        lastName,
        email: info.emailNormalized,
        username: info.emailNormalized,
        role: 'user',
        department: 'General',
        accountStatus: 'Active',
        lastLoginDate: new Date(),
        createdDate: new Date(),
      },
    })

    console.log('[AuthZ] auto-provisioned user', {
      emailNormalized: info.emailNormalized,
      claimUsed: info.claimUsed,
      actorSource: info.actorSource,
      userId: created.userId,
      role: created.role,
    })

    return res.json({
      authorized: true,
      email: info.emailNormalized,
      user: {
        id: created.id,
        userId: created.userId,
        email: created.email,
        role: created.role,
        department: created.department,
        accountStatus: created.accountStatus,
      },
      autoProvisioned: true,
    })
  } catch (error: any) {
    console.error('[AuthZ] /api/users/me error:', error)
    return res.status(500).json({ authorized: false, error: 'server_error' })
  }
})

// Schema validation for User
const userSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1), // ODS + 8 numbers
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  username: z.string().min(1),
  phoneNumber: z.string().optional().nullable(),
  role: z.string().min(1),
  department: z.string().min(1),
  accountStatus: z.enum(['Active', 'Inactive']).optional(),
  lastLoginDate: z.string().optional().nullable(),
  profilePhoto: z.string().optional().nullable(),
  createdDate: z.string().optional(),
})

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdDate: 'desc' },
    })

    const serialized = users.map((user) => ({
      ...user,
      createdDate: user.createdDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
      lastLoginDate: user.lastLoginDate ? user.lastLoginDate.toISOString().split('T')[0] : 'Never',
      updatedAt: user.updatedAt.toISOString(),
    }))

    return res.json(serialized)
  } catch (error) {
    console.error('Error fetching users:', error)
    return res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// GET /api/users/:id - Get a single user
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const serialized = {
      ...user,
      createdDate: user.createdDate.toISOString().split('T')[0],
      lastLoginDate: user.lastLoginDate ? user.lastLoginDate.toISOString().split('T')[0] : 'Never',
      updatedAt: user.updatedAt.toISOString(),
    }

    return res.json(serialized)
  } catch (error) {
    console.error('Error fetching user:', error)
    return res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// POST /api/users - Create a new user
router.post('/', async (req, res) => {
  try {
    const body = userSchema.parse(req.body)

    // Generate ID if not provided
    const id = body.id || randomUUID()
    const emailNormalized = normalizeEmail(body.email)

    // Parse dates
    const createdDate = body.createdDate ? new Date(body.createdDate) : new Date()
    const lastLoginDate = body.lastLoginDate && body.lastLoginDate !== 'Never' 
      ? new Date(body.lastLoginDate) 
      : null

    const user = await prisma.user.create({
      data: {
        id,
        userId: body.userId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: emailNormalized,
        username: normalizeEmail(body.username || body.email),
        phoneNumber: body.phoneNumber || null,
        role: body.role,
        department: body.department,
        accountStatus: body.accountStatus || 'Active',
        lastLoginDate,
        profilePhoto: body.profilePhoto || null,
        createdDate,
      },
    })

    const serialized = {
      ...user,
      createdDate: user.createdDate.toISOString().split('T')[0],
      lastLoginDate: user.lastLoginDate ? user.lastLoginDate.toISOString().split('T')[0] : 'Never',
      updatedAt: user.updatedAt.toISOString(),
    }

    return res.status(201).json(serialized)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors })
    }
    if (error.code === 'P2002') {
      // Unique constraint violation
      return res.status(409).json({ error: 'User with this email or userId already exists' })
    }
    console.error('Error creating user:', error)
    return res.status(500).json({ error: 'Failed to create user' })
  }
})

// PUT /api/users/:id - Update a user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const body = userSchema.partial().parse(req.body)

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Parse dates if provided
    const lastLoginDate = body.lastLoginDate && body.lastLoginDate !== 'Never'
      ? new Date(body.lastLoginDate)
      : body.lastLoginDate === 'Never' ? null : undefined

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.userId && { userId: body.userId }),
        ...(body.firstName && { firstName: body.firstName }),
        ...(body.lastName && { lastName: body.lastName }),
        ...(body.email && { email: normalizeEmail(body.email) }),
        ...(body.username && { username: normalizeEmail(body.username) }),
        ...(body.phoneNumber !== undefined && { phoneNumber: body.phoneNumber || null }),
        ...(body.role && { role: body.role }),
        ...(body.department && { department: body.department }),
        ...(body.accountStatus && { accountStatus: body.accountStatus }),
        ...(lastLoginDate !== undefined && { lastLoginDate }),
        ...(body.profilePhoto !== undefined && { profilePhoto: body.profilePhoto || null }),
      },
    })

    const serialized = {
      ...user,
      createdDate: user.createdDate.toISOString().split('T')[0],
      lastLoginDate: user.lastLoginDate ? user.lastLoginDate.toISOString().split('T')[0] : 'Never',
      updatedAt: user.updatedAt.toISOString(),
    }

    return res.json(serialized)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors })
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'User with this email or userId already exists' })
    }
    console.error('Error updating user:', error)
    return res.status(500).json({ error: 'Failed to update user' })
  }
})

// DELETE /api/users/:id - Delete a user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    await prisma.user.delete({
      where: { id },
    })

    return res.status(204).send()
  } catch (error) {
    console.error('Error deleting user:', error)
    return res.status(500).json({ error: 'Failed to delete user' })
  }
})

export default router
