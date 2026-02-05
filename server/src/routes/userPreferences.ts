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
// CRITICAL: This endpoint NEVER returns 500 - always 200 with fallback to empty
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

    // Safely parse preferences - handle malformed JSON
    let safePreferences = {}
    try {
      if (userPrefs.preferences && typeof userPrefs.preferences === 'object') {
        safePreferences = userPrefs.preferences
      } else if (typeof userPrefs.preferences === 'string') {
        safePreferences = JSON.parse(userPrefs.preferences)
      }
    } catch (parseError) {
      console.warn('[UserPreferences] Malformed preferences JSON for', email, '- returning empty')
      safePreferences = {}
    }

    res.json({
      userEmail: userPrefs.userEmail,
      preferences: safePreferences,
    })
  } catch (error) {
    // NEVER return 500 - always return 200 with empty preferences
    // This prevents blocking the app on preferences errors
    console.warn('[UserPreferences] Error fetching preferences, returning empty:', error instanceof Error ? error.message : 'Unknown')
    res.json({
      userEmail: req.params.email,
      preferences: {},
    })
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
    // Log but don't block - return success with what we have
    console.warn('[UserPreferences] Error saving preferences:', error instanceof Error ? error.message : 'Unknown')
    // Return the input as confirmation (optimistic)
    res.json({
      userEmail: req.body?.userEmail || '',
      preferences: req.body?.preferences || {},
    })
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
    // Log but don't block - return success with merged data
    console.warn('[UserPreferences] Error patching preferences:', error instanceof Error ? error.message : 'Unknown')
    res.json({
      userEmail: req.params.email,
      preferences: { ...(req.body || {}) },
    })
  }
})

export default router
