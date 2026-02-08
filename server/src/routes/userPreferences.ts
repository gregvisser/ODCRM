import express from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

// Validation schema for preferences
const preferencesSchema = z.object({
  userEmail: z.string().email(),
  preferences: z.record(z.any()),
})

/**
 * Generate a short request ID for log correlation
 */
function genReqId(): string {
  return randomUUID().substring(0, 8)
}

/**
 * Classify Prisma/DB errors for logging
 */
function classifyError(error: unknown): {
  type: string
  code: string | undefined
  message: string
} {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      type: 'PrismaKnownRequestError',
      code: error.code,
      message: error.message.split('\n')[0], // First line only
    }
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      type: 'PrismaClientInitializationError',
      code: undefined,
      message: error.message.split('\n')[0],
    }
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      type: 'PrismaClientValidationError',
      code: undefined,
      message: error.message.split('\n')[0],
    }
  }
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return {
      type: 'PrismaClientRustPanicError',
      code: undefined,
      message: 'Prisma engine crashed',
    }
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return {
      type: 'PrismaClientUnknownRequestError',
      code: undefined,
      message: error.message.split('\n')[0],
    }
  }
  if (error instanceof Error) {
    const msg = error.message
    if (msg.includes('ECONNREFUSED') || msg.includes('connect')) {
      return { type: 'ConnectionError', code: undefined, message: msg.split('\n')[0] }
    }
    if (msg.includes('timeout')) {
      return { type: 'TimeoutError', code: undefined, message: msg.split('\n')[0] }
    }
    return { type: 'Error', code: undefined, message: msg.split('\n')[0] }
  }
  return { type: 'Unknown', code: undefined, message: String(error) }
}

