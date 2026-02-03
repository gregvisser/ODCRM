import express from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const router = express.Router()
const prisma = new PrismaClient()

// Validation schema for preferences
const preferencesSchema = z.object({
  userEmail: z.string().email(),
  preferences: z.record(z.any()),
})

// GET /api/user-preferences/:email - Get user preferences
router.get('/:email', async (req, res) => {
  try {
    const { email } = req.params

    const userPrefs = await prisma.userPreferences.findUnique({
      where: { userEmail: email },
    })

    if (!userPrefs) {
      // Return empty preferences if none exist
      return res.json({
        userEmail: email,
        preferences: {},
      })
    }

    res.json({
      userEmail: userPrefs.userEmail,
      preferences: userPrefs.preferences,
    })
  } catch (error) {
    console.error('Error fetching user preferences:', error)
    res.status(500).json({ error: 'Failed to fetch user preferences' })
  }
})

// PUT /api/user-preferences - Update or create user preferences
router.put('/', async (req, res) => {
  try {
    const body = preferencesSchema.parse(req.body)

    const userPrefs = await prisma.userPreferences.upsert({
      where: { userEmail: body.userEmail },
      update: {
        preferences: body.preferences,
      },
      create: {
        userEmail: body.userEmail,
        preferences: body.preferences,
      },
    })

    res.json({
      userEmail: userPrefs.userEmail,
      preferences: userPrefs.preferences,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request body', details: error.errors })
    }
    console.error('Error updating user preferences:', error)
    res.status(500).json({ error: 'Failed to update user preferences' })
  }
})

// PATCH /api/user-preferences/:email - Partially update user preferences
router.patch('/:email', async (req, res) => {
  try {
    const { email } = req.params
    const updates = req.body

    // Get existing preferences
    const existing = await prisma.userPreferences.findUnique({
      where: { userEmail: email },
    })

    const currentPrefs = (existing?.preferences as Record<string, any>) || {}
    const mergedPrefs = {
      ...currentPrefs,
      ...updates,
    }

    const userPrefs = await prisma.userPreferences.upsert({
      where: { userEmail: email },
      update: {
        preferences: mergedPrefs,
      },
      create: {
        userEmail: email,
        preferences: mergedPrefs,
      },
    })

    res.json({
      userEmail: userPrefs.userEmail,
      preferences: userPrefs.preferences,
    })
  } catch (error) {
    console.error('Error patching user preferences:', error)
    res.status(500).json({ error: 'Failed to update user preferences' })
  }
})

export default router
