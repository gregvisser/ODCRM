// @ts-nocheck
/**
 * Users Management API
 * Migrated from localStorage to database
 */

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const router = Router()

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
    const id = body.id || crypto.randomUUID()

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
        email: body.email,
        username: body.username,
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
        ...(body.email && { email: body.email }),
        ...(body.username && { username: body.username }),
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