// ============================================================================
// HEALTH CHECK - Test Prisma connectivity to UserPreferences table
// ============================================================================
router.get('/health', async (req, res) => {
  const reqId = genReqId()
  const startTime = Date.now()
  
  console.log(`[UserPreferences:health] [${reqId}] Starting health check...`)
  
  try {
    // Attempt a minimal query - count records (doesn't need to return data)
    const count = await prisma.userPreferences.count()
    const durationMs = Date.now() - startTime
    
    console.log(`[UserPreferences:health] [${reqId}] OK - count=${count}, duration=${durationMs}ms`)
    
    return res.json({
      status: 'ok',
      table: 'user_preferences',
      recordCount: count,
      durationMs,
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    const classified = classifyError(error)
    
    console.error(`[UserPreferences:health] [${reqId}] FAILED:`, {
      errorType: classified.type,
      errorCode: classified.code,
      errorMessage: classified.message,
      durationMs,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      env: process.env.NODE_ENV || 'development',
    })
    
    return res.status(500).json({
      status: 'error',
      table: 'user_preferences',
      errorType: classified.type,
      errorCode: classified.code,
      durationMs,
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    })
  }
})

// ============================================================================
// GET /api/user-preferences/:email - Get user preferences
// Returns:
//   200 { data: {...} } - success (including empty prefs for missing/malformed)
//   400 { error: "..." } - invalid request (missing email)
//   500 { error: "..." } - database failure ONLY
// ============================================================================
router.get('/:email', async (req, res) => {
  const reqId = genReqId()
  const { email } = req.params
  const startTime = Date.now()

  // Validate email param exists
  if (!email || email.trim() === '') {
    console.log(`[UserPreferences:GET] [${reqId}] 400 - Missing email parameter`)
    return res.status(400).json({ error: 'Email parameter is required' })
  }

  console.log(`[UserPreferences:GET] [${reqId}] START email=${email} env=${process.env.NODE_ENV || 'dev'} hasDbUrl=${!!process.env.DATABASE_URL}`)

  try {
    const userPrefs = await prisma.userPreferences.findUnique({
      where: { userEmail: email },
    })
    const durationMs = Date.now() - startTime

    // Record not found - return empty preferences (valid state, NOT an error)
    if (!userPrefs) {
      console.log(`[UserPreferences:GET] [${reqId}] 200 - No record found for email=${email} duration=${durationMs}ms`)
      return res.json({ data: {} })
    }

    // Safely parse preferences - handle malformed JSON gracefully
    let safePreferences: Record<string, unknown> = {}
    try {
      if (userPrefs.preferences && typeof userPrefs.preferences === 'object') {
        safePreferences = userPrefs.preferences as Record<string, unknown>
      } else if (typeof userPrefs.preferences === 'string') {
        safePreferences = JSON.parse(userPrefs.preferences)
      }
    } catch (parseError) {
      // Malformed JSON is NOT a server error - return empty as fallback
      console.warn(`[UserPreferences:GET] [${reqId}] 200 - Malformed JSON for email=${email}, returning empty duration=${durationMs}ms`)
      return res.json({ data: {} })
    }

    console.log(`[UserPreferences:GET] [${reqId}] 200 - Found record for email=${email} duration=${durationMs}ms`)
    return res.json({ data: safePreferences })
  } catch (error) {
    const durationMs = Date.now() - startTime
    const classified = classifyError(error)

    // HIGH-SIGNAL LOG for debugging production issues
    console.error(`[UserPreferences:GET] [${reqId}] 500 - DB FAILURE:`, {
      email,
      errorType: classified.type,
      errorCode: classified.code,
      errorMessage: classified.message,
      durationMs,
      model: 'UserPreferences',
      table: 'user_preferences',
      env: process.env.NODE_ENV || 'development',
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    })

    return res.status(500).json({ error: 'Failed to load user preferences' })
  }
})

// ============================================================================
// PUT /api/user-preferences - Update or create user preferences
// ============================================================================
router.put('/', async (req, res) => {
  const reqId = genReqId()
  const startTime = Date.now()

  try {
    const body = preferencesSchema.parse(req.body)

    console.log(`[UserPreferences:PUT] [${reqId}] START email=${body.userEmail}`)

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
    const durationMs = Date.now() - startTime

    console.log(`[UserPreferences:PUT] [${reqId}] 200 - Saved for email=${body.userEmail} duration=${durationMs}ms`)
    return res.json({ data: userPrefs.preferences })
  } catch (error) {
    const durationMs = Date.now() - startTime

    if (error instanceof z.ZodError) {
      console.warn(`[UserPreferences:PUT] [${reqId}] 400 - Validation error duration=${durationMs}ms`)
      return res.status(400).json({ error: 'Invalid request body', details: error.errors })
    }

    const classified = classifyError(error)
    console.error(`[UserPreferences:PUT] [${reqId}] 500 - DB FAILURE:`, {
      errorType: classified.type,
      errorCode: classified.code,
      errorMessage: classified.message,
      durationMs,
    })

    return res.status(500).json({ error: 'Failed to save user preferences' })
  }
})

// ============================================================================
// PATCH /api/user-preferences/:email - Partially update user preferences
// ============================================================================
router.patch('/:email', async (req, res) => {
  const reqId = genReqId()
  const startTime = Date.now()
  const { email } = req.params
  const updates = req.body

  // Validate email param
  if (!email || email.trim() === '') {
    console.log(`[UserPreferences:PATCH] [${reqId}] 400 - Missing email parameter`)
    return res.status(400).json({ error: 'Email parameter is required' })
  }

  console.log(`[UserPreferences:PATCH] [${reqId}] START email=${email}`)

  try {
    // Get existing preferences
    const existing = await prisma.userPreferences.findUnique({
      where: { userEmail: email },
    })

    const currentPrefs = (existing?.preferences as Record<string, unknown>) || {}
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
    const durationMs = Date.now() - startTime

    console.log(`[UserPreferences:PATCH] [${reqId}] 200 - Saved for email=${email} duration=${durationMs}ms`)
    return res.json({ data: userPrefs.preferences })
  } catch (error) {
    const durationMs = Date.now() - startTime
    const classified = classifyError(error)

    console.error(`[UserPreferences:PATCH] [${reqId}] 500 - DB FAILURE:`, {
      email,
      errorType: classified.type,
      errorCode: classified.code,
      errorMessage: classified.message,
      durationMs,
    })

    return res.status(500).json({ error: 'Failed to save user preferences' })
  }
})

export default router
