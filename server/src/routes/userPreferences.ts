import express from 'express'
import { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'

const router = express.Router()
const prisma = new PrismaClient()

// Validation schema for preferences
const preferencesSchema = z.object({
  userEmail: z.string().email(),
  preferences: z.record(z.any()),
})

// GET /api/user-preferences/:email - Get user preferences
// Returns:
//   200 { data: {...} } - success (including empty prefs for missing/malformed)
//   400 { error: "..." } - invalid request (missing email)
//   500 { error: "..." } - database failure
router.get('/:email', async (req, res) => {
  const { email } = req.params

  // Validate email param exists
  if (!email || email.trim() === '') {
    console.log('[UserPreferences] GET: Missing email parameter')
    return res.status(400).json({ error: 'Email parameter is required' })
  }

  try {
    const userPrefs = await prisma.userPreferences.findUnique({
      where: { userEmail: email },
    })

    // Record not found - return empty preferences (valid state, not an error)
    if (!userPrefs) {
      console.log('[UserPreferences] GET: No record for', email, '- returning empty (200)')
      return res.json({ data: {} })
    }

    // Safely parse preferences - handle malformed JSON gracefully
    let safePreferences = {}
    try {
      if (userPrefs.preferences && typeof userPrefs.preferences === 'object') {
        safePreferences = userPrefs.preferences
      } else if (typeof userPrefs.preferences === 'string') {
        safePreferences = JSON.parse(userPrefs.preferences)
      }
    } catch (parseError) {
      // Malformed JSON is not a server error - return empty as fallback
      console.warn('[UserPreferences] GET: Malformed JSON for', email, '- returning empty (200)')
      safePreferences = {}
    }

    console.log('[UserPreferences] GET: Found record for', email, '- returning preferences (200)')
    return res.json({ data: safePreferences })
  } catch (error) {
    // Classify the error for better diagnostics
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isPrismaError = error instanceof Prisma.PrismaClientKnownRequestError
    const isPrismaInitError = error instanceof Prisma.PrismaClientInitializationError
    const isConnectionError = errorMessage.includes('connect') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout')
    
    console.error('[UserPreferences] GET failed:', {
      email,
      errorType: isPrismaError ? 'PrismaKnownError' : isPrismaInitError ? 'PrismaInitError' : isConnectionError ? 'ConnectionError' : 'UnexpectedException',
      message: errorMessage,
      code: isPrismaError ? (error as Prisma.PrismaClientKnownRequestError).code : undefined,
    })
    
    return res.status(500).json({ error: 'Failed to load user preferences' })
  }
})

// PUT /api/user-preferences - Update or create user preferences
// Returns:
//   200 { data: {...} } - success
//   400 { error: "..." } - validation error
//   500 { error: "..." } - database failure
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

    res.json({ data: userPrefs.preferences })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request body', details: error.errors })
    }
    // Database failure - return 500 (NOT 200)
    console.error('[UserPreferences] PUT failed:', error instanceof Error ? error.message : 'Unknown')
    res.status(500).json({ error: 'Failed to save user preferences' })
  }
})

// PATCH /api/user-preferences/:email - Partially update user preferences
// Returns:
//   200 { data: {...} } - success
//   400 { error: "..." } - invalid request
//   500 { error: "..." } - database failure
router.patch('/:email', async (req, res) => {
  try {
    const { email } = req.params
    const updates = req.body

    // Validate email param
    if (!email || email.trim() === '') {
      return res.status(400).json({ error: 'Email parameter is required' })
    }

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

    res.json({ data: userPrefs.preferences })
  } catch (error) {
    // Database failure - return 500 (NOT 200)
    console.error('[UserPreferences] PATCH failed:', error instanceof Error ? error.message : 'Unknown')
    res.status(500).json({ error: 'Failed to save user preferences' })
  }
})

export default router
