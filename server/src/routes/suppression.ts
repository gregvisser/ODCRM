import express from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma.js'

const router = express.Router()

const getCustomerId = (req: express.Request): string => {
  const customerId = (req.headers['x-customer-id'] as string) || (req.query.customerId as string)
  if (!customerId) {
    const err = new Error('Customer ID required') as Error & { status?: number }
    err.status = 400
    throw err
  }
  return customerId
}

const createSchema = z.object({
  type: z.enum(['domain', 'email']),
  value: z.string().min(1),
  reason: z.string().optional(),
  source: z.string().optional(),
})

const csvImportSchema = z.object({
  entries: z.array(
    z.object({
      email: z.string().optional(),
      domain: z.string().optional(),
      reason: z.string().optional(),
    })
  ),
  sourceFileName: z.string().optional(),
})

const isValidDomain = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed.includes('@')) return false
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)
}

// POST /api/suppression/check - Check how many emails from a list are suppressed
router.post('/check', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { emails } = z.object({
      emails: z.array(z.string().email())
    }).parse(req.body)

    if (emails.length === 0) {
      return res.json({ suppressedCount: 0, suppressedEmails: [] })
    }

    // Normalize emails
    const normalizedEmails = emails.map(e => e.trim().toLowerCase())
    const domains = normalizedEmails.map(e => e.split('@')[1]).filter(Boolean)

    // Find all suppression entries that match
    const suppressionEntries = await prisma.suppressionEntry.findMany({
      where: {
        customerId,
        OR: [
          { type: 'email', value: { in: normalizedEmails } },
          { type: 'domain', value: { in: domains } },
        ],
      },
      select: {
        type: true,
        value: true,
      },
    })

    // Build lookup sets
    const suppressedEmailsSet = new Set(
      suppressionEntries.filter(e => e.type === 'email').map(e => e.value)
    )
    const suppressedDomainsSet = new Set(
      suppressionEntries.filter(e => e.type === 'domain').map(e => e.value)
    )

    // Find which emails are suppressed
    const suppressedEmails = normalizedEmails.filter(email => {
      const domain = email.split('@')[1]
      return suppressedEmailsSet.has(email) || suppressedDomainsSet.has(domain)
    })

    res.json({
      suppressedCount: suppressedEmails.length,
      suppressedEmails: suppressedEmails.slice(0, 100), // Limit to first 100 for response size
      totalChecked: emails.length,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const type = req.query.type as string | undefined
    const q = (req.query.q as string | undefined)?.trim().toLowerCase()

    const where: any = { customerId }
    if (type === 'domain' || type === 'email') {
      where.type = type
    }
    if (q) {
      where.value = { contains: q, mode: 'insensitive' }
    }

    const entries = await prisma.suppressionEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    res.json(entries)
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const data = createSchema.parse(req.body)
    const value = data.value.trim().toLowerCase()
    const emailNormalized = data.type === 'email' ? value : null

    if (data.type === 'domain' && !isValidDomain(value)) {
      return res.status(400).json({ error: 'Invalid domain format' })
    }
    if (data.type === 'email' && !z.string().email().safeParse(value).success) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

    const entry = await prisma.suppressionEntry.upsert({
      where: {
        customerId_type_value: {
          customerId,
          type: data.type,
          value,
        },
      },
      update: {
        reason: data.reason || null,
        source: data.source || null,
        emailNormalized,
      },
      create: {
        id: randomUUID(),
        customerId,
        type: data.type,
        value,
        emailNormalized,
        reason: data.reason || null,
        source: data.source || 'manual',
      },
    })

    res.status(201).json(entry)
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const { id } = req.params

    const existing = await prisma.suppressionEntry.findFirst({
      where: { id, customerId },
      select: { id: true },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Suppression entry not found' })
    }

    await prisma.suppressionEntry.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// CSV Import endpoint
router.post('/import-csv', async (req, res, next) => {
  try {
    const customerId = getCustomerId(req)
    const data = csvImportSchema.parse(req.body)
    const { entries, sourceFileName } = data

    let imported = 0
    let duplicates = 0
    let errors: string[] = []

    // Process entries in batches to avoid transaction timeout
    const batchSize = 100
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)

      for (const entry of batch) {
        try {
          if (entry.email) {
            // Email entry
            const normalizedEmail = entry.email.trim().toLowerCase()
            if (!z.string().email().safeParse(normalizedEmail).success) {
              errors.push(`Invalid email: ${entry.email}`)
              continue
            }

            const result = await prisma.suppressionEntry.upsert({
              where: {
                customerId_type_value: {
                  customerId,
                  type: 'email',
                  value: normalizedEmail,
                },
              },
              update: {
                reason: entry.reason || null,
                source: 'import',
                sourceFileName: sourceFileName || null,
              },
              create: {
                id: randomUUID(),
                customerId,
                type: 'email',
                value: normalizedEmail,
                emailNormalized: normalizedEmail,
                reason: entry.reason || null,
                source: 'import',
                sourceFileName: sourceFileName || null,
              },
            })

            if (result.createdAt.toISOString() === result.updatedAt.toISOString()) {
              imported++
            } else {
              duplicates++
            }
          } else if (entry.domain) {
            // Domain entry
            const normalizedDomain = entry.domain.trim().toLowerCase()
            if (!isValidDomain(normalizedDomain)) {
              errors.push(`Invalid domain: ${entry.domain}`)
              continue
            }

            const result = await prisma.suppressionEntry.upsert({
              where: {
                customerId_type_value: {
                  customerId,
                  type: 'domain',
                  value: normalizedDomain,
                },
              },
              update: {
                reason: entry.reason || null,
                source: 'import',
                sourceFileName: sourceFileName || null,
              },
              create: {
                id: randomUUID(),
                customerId,
                type: 'domain',
                value: normalizedDomain,
                reason: entry.reason || null,
                source: 'import',
                sourceFileName: sourceFileName || null,
              },
            })

            if (result.createdAt.toISOString() === result.updatedAt.toISOString()) {
              imported++
            } else {
              duplicates++
            }
          } else {
            errors.push(`Entry missing both email and domain: ${JSON.stringify(entry)}`)
          }
        } catch (entryError) {
          errors.push(`Failed to process entry: ${JSON.stringify(entry)} - ${entryError}`)
        }
      }
    }

    res.json({
      success: true,
      imported,
      duplicates,
      errors,
      totalProcessed: entries.length,
    })
  } catch (error) {
    next(error)
  }
})

export default router
